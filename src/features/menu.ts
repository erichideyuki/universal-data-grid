import { html, nothing, type ReactiveController, type ReactiveControllerHost, svg, type TemplateResult } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { map } from 'lit/directives/map.js';

/**
 * Motor único dos menus do grid (frente 18): menu de contexto (cabeçalho,
 * painel de grupos, linhas, linhas de grupo) e menus da barra ("mais",
 * exportar). Padrão "menu" da APG: ↑/↓ circulares, Home/End, letra digitada,
 * Enter/Espaço, Esc e Tab fecham devolvendo o foco; clique fora fecha sem
 * roubar o foco (spec 17). Popover manual (camada do topo), posicionado no
 * ponto do clique ou sob o elemento de origem, preso à janela e espelhado em
 * RTL.
 *
 * Submenu (um nível, "Fixar coluna ▸"): painel irmão do menu (um `menu` não
 * fica dentro de outro na árvore ARIA), aberto por →/Enter/Espaço (← em RTL)
 * com o foco no primeiro item; ←/Esc (→ em RTL) fecham e devolvem o foco ao
 * item pai; Tab fecha a cadeia toda.
 */

export interface MenuHost extends ReactiveControllerHost {
  readonly renderRoot: HTMLElement | DocumentFragment;
  _isRtl(): boolean;
}

/** Para onde o foco volta ao fechar: o elemento ou quem o acha na hora (a célula pode ter sido reciclada). */
export type MenuReturnFocus = HTMLElement | null | (() => HTMLElement | null);

export interface MenuAnchor<D = unknown> {
  /** Recebe o foco de volta ao fechar (Esc, Tab, ação). */
  returnFocus: MenuReturnFocus;
  /** Ponto do clique direito/toque; sem ele, abre sob `positionTarget` (ou o `returnFocus`). */
  x?: number;
  y?: number;
  positionTarget?: HTMLElement | null;
  /** Botão que abriu (`aria-expanded`): clicar nele com o menu aberto fecha, não reabre. */
  opener?: HTMLElement | null;
  /** Abre com o foco no último item (↑ no botão de menu). */
  focusLast?: boolean;
  /** O que o grid precisa para desenhar e agir (alvo, itens). */
  data: D;
}

/** Teclas que abrem um menu de contexto pelo teclado. */
export const isContextMenuKey = (event: KeyboardEvent): boolean =>
  event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey);

/** Espera entre letras da busca por digitação (APG). */
const TYPEAHEAD_MS = 500;

/** Texto comparável da busca por letra: sem diacríticos, caixa pelo idioma. */
const foldMenuText = (text: string, lang: string | undefined): string => {
  const plain = text.normalize('NFD').replace(/\p{M}/gu, '')
    .trim();

  try {
    return plain.toLocaleLowerCase(lang || undefined);
  } catch {
    return plain.toLowerCase();
  }
};

const resolveTarget = (target: MenuReturnFocus): HTMLElement | null =>
  typeof target === 'function' ? target() : target;

const isEnabled = (item: HTMLElement): boolean => item.getAttribute('aria-disabled') !== 'true';

export class MenuController<D = unknown> implements ReactiveController {
  readonly #host: MenuHost;
  readonly #panelClass: string;
  #anchor: MenuAnchor<D> | null = null;
  #shown = false;
  #restoreFocus: MenuReturnFocus = null;
  #typeahead = '';
  #typeaheadTimer: ReturnType<typeof setTimeout> | undefined;
  /** Item pai (chave) do submenu aberto. */
  #submenu: string | null = null;
  #submenuShown = false;
  /** O submenu abriu pelo teclado: o foco vai ao primeiro item dele. */
  #submenuFocus = false;

  constructor(host: MenuHost, panelClass: string) {
    this.#host = host;
    this.#panelClass = panelClass;
    host.addController(this);
  }

  get open(): boolean {
    return this.#anchor !== null;
  }

  get data(): D | undefined {
    return this.#anchor?.data;
  }

  get opener(): HTMLElement | null {
    return this.#anchor?.opener ?? null;
  }

  /** Chave do item cujo submenu está aberto (`null`: nenhum). */
  get submenu(): string | null {
    return this.#submenu;
  }

  /** Timer da busca por letra pendente (diagnóstico de memória). */
  get timers(): number {
    return this.#typeaheadTimer === undefined ? 0 : 1;
  }

  show(anchor: MenuAnchor<D>): void {
    if (this.#anchor) {
      // Outro menu deste controlador: o painel novo se posiciona e recebe o foco de novo.
      this.#submenuPanel?.hidePopover?.();
      this.#panel?.hidePopover?.();
    }

    this.#anchor = anchor;
    this.#shown = false;
    this.#restoreFocus = null;
    this.#resetSubmenu();
    this.#host.requestUpdate();
  }

  /** Fecha; com `restoreFocus`, o foco volta ao disparador depois do render. */
  hide(restoreFocus = false): void {
    if (!this.#anchor) {
      return;
    }

    this.#restoreFocus = restoreFocus ? this.#anchor.returnFocus : null;
    this.#close();
  }

  /**
   * Fecha e devolve o foco JÁ (no mesmo gesto: a ação do hospedeiro roda com
   * o foco no disparador e a ativação do usuário ainda vale).
   */
  hideAndFocus(): void {
    const anchor = this.#anchor;

    if (!anchor) {
      return;
    }

    this.#restoreFocus = null;
    this.#close();
    const target = resolveTarget(anchor.returnFocus);

    if (target?.isConnected) {
      target.focus();
    }
  }

  /** Abre o submenu do item `key`; com `focusFirst` (teclado), o foco vai ao primeiro item dele. */
  openSubmenu(key: string, focusFirst = false): void {
    if (!this.#anchor) {
      return;
    }

    if (this.#submenu === key) {
      if (focusFirst) {
        if (this.#submenuShown) {
          this.#focusFirstIn(this.#submenuPanel);
        } else {
          this.#submenuFocus = true;
        }
      }

      return;
    }

    this.#submenuPanel?.hidePopover?.();
    this.#submenu = key;
    this.#submenuShown = false;
    this.#submenuFocus = focusFirst;
    this.#host.requestUpdate();
  }

  /** Fecha o submenu; com `focusParent`, o foco volta ao item que o abriu. */
  closeSubmenu(focusParent = false): void {
    const key = this.#submenu;

    if (key === null) {
      return;
    }

    const parent = this.#parentItem(key);
    const submenu = this.#submenuPanel;
    const active = (this.#host.renderRoot as ShadowRoot).activeElement as Element | null | undefined;
    // O foco estava no submenu (que sai do DOM): volta ao pai, nunca ao <body> (fechado pelo ponteiro também).
    const hadFocus = !!active && !!submenu?.contains(active);
    submenu?.hidePopover?.();
    this.#resetSubmenu();
    this.#host.requestUpdate();

    if (focusParent || hadFocus) {
      parent?.focus();
    }
  }

  /** Ponteiro sobre um item do menu de cima: abre o submenu dele (sem foco) ou fecha o aberto. */
  hoverItem(key: string, hasSubmenu: boolean): void {
    if (hasSubmenu) {
      this.openSubmenu(key);
    } else {
      this.closeSubmenu();
    }
  }

  #resetSubmenu(): void {
    this.#submenu = null;
    this.#submenuShown = false;
    this.#submenuFocus = false;
  }

  #close(): void {
    this.#anchor = null;
    this.#clearTypeahead();
    this.#submenuPanel?.hidePopover?.();
    this.#resetSubmenu();
    this.#panel?.hidePopover?.();
    document.removeEventListener('pointerdown', this.#outsidePointerDown, true);
    this.#host.requestUpdate();
  }

  get #panel(): HTMLElement | null {
    return this.#host.renderRoot.querySelector<HTMLElement>(`.${this.#panelClass}`);
  }

  get #submenuPanel(): HTMLElement | null {
    return this.#host.renderRoot.querySelector<HTMLElement>(`.${this.#panelClass}-submenu`);
  }

  /** Itens de um painel: `menuitem` e `menuitemradio` (também dentro de `group`). */
  #itemsOf(panel: Element | null | undefined): HTMLElement[] {
    return [...panel?.querySelectorAll<HTMLElement>('[role^=menuitem]') ?? []];
  }

  get #items(): HTMLElement[] {
    return this.#itemsOf(this.#panel);
  }

  #parentItem(key: string): HTMLElement | null {
    return this.#items.find(item => item.getAttribute('data-submenu') === key) ?? null;
  }

  #focusFirstIn(panel: Element | null): void {
    const items = this.#itemsOf(panel);
    (items.find(isEnabled) ?? items[0])?.focus();
  }

  hostUpdated(): void {
    if (!this.#anchor) {
      const target = resolveTarget(this.#restoreFocus);
      this.#restoreFocus = null;

      if (target?.isConnected) {
        target.focus();
      }

      return;
    }

    const panel = this.#panel;

    if (!panel) {
      return;
    }

    if (!this.#shown) {
      this.#shown = true;

      if (typeof panel.showPopover === 'function' && !panel.matches(':popover-open')) {
        panel.showPopover();
      }

      this.#position(panel, this.#anchor);
      document.addEventListener('pointerdown', this.#outsidePointerDown, true);
      const items = this.#items;
      const enabled = items.filter(isEnabled);
      ((this.#anchor.focusLast ? enabled[enabled.length - 1] : enabled[0]) ?? items[0])?.focus();
    }

    this.#showSubmenu();
  }

  /** Submenu pedido e ainda não mostrado: camada do topo, ao lado do item pai, foco (teclado). */
  #showSubmenu(): void {
    const key = this.#submenu;

    if (key === null || this.#submenuShown) {
      return;
    }

    const submenu = this.#submenuPanel;
    const parent = this.#parentItem(key);

    // O item pai não existe neste menu: nada a abrir.
    if (!submenu || !parent) {
      this.#resetSubmenu();
      return;
    }

    this.#submenuShown = true;

    if (typeof submenu.showPopover === 'function' && !submenu.matches(':popover-open')) {
      submenu.showPopover();
    }

    this.#positionSubmenu(submenu, parent);

    if (this.#submenuFocus) {
      this.#submenuFocus = false;
      this.#focusFirstIn(submenu);
    }
  }

  hostDisconnected(): void {
    document.removeEventListener('pointerdown', this.#outsidePointerDown, true);
    this.#anchor = null;
    this.#shown = false;
    this.#restoreFocus = null;
    this.#resetSubmenu();
    this.#clearTypeahead();
  }

  /** Foca o item `index` (os itens do painel atual). */
  focusItem(index: number): void {
    const items = this.#items;
    items[(index + items.length) % items.length]?.focus();
  }

  readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.isComposing) {
      return;
    }

    const target = event.composedPath()[0] as HTMLElement;
    const submenu = this.#submenuPanel;
    const inSubmenu = !!submenu?.contains(target);
    const items = inSubmenu ? this.#itemsOf(submenu) : this.#items;
    const index = items.indexOf(target);
    const parentKey = inSubmenu ? undefined : target.getAttribute?.('data-submenu') ?? undefined;
    // As setas de abrir/fechar o submenu seguem a direção do texto (RTL troca).
    const rtl = this.#host._isRtl();
    const openKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const closeKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next: number | undefined;

    if (parentKey !== undefined && (event.key === openKey || event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      this.openSubmenu(parentKey, true);
      return;
    }

    if (inSubmenu && (event.key === closeKey || event.key === 'Escape')) {
      event.preventDefault();
      event.stopPropagation();
      this.closeSubmenu(true);
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        next = (index + 1) % items.length;
        break;
      case 'ArrowUp':
        next = (index - 1 + items.length) % items.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = items.length - 1;
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.hide(true);
        return;
      case 'Tab':
        event.preventDefault();
        this.hide(true);
        return;

      default:
        next = this.#typeaheadTarget(event, items, index);

        if (next === undefined) {
          return;
        }
    }

    event.preventDefault();
    const item = items[next];

    // Andar no menu de cima fecha o submenu aberto (o foco sai do item pai).
    if (!inSubmenu && item !== target) {
      this.closeSubmenu();
    }

    item?.focus();
  };

  /** Busca por letra (APG): sem modificadores, Espaço fora; várias letras em 500 ms; sem achar, não move. */
  #typeaheadTarget(event: KeyboardEvent, items: HTMLElement[], index: number): number | undefined {
    if (event.key.length !== 1 || event.key === ' ' || event.ctrlKey || event.altKey || event.metaKey || !items.length) {
      return undefined;
    }

    const panel = items[0].closest('[role=menu]') ?? this.#panel;
    const lang = panel?.closest('[lang]')?.getAttribute('lang') ?? undefined;
    const char = foldMenuText(event.key, lang);

    clearTimeout(this.#typeaheadTimer);
    this.#typeahead += char;
    this.#typeaheadTimer = setTimeout(() => this.#clearTypeahead(), TYPEAHEAD_MS);

    const buffer = this.#typeahead;
    // A mesma letra repetida circula entre os itens que começam com ela.
    const repeated = buffer.length > 1 && buffer.split(char).every(part => part === '');
    const search = repeated ? char : buffer;
    const start = buffer.length === 1 || repeated ? index + 1 : index;

    for (let offset = 0; offset < items.length; offset++) {
      const candidate = (start + offset + items.length) % items.length;
      const item = items[candidate];
      const text = foldMenuText(item.querySelector('.menu-item-text')?.textContent ?? item.textContent ?? '', item.closest('[lang]')?.getAttribute('lang') ?? lang);

      if (text.startsWith(search)) {
        return candidate;
      }
    }

    // `undefined` deixaria a tecla seguir; sem achar, o foco fica onde está.
    return index >= 0 ? index : 0;
  }

  #clearTypeahead(): void {
    clearTimeout(this.#typeaheadTimer);
    this.#typeaheadTimer = undefined;
    this.#typeahead = '';
  }

  #position(panel: HTMLElement, anchor: MenuAnchor<D>): void {
    const margin = 8;
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    let left: number;
    let top: number;

    if (anchor.x !== undefined && anchor.y !== undefined) {
      left = this.#host._isRtl() ? anchor.x - width : anchor.x;
      top = anchor.y;
    } else {
      const target = anchor.positionTarget ?? resolveTarget(anchor.returnFocus) ?? (this.#host as unknown as HTMLElement);
      const rect = target.getBoundingClientRect();
      left = this.#host._isRtl() ? rect.right - width : rect.left;
      top = rect.bottom + 4;

      // Sem espaço embaixo: abre acima do disparador.
      if (top + height > viewportHeight - margin && rect.top - height - 4 >= margin) {
        top = rect.top - height - 4;
      }
    }

    panel.style.left = `${Math.round(Math.max(margin, Math.min(left, viewportWidth - width - margin)))}px`;
    panel.style.top = `${Math.round(Math.max(margin, Math.min(top, viewportHeight - height - margin)))}px`;
  }

  /** Ao lado do item pai (no lado do fim; sem espaço, no outro), preso à janela. */
  #positionSubmenu(submenu: HTMLElement, parent: HTMLElement): void {
    const margin = 8;
    const rect = parent.getBoundingClientRect();
    const width = submenu.offsetWidth;
    const height = submenu.offsetHeight;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const rtl = this.#host._isRtl();
    let left = rtl ? rect.left - width : rect.right;

    if (!rtl && left + width > viewportWidth - margin && rect.left - width >= margin) {
      left = rect.left - width;
    } else if (rtl && left < margin && rect.right + width <= viewportWidth - margin) {
      left = rect.right;
    }

    // O 1º item na altura do pai (o painel tem 8px de respiro em cima).
    const top = rect.top - 8;
    submenu.style.left = `${Math.round(Math.max(margin, Math.min(left, viewportWidth - width - margin)))}px`;
    submenu.style.top = `${Math.round(Math.max(margin, Math.min(top, viewportHeight - height - margin)))}px`;
  }

  readonly #outsidePointerDown = (event: PointerEvent): void => {
    const opener = this.#anchor?.opener;
    // O botão que abriu (aria-expanded) trata o próprio clique: fecha, não reabre.
    const keep = event.composedPath().some(target =>
      target instanceof HTMLElement
      && (target.classList.contains(this.#panelClass)
        || target.classList.contains(`${this.#panelClass}-submenu`)
        || (!!opener && target === opener && target.getAttribute('aria-expanded') === 'true')));

    if (!keep) {
      this.hide();
    }
  };
}

/** Uma entrada do menu desenhado (sem estado). */
export interface MenuEntry {
  /** Identidade (posição na lista de itens do grid). */
  key: string;
  label: string;
  /** Visível e focável pelas setas, mas sem efeito (APG: `aria-disabled`). */
  disabled?: boolean;
  separatorBefore?: boolean;
  /** Texto oculto depois do rótulo (ex.: a coluna de "Desagrupar"). */
  hiddenSuffix?: string;
  /** Idioma do texto oculto (o rótulo da coluna é do hospedeiro). */
  suffixLang?: string;
  /** Idioma do texto: o da i18n nos embutidos; o do conteúdo do hospedeiro (ou `''`) nos dele. */
  lang?: string;
  /** O item abre um diálogo (seletor de colunas pelo "mais" e pelo menu do cabeçalho). */
  hasPopup?: 'dialog';
  /** `menuitemradio` com este `aria-checked` (itens do submenu de fixar); ausente = `menuitem`. */
  checked?: boolean;
  /** Submenu: o item abre um `menu` com estes itens num `group` com o nome do item. */
  children?: readonly MenuEntry[];
}

export interface MenuRenderContext {
  /** Classe do painel (a do controlador) e classes extras. */
  className: string;
  /** `part` do painel: `menu` + a do menu. */
  part: string;
  /** Nome do menu (texto da i18n) ou id do botão que o nomeia. */
  label?: string;
  labelledBy?: string;
  /** Idioma do nome (`aria-label`). */
  labelLang?: string;
  entries: readonly MenuEntry[];
  onAction: (key: string) => void;
  /** Ativação de um item `aria-disabled` (não age; o grid pode anunciar o porquê). */
  onDisabledAction?: (key: string) => void;
  onKeyDown: (event: KeyboardEvent) => void;
  /** Controlador do menu (submenu aberto, ponteiro sobre os itens); sem ele, nada de submenu. */
  controller?: MenuController<any>;
}

/** Seta do item com submenu (espelhada em RTL pelo CSS). */
const submenuArrow = svg`<path d="M9.3 6.7 10.7 5.3l6.7 6.7-6.7 6.7-1.4-1.4 5.3-5.3z"/>`;
/** Marca do `menuitemradio` marcado. */
const checkMark = svg`<path d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6 11-11-1.4-1.4z"/>`;

const renderItem = (entry: MenuEntry, context: MenuRenderContext, submenuId: string, inSubmenu: boolean): TemplateResult => {
  const { onAction, onDisabledAction, controller } = context;
  const parent = !inSubmenu && !!entry.children?.length && !!controller;
  const expanded = parent && controller.submenu === entry.key;
  const radio = entry.checked !== undefined;

  return html`<button
    class="menu-item group-panel-menu-item ${parent ? 'menu-item-parent' : ''} ${radio ? 'menu-item-radio' : ''}"
    part="menu-item"
    type="button"
    role=${radio ? 'menuitemradio' : 'menuitem'}
    tabindex="-1"
    lang=${ifDefined(entry.lang)}
    data-submenu=${ifDefined(parent ? entry.key : undefined)}
    aria-haspopup=${ifDefined(parent ? 'menu' : entry.hasPopup)}
    aria-expanded=${ifDefined(parent ? (expanded ? 'true' : 'false') : undefined)}
    aria-controls=${ifDefined(expanded ? submenuId : undefined)}
    aria-checked=${ifDefined(radio ? (entry.checked ? 'true' : 'false') : undefined)}
    aria-disabled=${entry.disabled ? 'true' : 'false'}
    @pointerenter=${!inSubmenu && controller
      ? (event: PointerEvent) => {
        if (event.pointerType !== 'touch') {
          controller.hoverItem(entry.key, parent);
        }
      }
      : nothing}
    @click=${() => {
      if (parent) {
        if (expanded) {
          controller.closeSubmenu();
        } else {
          controller.openSubmenu(entry.key);
        }
      } else if (entry.disabled) {
        onDisabledAction?.(entry.key);
      } else {
        onAction(entry.key);
      }
    }}>${radio
      ? html`<svg class="menu-item-check" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">${
        entry.checked ? checkMark : nothing}</svg>`
      : nothing}<span class="menu-item-text">${entry.label}</span>${entry.hiddenSuffix
      ? html`<span class="visually-hidden" lang=${ifDefined(entry.suffixLang)}> ${entry.hiddenSuffix}</span>`
      : nothing}${parent
      ? html`<svg class="menu-item-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">${submenuArrow}</svg>`
      : nothing}</button>`;
};

const renderEntries = (entries: readonly MenuEntry[], context: MenuRenderContext, submenuId: string, inSubmenu: boolean) =>
  map(entries, (entry, index) => html`${entry.separatorBefore && index > 0
    ? html`<div class="menu-separator" part="menu-separator" role="separator"></div>`
    : nothing}${renderItem(entry, context, submenuId, inSubmenu)}`);

/**
 * O menu (sem estado): itens com foco móvel e separadores. O submenu aberto
 * vem como painel irmão (`role="menu"` com um `group` nomeado pelo item pai),
 * também na camada do topo.
 */
export const renderMenu = (context: MenuRenderContext): TemplateResult => {
  const { className, part, label, labelledBy, labelLang, entries, onKeyDown, controller } = context;
  const submenuId = `${className.split(' ')[0]}-submenu`;
  const open = controller?.submenu ?? null;
  const parent = open === null ? undefined : entries.find(entry => entry.key === open && entry.children?.length);

  return html`
    <div
      class="grid-menu ${className}"
      part=${part}
      .popover=${'manual'}
      role="menu"
      lang=${ifDefined(labelLang)}
      aria-label=${ifDefined(label)}
      aria-labelledby=${ifDefined(labelledBy)}
      @contextmenu=${(event: Event) => event.preventDefault()}
      @keydown=${onKeyDown}>
      ${renderEntries(entries, context, submenuId, false)}
    </div>${parent
      ? html`<div
        class="grid-menu grid-submenu ${submenuId}"
        id=${submenuId}
        part=${part}
        .popover=${'manual'}
        role="menu"
        lang=${ifDefined(labelLang)}
        aria-label=${parent.label}
        @contextmenu=${(event: Event) => event.preventDefault()}
        @keydown=${onKeyDown}>
        <div class="menu-group" role="group" aria-label=${parent.label} lang=${ifDefined(parent.lang)}>${renderEntries(parent.children!, context, submenuId, true)}</div>
      </div>`
      : nothing}`;
};
