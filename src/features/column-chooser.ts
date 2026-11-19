import { html, nothing, type ReactiveController, type ReactiveControllerHost, type TemplateResult } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { live } from 'lit/directives/live.js';
import { repeat } from 'lit/directives/repeat.js';

import type { DropEvent } from '@interactjs/actions/drop/DropEvent';
import interact from 'interactjs';

import type { GridColumnDef } from '../grid-column-def.js';
import type { GridI18n } from '../grid-i18n.js';
import { InteractRegistry } from './drag-helper.js';
import { formatMessage } from './sorting.js';

/**
 * Seletor de colunas (como o do AG Grid): `dialog` não modal com busca,
 * "Mostrar todas" (caixa nativa com `.indeterminate`) e a lista de caixas
 * nativas (`ul`, não `listbox`). Reordenar: alça de arrasto por item (só
 * ponteiro, `aria-hidden`) e Alt+Shift+↑/↓ na caixa focada. Fixar saiu
 * daqui: vai pelo menu do cabeçalho (coluna oculta só fixa depois de
 * mostrada, como no AG Grid).
 */

export interface ColumnChooserHost extends ReactiveControllerHost {
  readonly renderRoot: HTMLElement | DocumentFragment;
  readonly _nativeColumnMap: WeakMap<HTMLElement, GridColumnDef>;
  _isRtl(): boolean;
  /** Oculta a coluna (se não for a última visível); devolve se ocultou. */
  _userSetVisible(column: GridColumnDef, visible: boolean): boolean;
  _isRegularColumn(column: GridColumnDef): boolean;
}

export interface ColumnChooserItem {
  column: GridColumnDef;
  id: number;
  /** Estado efetivo (banda oculta = desmarcada); na banda, todas as colunas visíveis. */
  visible: boolean;
  /** Banda com só parte das colunas visíveis (caixa mista, frente 13). */
  indeterminate?: boolean;
  /** `false` na última coluna visível (não pode ser ocultada). */
  canToggle: boolean;
  /** Colunas da banda, numa lista aninhada. */
  children?: ColumnChooserItem[];
  /** Oculta por falta de espaço (spec 21; banda: todas as folhas visíveis): dica sob o rótulo. */
  adaptive?: boolean;
}

export interface ColumnChooserContext {
  items: ColumnChooserItem[];
  translation: GridI18n;
  /** Texto da busca (o controlador guarda). */
  search: string;
  onSearch: (text: string) => void;
  onVisibleChange: (column: GridColumnDef, visible: boolean) => void;
  /** "Mostrar todas": aplica a todas as colunas listadas (as achadas pela busca). */
  onVisibleChangeAll: (columns: GridColumnDef[], visible: boolean) => void;
  /** Mover `column` para antes/depois de `target` (irmã listada); devolve se moveu. */
  onMove: (column: GridColumnDef, target: GridColumnDef, after: boolean, keyboard: boolean) => boolean;
  /** Começo do arrasto pela alça. */
  onDragStart: (event: PointerEvent, column: GridColumnDef) => void;
  onKeyDown: (event: KeyboardEvent) => void;
  /** Tab para fora do painel fecha (não modal; spec 17). */
  onFocusOut?: (event: FocusEvent) => void;
}

/** Texto comparável da busca: sem diacríticos, sem caixa. */
const fold = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '')
  .toLowerCase()
  .trim();

/** Itens que batem com a busca: a banda que bate leva todas as colunas; senão, só as filhas que batem. */
export const filterChooserItems = (items: ColumnChooserItem[], search: string): ColumnChooserItem[] => {
  const query = fold(search);

  if (!query) {
    return items;
  }

  return items.flatMap(item => {
    if (fold(item.column.label ?? '').includes(query)) {
      return [item];
    }

    const children = item.children ? filterChooserItems(item.children, search) : [];
    return children.length ? [{ ...item, children }] : [];
  });
};

/** Quantas entradas (bandas e colunas) a lista mostra. */
export const countChooserItems = (items: ColumnChooserItem[]): number =>
  items.reduce((count, item) => count + 1 + (item.children ? countChooserItems(item.children) : 0), 0);

const dragHandle = html`
  <svg xmlns="http://www.w3.org/2000/svg" height="1em" width="1em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/>
  </svg>`;

export const columnChooserIcon = html`
  <svg xmlns="http://www.w3.org/2000/svg" height="1em" width="1em" viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd" aria-hidden="true">
    <path d="M3 5h18v14H3zM5 7v10h3.5V7zm5.5 0v10h3V7zm5 0v10H19V7z"/>
  </svg>`;

const REORDER_HINT_ID = 'column-chooser-reorder-hint';

/**
 * Itens do seletor; a banda leva a caixa nativa tri-state (o clique segue a
 * APG: misto → todas visíveis → banda oculta) e as colunas numa lista
 * aninhada com o rótulo da banda.
 */
const renderChooserItems = (items: ColumnChooserItem[], context: ColumnChooserContext): TemplateResult => {
  const { translation, onVisibleChange, onMove, onDragStart } = context;
  // Mover só faz sentido com uma irmã listada.
  const movable = items.length > 1;

  return html`${repeat(items, item => item.id, (item, index) => {
    const describedBy = [
      ...item.adaptive ? [`column-chooser-title-${item.id}`, `column-chooser-hint-${item.id}`] : [],
      ...movable ? [REORDER_HINT_ID] : [],
    ].join(' ');

    return html`
      <li class="column-chooser-item ${item.children ? 'column-chooser-band' : ''} ${item.adaptive ? 'column-chooser-adaptive' : ''}" data-column-id=${item.id}>
        <div class="column-chooser-row">
          ${movable
            ? html`<span
              class="column-chooser-drag-handle"
              aria-hidden="true"
              @pointerdown=${(event: PointerEvent) => onDragStart(event, item.column)}>${dragHandle}</span>`
            : nothing}
          <label class="column-chooser-check">
            <input
              type="checkbox"
              .checked=${live(item.visible)}
              .indeterminate=${live(!!item.indeterminate)}
              ?disabled=${!item.canToggle}
              title=${item.visible ? translation.hideColumn : translation.showColumn}
              aria-describedby=${ifDefined(describedBy || undefined)}
              aria-keyshortcuts=${ifDefined(movable ? 'Alt+Shift+ArrowUp Alt+Shift+ArrowDown' : undefined)}
              @keydown=${(event: KeyboardEvent) => {
                const up = event.key === 'ArrowUp';

                if (!movable || !event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey || (!up && event.key !== 'ArrowDown')) {
                  return;
                }

                event.preventDefault();
                const target = items[index + (up ? -1 : 1)];

                if (target) {
                  onMove(item.column, target.column, !up, true);
                }
              }}
              @change=${(event: Event) => onVisibleChange(item.column, (event.target as HTMLInputElement).checked)}>
            <span id="column-chooser-label-${item.id}">${item.column.label ?? ''}</span>
          </label>
        </div>
        ${item.adaptive
          // A descrição que o `title` dava ("Hide column") continua, junto da dica.
          ? html`<span hidden id="column-chooser-title-${item.id}">${item.visible ? translation.hideColumn : translation.showColumn}</span><span
              class="column-chooser-hint"
              id="column-chooser-hint-${item.id}">${translation.adaptiveColumnDescription}</span>`
          : nothing}
        ${item.children?.length
          ? html`<ul class="column-chooser-list column-chooser-nested" aria-labelledby="column-chooser-label-${item.id}">${renderChooserItems(item.children, context)}</ul>`
          : nothing}
      </li>`;
  })}`;
};

/** Estado da caixa "Mostrar todas" sobre as entradas de cima listadas. */
const allState = (items: ColumnChooserItem[]): { checked: boolean; indeterminate: boolean } => {
  const visible = items.filter(item => item.visible).length;
  const mixed = items.some(item => item.indeterminate);

  return { checked: visible === items.length && !mixed, indeterminate: mixed || (visible > 0 && visible < items.length) };
};

/** Painel do seletor de colunas (popover leve, sem dependência nova). */
export const renderColumnChooser = (context: ColumnChooserContext): TemplateResult => {
  const { items, translation, search, onSearch, onVisibleChangeAll, onKeyDown, onFocusOut } = context;
  const shown = filterChooserItems(items, search);
  const all = allState(shown);

  return html`
    <div
      class="column-chooser"
      part="column-chooser"
      .popover=${'manual'}
      role="dialog"
      aria-label=${translation.columnChooser}
      @keydown=${onKeyDown}
      @focusout=${onFocusOut}>
      <div class="column-chooser-title" aria-hidden="true">${translation.columnChooser}</div>
      <input
        class="column-chooser-search"
        type="search"
        autocomplete="off"
        .value=${live(search)}
        aria-label=${translation.columnChooserSearchLabel}
        placeholder=${translation.columnChooserSearchLabel}
        @input=${(event: Event) => onSearch((event.target as HTMLInputElement).value)}>
      ${shown.length
        ? html`<label class="column-chooser-check column-chooser-all">
            <input
              type="checkbox"
              .checked=${live(all.checked)}
              .indeterminate=${live(all.indeterminate)}
              @change=${(event: Event) => onVisibleChangeAll(shown.map(item => item.column), (event.target as HTMLInputElement).checked)}>
            <span>${translation.selectAllColumns}</span>
          </label>`
        : nothing}
      <ul class="column-chooser-list">${renderChooserItems(shown, context)}</ul>
      <span hidden id=${REORDER_HINT_ID}>${translation.reorderColumnLabel}</span>
      <div class="column-chooser-drop-hint" aria-hidden="true">${translation.hideColumn}</div>
    </div>`;
};

/** Espera da busca antes de anunciar quantas colunas achou. */
const SEARCH_ANNOUNCE_MS = 500;

interface ChooserDrag {
  column: GridColumnDef;
  /** Solta: `column` antes/depois do item `targetId` (`data-column-id`). */
  onDrop: (targetId: string, after: boolean) => void;
  handle: HTMLElement;
  pointerId: number;
  /** Item sob o ponteiro e o lado (antes/depois). */
  target: { li: HTMLElement; after: boolean } | null;
}

/**
 * Abrir/fechar o seletor: posição junto ao botão (espelhada em RTL), foco na
 * busca, Esc e clique fora fecham. Com o painel aberto, soltar nele um
 * cabeçalho arrastado oculta a coluna. A busca anuncia a contagem (com
 * espera) e o arrasto pela alça reordena; timer e listeners do arrasto saem
 * ao fechar e no `hostDisconnected` (spec 14).
 */
export class ColumnChooserController implements ReactiveController {
  readonly #host: ColumnChooserHost;
  readonly #dropzones = new InteractRegistry();
  #open = false;
  #shown = false;
  #restoreFocus = false;
  /** Caixa focada no painel antes do render (reordenar move o item focado no `repeat`). */
  #focused: { labelId: string } | null = null;
  #anchor: HTMLElement | null = null;
  #search = '';
  #searchTimer: ReturnType<typeof setTimeout> | undefined;
  #drag: ChooserDrag | null = null;

  constructor(host: ColumnChooserHost) {
    this.#host = host;
    host.addController(this);
  }

  /** Painéis registrados no interactjs (diagnóstico de memória). */
  get dropzones(): number {
    return this.#dropzones.size;
  }

  /** Timer do anúncio da busca e arrasto em curso (diagnóstico de memória). */
  get timers(): number {
    return (this.#searchTimer === undefined ? 0 : 1) + (this.#drag ? 1 : 0);
  }

  get open(): boolean {
    return this.#open;
  }

  get search(): string {
    return this.#search;
  }

  /** Abre; `anchor` = quem abriu (o botão da barra, o "mais" ou a célula do cabeçalho). */
  show(anchor: HTMLElement | null = null): void {
    if (this.#open) {
      return;
    }

    this.#anchor = anchor;
    this.#open = true;
    this.#shown = false;
    this.#search = '';
    this.#host.requestUpdate();
  }

  hide(restoreFocus = false): void {
    if (!this.#open) {
      return;
    }

    this.#open = false;
    this.#restoreFocus = restoreFocus;
    this.#clearSearchTimer();
    this.#endDrag();
    this.#panel?.hidePopover?.();
    document.removeEventListener('pointerdown', this.#outsidePointerDown, true);
    this.#host.requestUpdate();
  }

  toggle(anchor: HTMLElement | null = null): void {
    if (this.#open) {
      this.hide(true);
    } else {
      this.show(anchor);
    }
  }

  /** Texto da busca mudou: filtra já e, depois da espera, `announce` diz a contagem (região viva do grid). */
  setSearch(text: string, announce: () => void): void {
    this.#search = text;
    this.#host.requestUpdate();
    this.#clearSearchTimer();
    this.#searchTimer = setTimeout(() => {
      this.#searchTimer = undefined;

      if (this.#open) {
        announce();
      }
    }, SEARCH_ANNOUNCE_MS);
  }

  readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();

      // Arrasto em curso: Esc só desiste dele.
      if (this.#drag) {
        this.#endDrag();
        return;
      }

      this.hide(true);
    }
  };

  /** O foco saiu do painel para outro lugar (Tab, Shift+Tab): fecha sem roubar o foco. */
  readonly onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget;

    // Sem destino: elemento movido/removido pelo render ou clique fora (tratado no pointerdown).
    if (!(next instanceof Node) || this.#panel?.contains(next) || this.#button?.contains(next)) {
      return;
    }

    this.hide();
  };

  get #panel(): HTMLElement | null {
    return this.#host.renderRoot.querySelector<HTMLElement>('.column-chooser');
  }

  hostUpdate(): void {
    const root = this.#host.renderRoot as ShadowRoot;
    const active = root.activeElement as HTMLElement | null;
    const labelId = active && this.#panel?.contains(active) && active.closest('.column-chooser-item')
      ? active.closest('li')?.querySelector('[id^="column-chooser-label-"]')?.id
      : undefined;

    this.#focused = labelId ? { labelId } : null;
  }

  /** Quem abriu (ou o botão do seletor na barra): âncora da posição e destino do foco ao fechar. */
  get #button(): HTMLElement | null {
    return (this.#anchor?.isConnected ? this.#anchor : null)
      ?? this.#host.renderRoot.querySelector<HTMLElement>('.column-chooser-button')
      ?? this.#host.renderRoot.querySelector<HTMLElement>('.toolbar-more-button');
  }

  hostUpdated(): void {
    this.#dropzones.prune();

    const focused = this.#focused;
    this.#focused = null;

    if (this.#open && focused && !(this.#host.renderRoot as ShadowRoot).activeElement) {
      this.#host.renderRoot.querySelector(`#${focused.labelId}`)?.closest('li')
        ?.querySelector<HTMLElement>('input')
        ?.focus();
    }

    if (!this.#open) {
      if (this.#restoreFocus) {
        this.#restoreFocus = false;
        this.#button?.focus();
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

    this.#position(panel);
    this.#attachDropzone(panel);
    document.addEventListener('pointerdown', this.#outsidePointerDown, true);
    panel.querySelector<HTMLElement>('.column-chooser-search, input:not([disabled]), button')?.focus();
  }

  hostDisconnected(): void {
    this.#anchor = null;
    this.#dropzones.clear();
    this.#clearSearchTimer();
    this.#endDrag();
    document.removeEventListener('pointerdown', this.#outsidePointerDown, true);
    this.#open = false;
    this.#shown = false;
  }

  #clearSearchTimer(): void {
    clearTimeout(this.#searchTimer);
    this.#searchTimer = undefined;
  }

  // -------------------------------------------- arrasto pela alça (reordenar)

  /** `pointerdown` na alça: captura o ponteiro e acompanha até soltar. */
  readonly startDrag = (event: PointerEvent, column: GridColumnDef, onDrop: (targetId: string, after: boolean) => void): void => {
    if (event.button !== 0 || !event.isPrimary) {
      return;
    }

    event.preventDefault();
    this.#endDrag();
    const handle = event.currentTarget as HTMLElement;
    this.#drag = { column, onDrop, handle, pointerId: event.pointerId, target: null };

    try {
      handle.setPointerCapture?.(event.pointerId);
    } catch {
      // Ponteiro que já não está ativo (sintético): segue sem captura.
    }

    handle.closest('li')?.classList.add('dragging');
    handle.addEventListener('pointermove', this.#onDragMove);
    handle.addEventListener('pointerup', this.#onDragEnd);
    handle.addEventListener('pointercancel', this.#onDragCancel);
    handle.addEventListener('lostpointercapture', this.#onDragCancel);
  };

  readonly #onDragMove = (event: PointerEvent): void => {
    const drag = this.#drag;

    if (drag?.pointerId !== event.pointerId) {
      return;
    }

    const source = drag.handle.closest('li');
    const list = source?.parentElement;
    // Só entre as irmãs da mesma lista (a coluna de banda não sai dela).
    const siblings = [...list?.children ?? []].filter((child): child is HTMLElement => child instanceof HTMLElement && child.tagName === 'LI');
    let target: ChooserDrag['target'] = null;

    for (const li of siblings) {
      const rect = li.getBoundingClientRect();

      if (event.clientY < rect.bottom || li === siblings[siblings.length - 1]) {
        target = li === source ? null : { li, after: event.clientY > rect.top + rect.height / 2 };
        break;
      }
    }

    this.#markTarget(target);
  };

  readonly #onDragEnd = (event: PointerEvent): void => {
    const drag = this.#drag;

    if (drag?.pointerId !== event.pointerId) {
      return;
    }

    const target = drag.target;
    const id = target?.li.getAttribute('data-column-id') ?? undefined;
    this.#endDrag();

    if (target && id !== undefined) {
      drag.onDrop(id, target.after);
    }
  };

  readonly #onDragCancel = (): void => {
    this.#endDrag();
  };

  #markTarget(target: ChooserDrag['target']): void {
    const drag = this.#drag;

    if (!drag) {
      return;
    }

    drag.target?.li.classList.remove('drop-before', 'drop-after');
    drag.target = target;
    target?.li.classList.add(target.after ? 'drop-after' : 'drop-before');
  }

  #endDrag(): void {
    const drag = this.#drag;

    if (!drag) {
      return;
    }

    this.#drag = null;
    drag.target?.li.classList.remove('drop-before', 'drop-after');
    drag.handle.closest('li')?.classList.remove('dragging');
    drag.handle.removeEventListener('pointermove', this.#onDragMove);
    drag.handle.removeEventListener('pointerup', this.#onDragEnd);
    drag.handle.removeEventListener('pointercancel', this.#onDragCancel);
    drag.handle.removeEventListener('lostpointercapture', this.#onDragCancel);

    if (drag.handle.hasPointerCapture?.(drag.pointerId)) {
      drag.handle.releasePointerCapture(drag.pointerId);
    }
  }

  #position(panel: HTMLElement): void {
    const anchor = this.#button ?? (this.#host as unknown as HTMLElement);
    const rect = anchor.getBoundingClientRect();
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const margin = 8;
    const viewport = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    // Alinha pela borda final de quem abriu: direita em LTR, esquerda em RTL.
    const left = this.#host._isRtl() ? rect.left : rect.right - width;
    const top = rect.bottom + 4;

    panel.style.top = `${Math.round(Math.max(margin, Math.min(top, viewportHeight - height - margin)))}px`;
    panel.style.left = `${Math.round(Math.max(margin, Math.min(left, viewport - width - margin)))}px`;
  }

  readonly #outsidePointerDown = (event: PointerEvent): void => {
    const path = event.composedPath();
    const keep = path.some(target =>
      target instanceof HTMLElement
      && (target.classList.contains('column-chooser')
        || target.classList.contains('column-chooser-button')
        || target === this.#anchor
        // Arrastar um cabeçalho até o painel não pode fechá-lo.
        || ((target.classList.contains('header-column') || target.classList.contains('band-header')) && this.#host.renderRoot.contains(target))));

    if (!keep) {
      this.hide();
    }
  };

  #attachDropzone(panel: HTMLElement): void {
    if (!this.#dropzones.add(panel)) {
      return;
    }

    interact(panel).dropzone({
      accept: '.move-container',

      ondragenter: (event: DropEvent) => {
        if (this.#draggedRegularColumn(event)) {
          panel.classList.add('drop-target');
        }
      },

      ondragleave: () => panel.classList.remove('drop-target'),
      ondropdeactivate: () => panel.classList.remove('drop-target'),

      ondrop: (event: DropEvent) => {
        const column = this.#draggedRegularColumn(event);

        if (column) {
          this.#host._userSetVisible(column, false);
        }
      },
    });
  }

  #draggedRegularColumn(event: DropEvent): GridColumnDef | undefined {
    const column = this.#host._nativeColumnMap.get(event.draggable.target as HTMLElement);
    return column && this.#host._isRegularColumn(column) ? column : undefined;
  }
}

/** Texto da contagem da busca (o grid anuncia). */
export const chooserSearchAnnouncement = (translation: GridI18n, count: number): string =>
  formatMessage(translation.columnChooserSearchAnnouncement, { count: String(count) });
