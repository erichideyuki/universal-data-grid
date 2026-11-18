import { html, nothing, type ReactiveController, type ReactiveControllerHost, type TemplateResult } from 'lit';
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

export class MenuController<D = unknown> implements ReactiveController {
  readonly #host: MenuHost;
  readonly #panelClass: string;
  #anchor: MenuAnchor<D> | null = null;
  #shown = false;
  #restoreFocus: MenuReturnFocus = null;
  #typeahead = '';
  #typeaheadTimer: ReturnType<typeof setTimeout> | undefined;

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

  /** Timer da busca por letra pendente (diagnóstico de memória). */
  get timers(): number {
    return this.#typeaheadTimer === undefined ? 0 : 1;
  }

  show(anchor: MenuAnchor<D>): void {
    if (this.#anchor) {
      // Outro menu deste controlador: o painel novo se posiciona e recebe o foco de novo.
      this.#panel?.hidePopover?.();
    }

    this.#anchor = anchor;
    this.#shown = false;
    this.#restoreFocus = null;
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

  #close(): void {
    this.#anchor = null;
    this.#clearTypeahead();
    this.#panel?.hidePopover?.();
    document.removeEventListener('pointerdown', this.#outsidePointerDown, true);
    this.#host.requestUpdate();
  }

  get #panel(): HTMLElement | null {
    return this.#host.renderRoot.querySelector<HTMLElement>(`.${this.#panelClass}`);
  }

  get #items(): HTMLElement[] {
    return [...this.#panel?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? []];
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

    if (!panel || this.#shown) {
      return;
    }

    this.#shown = true;

    if (typeof panel.showPopover === 'function' && !panel.matches(':popover-open')) {
      panel.showPopover();
    }

    this.#position(panel, this.#anchor);
    document.addEventListener('pointerdown', this.#outsidePointerDown, true);
    const items = this.#items;
    const enabled = items.filter(item => item.getAttribute('aria-disabled') !== 'true');
    ((this.#anchor.focusLast ? enabled[enabled.length - 1] : enabled[0]) ?? items[0])?.focus();
  }

  hostDisconnected(): void {
    document.removeEventListener('pointerdown', this.#outsidePointerDown, true);
    this.#anchor = null;
    this.#shown = false;
    this.#restoreFocus = null;
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

    const items = this.#items;
    const index = items.indexOf(event.composedPath()[0] as HTMLElement);
    let next: number | undefined;

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
    items[next]?.focus();
  };

  /** Busca por letra (APG): sem modificadores, Espaço fora; várias letras em 500 ms; sem achar, não move. */
  #typeaheadTarget(event: KeyboardEvent, items: HTMLElement[], index: number): number | undefined {
    if (event.key.length !== 1 || event.key === ' ' || event.ctrlKey || event.altKey || event.metaKey || !items.length) {
      return undefined;
    }

    const panel = this.#panel;
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

  readonly #outsidePointerDown = (event: PointerEvent): void => {
    const opener = this.#anchor?.opener;
    // O botão que abriu (aria-expanded) trata o próprio clique: fecha, não reabre.
    const keep = event.composedPath().some(target =>
      target instanceof HTMLElement
      && (target.classList.contains(this.#panelClass)
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
  /** O item abre um diálogo (seletor de colunas pelo "mais"). */
  hasPopup?: 'dialog';
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
}

/** O menu (sem estado): itens `menuitem` com foco móvel e separadores. */
export const renderMenu = ({ className, part, label, labelledBy, labelLang, entries, onAction, onDisabledAction, onKeyDown }: MenuRenderContext): TemplateResult => html`
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
    ${map(entries, (entry, index) => html`${entry.separatorBefore && index > 0
      ? html`<div class="menu-separator" part="menu-separator" role="separator"></div>`
      : nothing}<button
        class="menu-item group-panel-menu-item"
        part="menu-item"
        type="button"
        role="menuitem"
        tabindex="-1"
        lang=${ifDefined(entry.lang)}
        aria-haspopup=${ifDefined(entry.hasPopup)}
        aria-disabled=${entry.disabled ? 'true' : 'false'}
        @click=${() => {
          if (entry.disabled) {
            onDisabledAction?.(entry.key);
          } else {
            onAction(entry.key);
          }
        }}><span class="menu-item-text">${entry.label}</span>${entry.hiddenSuffix
          ? html`<span class="visually-hidden" lang=${ifDefined(entry.suffixLang)}> ${entry.hiddenSuffix}</span>`
          : nothing}</button>`)}
  </div>`;
