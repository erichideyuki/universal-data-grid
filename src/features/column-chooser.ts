import { html, nothing, type ReactiveController, type ReactiveControllerHost, svg, type TemplateResult } from 'lit';
import { live } from 'lit/directives/live.js';
import { repeat } from 'lit/directives/repeat.js';

import type { DropEvent } from '@interactjs/actions/drop/DropEvent';
import interact from 'interactjs';

import type { GridColumnDef, GridColumnFixed } from '../grid-column-def.js';
import type { GridI18n } from '../grid-i18n.js';
import { InteractRegistry } from './drag-helper.js';
import { formatMessage } from './sorting.js';

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
  /** `undefined` = sem botões de fixar (colunas dentro de banda). */
  fixed: GridColumnFixed | undefined;
  /** Colunas da banda, numa lista aninhada. */
  children?: ColumnChooserItem[];
}

export interface ColumnChooserContext {
  items: ColumnChooserItem[];
  translation: GridI18n;
  onVisibleChange: (column: GridColumnDef, visible: boolean) => void;
  onFixedChange: (column: GridColumnDef, fixed: GridColumnFixed) => void;
  onKeyDown: (event: KeyboardEvent) => void;
  /** Tab para fora do painel fecha (não modal; spec 17). */
  onFocusOut?: (event: FocusEvent) => void;
}

const pinStartIcon = svg`<path d="M4 4h2v16H4zM20 11h-9.2l3.6-3.6L13 6l-6 6 6 6 1.4-1.4-3.6-3.6H20z"/>`;
const pinEndIcon = svg`<path d="M18 4h2v16h-2zM4 11h9.2L9.6 7.4 11 6l6 6-6 6-1.4-1.4 3.6-3.6H4z"/>`;

export const columnChooserIcon = html`
  <svg xmlns="http://www.w3.org/2000/svg" height="1em" width="1em" viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd" aria-hidden="true">
    <path d="M3 5h18v14H3zM5 7v10h3.5V7zm5.5 0v10h3V7zm5 0v10H19V7z"/>
  </svg>`;

const pinButton = (
  item: ColumnChooserItem,
  side: 'start' | 'end',
  { translation, onFixedChange }: ColumnChooserContext,
): TemplateResult | typeof nothing => {
  const pressed = item.fixed === side;
  // Nome estável com a coluna (o estado vai no aria-pressed); o tooltip diz a ação (spec 17, A7).
  const label = formatMessage(side === 'start' ? translation.fixStartLabel : translation.fixEndLabel, { column: item.column.label ?? '' });
  const tooltip = side === 'start' ? translation.fixStart : translation.fixEnd;

  return html`
    <button
      class="column-chooser-pin pin-${side}"
      type="button"
      aria-pressed=${pressed ? 'true' : 'false'}
      aria-label=${label}
      title=${pressed ? translation.unfix : tooltip}
      @click=${() => onFixedChange(item.column, pressed ? null : side)}>
      <svg xmlns="http://www.w3.org/2000/svg" height="1em" width="1em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        ${side === 'start' ? pinStartIcon : pinEndIcon}
      </svg>
    </button>`;
};

/**
 * Item do seletor; a banda leva a caixa nativa tri-state (o clique segue a
 * APG: misto → todas visíveis → banda oculta) e as colunas numa lista
 * aninhada com o rótulo da banda.
 */
const renderChooserItems = (items: ColumnChooserItem[], context: ColumnChooserContext): TemplateResult => {
  const { translation, onVisibleChange } = context;

  return html`${repeat(items, item => item.id, item => html`
    <li class="column-chooser-item ${item.children ? 'column-chooser-band' : ''}">
      <label class="column-chooser-check">
        <input
          type="checkbox"
          .checked=${live(item.visible)}
          .indeterminate=${live(!!item.indeterminate)}
          ?disabled=${!item.canToggle}
          title=${item.visible ? translation.hideColumn : translation.showColumn}
          @change=${(event: Event) => onVisibleChange(item.column, (event.target as HTMLInputElement).checked)}>
        <span id="column-chooser-label-${item.id}">${item.column.label ?? ''}</span>
      </label>
      ${item.fixed === undefined ? nothing : pinButton(item, 'start', context)}
      ${item.fixed === undefined ? nothing : pinButton(item, 'end', context)}
      ${item.children
        ? html`<ul class="column-chooser-list column-chooser-nested" aria-labelledby="column-chooser-label-${item.id}">${renderChooserItems(item.children, context)}</ul>`
        : nothing}
    </li>`)}`;
};

/** Painel do seletor de colunas (popover leve, sem dependência nova). */
export const renderColumnChooser = (context: ColumnChooserContext): TemplateResult => {
  const { items, translation, onKeyDown, onFocusOut } = context;

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
      <ul class="column-chooser-list">${renderChooserItems(items, context)}</ul>
      <div class="column-chooser-drop-hint" aria-hidden="true">${translation.hideColumn}</div>
    </div>`;
};

/**
 * Abrir/fechar o seletor: posição junto ao botão (espelhada em RTL), foco no
 * primeiro item, Esc e clique fora fecham. Com o painel aberto, soltar nele
 * um cabeçalho arrastado oculta a coluna.
 */
export class ColumnChooserController implements ReactiveController {
  readonly #host: ColumnChooserHost;
  readonly #dropzones = new InteractRegistry();
  #open = false;
  #shown = false;
  #restoreFocus = false;
  /** Controle focado no painel antes do render (fixar reordena a lista e o `repeat` move o item focado). */
  #focused: { labelId: string; selector: string } | null = null;

  constructor(host: ColumnChooserHost) {
    this.#host = host;
    host.addController(this);
  }

  /** Painéis registrados no interactjs (diagnóstico de memória). */
  get dropzones(): number {
    return this.#dropzones.size;
  }

  get open(): boolean {
    return this.#open;
  }

  show(): void {
    if (this.#open) {
      return;
    }

    this.#open = true;
    this.#shown = false;
    this.#host.requestUpdate();
  }

  hide(restoreFocus = false): void {
    if (!this.#open) {
      return;
    }

    this.#open = false;
    this.#restoreFocus = restoreFocus;
    this.#panel?.hidePopover?.();
    document.removeEventListener('pointerdown', this.#outsidePointerDown, true);
    this.#host.requestUpdate();
  }

  toggle(): void {
    if (this.#open) {
      this.hide(true);
    } else {
      this.show();
    }
  }

  readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
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
    const labelId = active && this.#panel?.contains(active)
      ? active.closest('li')?.querySelector('[id^="column-chooser-label-"]')?.id
      : undefined;

    this.#focused = labelId
      ? { labelId, selector: active!.classList.contains('pin-start') ? '.pin-start' : active!.classList.contains('pin-end') ? '.pin-end' : 'input' }
      : null;
  }

  get #button(): HTMLElement | null {
    return this.#host.renderRoot.querySelector<HTMLElement>('.column-chooser-button');
  }

  hostUpdated(): void {
    this.#dropzones.prune();

    const focused = this.#focused;
    this.#focused = null;

    if (this.#open && focused && !(this.#host.renderRoot as ShadowRoot).activeElement) {
      this.#host.renderRoot.querySelector(`#${focused.labelId}`)?.closest('li')
        ?.querySelector<HTMLElement>(focused.selector)
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
    panel.querySelector<HTMLElement>('input:not([disabled]), button')?.focus();
  }

  hostDisconnected(): void {
    this.#dropzones.clear();
    document.removeEventListener('pointerdown', this.#outsidePointerDown, true);
    this.#open = false;
    this.#shown = false;
  }

  #position(panel: HTMLElement): void {
    const anchor = this.#button ?? (this.#host as unknown as HTMLElement);
    const rect = anchor.getBoundingClientRect();
    const width = panel.offsetWidth;
    const margin = 8;
    const viewport = document.documentElement.clientWidth;
    // Alinha pela borda final do botão: direita em LTR, esquerda em RTL.
    const left = this.#host._isRtl() ? rect.left : rect.right - width;

    panel.style.top = `${Math.round(rect.bottom + 4)}px`;
    panel.style.left = `${Math.round(Math.max(margin, Math.min(left, viewport - width - margin)))}px`;
  }

  readonly #outsidePointerDown = (event: PointerEvent): void => {
    const path = event.composedPath();
    const keep = path.some(target =>
      target instanceof HTMLElement
      && (target.classList.contains('column-chooser')
        || target.classList.contains('column-chooser-button')
        // Arrastar um cabeçalho até o painel não pode fechá-lo.
        || (target.classList.contains('header-column') && this.#host.renderRoot.contains(target))));

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
