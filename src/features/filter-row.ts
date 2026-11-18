import { html, nothing, type ReactiveController, type ReactiveControllerHost, type TemplateResult } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { live } from 'lit/directives/live.js';
import { map } from 'lit/directives/map.js';

import type {
  GridColumnDataType,
  GridColumnDef,
  GridFilterCondition,
  GridFilterExpression,
  GridFilterOperation,
} from '../grid-column-def.js';
import type { GridI18n } from '../grid-i18n.js';
import { type ColumnFilterKind, findColumnCondition } from '../row-model/filter.js';
import { toDate } from '../row-model/format.js';
import { Debouncer, searchIcon } from './search.js';
import { formatMessage } from './sorting.js';

const TEXT_OPERATIONS: readonly GridFilterOperation[] = ['contains', 'notcontains', 'startswith', 'endswith', '=', '<>'];
const RANGE_OPERATIONS: readonly GridFilterOperation[] = ['=', '<>', '<', '>', '<=', '>=', 'between'];
/** Operações que a linha de filtro não oferece (são do filtro do cabeçalho). */
const HEADER_ONLY = new Set<GridFilterOperation>(['anyof', 'noneof']);
const NO_VALUE = new Set<GridFilterOperation>(['isblank', 'isnotblank']);

const isRangeType = (dataType: GridColumnDataType | undefined): boolean =>
  dataType === 'number' || dataType === 'date' || dataType === 'datetime';

/** Operações do menu (as de `filterOperations` ou as padrão do tipo, como no DevExtreme). */
export const operationsOf = (column: GridColumnDef, dataType: GridColumnDataType | undefined): GridFilterOperation[] => {
  const declared = column.filterOperations?.filter(operation => !HEADER_ONLY.has(operation));

  if (declared?.length) {
    return declared;
  }

  if (dataType === 'boolean') {
    return ['='];
  }

  return [...isRangeType(dataType) ? RANGE_OPERATIONS : TEXT_OPERATIONS];
};

/** Operação inicial do editor: `defaultFilterOperation` (se estiver na lista) ou a do tipo. */
export const defaultOperationOf = (column: GridColumnDef, dataType: GridColumnDataType | undefined): GridFilterOperation => {
  const operations = operationsOf(column, dataType);
  const preferred = column.defaultFilterOperation ?? (isRangeType(dataType) || dataType === 'boolean' ? '=' : 'contains');

  return operations.includes(preferred) ? preferred : operations[0];
};

const pad = (value: number): string => String(value).padStart(2, '0');

/** Valor da condição como texto do editor (data: `aaaa-mm-dd`, o formato do `<input type="date">`). */
const editorText = (value: unknown, dataType: GridColumnDataType | undefined): string => {
  if (value === null || value === undefined) {
    return '';
  }

  if (dataType === 'date' || dataType === 'datetime') {
    const date = toDate(value);
    return date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : '';
  }

  return String(value);
};

/** Texto do editor → valor da condição; `undefined` = vazio/inválido (sem condição). */
const parseEditorText = (text: string, dataType: GridColumnDataType | undefined): unknown => {
  if (text === '') {
    return undefined;
  }

  switch (dataType) {
    case 'number': {
      const numeric = Number(text);
      return Number.isNaN(numeric) ? undefined : numeric;
    }

    case 'boolean':
      return text === 'true' ? true : text === 'false' ? false : undefined;
    default:
      // data/datetime: `aaaa-mm-dd` (compara o dia, também em `datetime`)
      return text;
  }
};

/** Glifo do operador no botão (o nome lido vem do `aria-label`). */
const OPERATION_GLYPHS: Record<GridFilterOperation, string> = {
  '=': '=',
  '<>': '≠',
  '<': '<',
  '<=': '≤',
  '>': '>',
  '>=': '≥',
  contains: '',
  notcontains: '∌',
  startswith: 'a…',
  endswith: '…a',
  between: '↔',
  anyof: '∈',
  noneof: '∉',
  isblank: '∅',
  isnotblank: '≠∅',
};

const OPERATION_KEYS: Record<GridFilterOperation, keyof GridI18n> = {
  '=': 'filterEquals',
  '<>': 'filterNotEquals',
  '<': 'filterLessThan',
  '<=': 'filterLessThanOrEqual',
  '>': 'filterGreaterThan',
  '>=': 'filterGreaterThanOrEqual',
  contains: 'filterContains',
  notcontains: 'filterNotContains',
  startswith: 'filterStartsWith',
  endswith: 'filterEndsWith',
  between: 'filterBetween',
  anyof: 'filterAnyOf',
  noneof: 'filterNoneOf',
  isblank: 'filterIsBlank',
  isnotblank: 'filterIsNotBlank',
};

export const operationName = (operation: GridFilterOperation, translation: GridI18n): string =>
  translation[OPERATION_KEYS[operation]];

const operationGlyph = (operation: GridFilterOperation): TemplateResult | string =>
  operation === 'contains' ? searchIcon : OPERATION_GLYPHS[operation];

export interface FilterRowHost extends ReactiveControllerHost {
  readonly renderRoot: HTMLElement | DocumentFragment;
  readonly filterValue: GridFilterExpression | null;
  _columnDataType(column: GridColumnDef): GridColumnDataType | undefined;
  _userFilterColumn(column: GridColumnDef, kind: ColumnFilterKind | 'all', condition: GridFilterCondition | null): void;
  _isRtl(): boolean;
}

/**
 * Estado da linha de filtro: texto digitado ainda não aplicado (debounce de
 * 300 ms), operação escolhida sem valor e o menu de operação aberto. Tudo
 * por coluna, podado quando as colunas mudam; timers e o listener do menu
 * soltos no `hostDisconnected`.
 */
export class FilterRowController implements ReactiveController {
  readonly #host: FilterRowHost;
  readonly #debouncer: Debouncer<GridColumnDef>;
  readonly #drafts = new Map<GridColumnDef, string[]>();
  readonly #operations = new Map<GridColumnDef, GridFilterOperation>();
  #menuColumn: GridColumnDef | undefined;
  #menuShown = false;
  #restoreFocusTo: GridColumnDef | undefined;

  constructor(host: FilterRowHost) {
    this.#host = host;
    this.#debouncer = new Debouncer(host);
    host.addController(this);
  }

  /** Entradas guardadas por coluna (diagnóstico de memória). */
  get size(): number {
    return this.#drafts.size + this.#operations.size;
  }

  get timers(): number {
    return this.#debouncer.size;
  }

  get menuColumn(): GridColumnDef | undefined {
    return this.#menuColumn;
  }

  /** Solta o estado de colunas que saíram. */
  prune(columns: ReadonlySet<GridColumnDef>): void {
    for (const store of [this.#drafts, this.#operations]) {
      for (const column of store.keys()) {
        if (!columns.has(column)) {
          store.delete(column);
          this.#debouncer.cancel(column);
        }
      }
    }

    if (this.#menuColumn && !columns.has(this.#menuColumn)) {
      this.closeMenu();
    }
  }

  /** Operação atual da coluna: a da condição, a escolhida sem valor ou a padrão. */
  operationOf(column: GridColumnDef): GridFilterOperation {
    const condition = findColumnCondition(this.#host.filterValue, column, 'row');

    return condition?.[0] ?? this.#operations.get(column) ?? defaultOperationOf(column, this.#host._columnDataType(column));
  }

  /** Textos dos editores (dois em `between`). */
  textsOf(column: GridColumnDef): string[] {
    const draft = this.#drafts.get(column);

    if (draft) {
      return draft;
    }

    const condition = findColumnCondition(this.#host.filterValue, column, 'row');
    const dataType = this.#host._columnDataType(column);

    if (!condition) {
      return ['', ''];
    }

    const [operation, value] = condition;

    if (operation === 'between') {
      const [start, end] = Array.isArray(value) ? value as unknown[] : [];
      return [editorText(start, dataType), editorText(end, dataType)];
    }

    return [editorText(value, dataType), ''];
  }

  /** Digitação: guarda o rascunho e aplica 300 ms depois (texto/número). */
  input(column: GridColumnDef, index: number, text: string, immediate: boolean): void {
    const texts = [...this.textsOf(column)];

    texts[index] = text;
    this.#drafts.set(column, texts);

    if (immediate) {
      this.commit(column);
    } else {
      this.#debouncer.run(column, () => this.commit(column));
    }
  }

  /** Aplica o rascunho agora (Enter, `change` de data/booleano, fim do debounce). */
  commit(column: GridColumnDef): void {
    this.#debouncer.cancel(column);

    const texts = this.textsOf(column);

    this.#drafts.delete(column);
    this.#apply(column, this.operationOf(column), texts);
  }

  /** Escolha no menu de operação. */
  selectOperation(column: GridColumnDef, operation: GridFilterOperation | null): void {
    this.closeMenu(true);

    if (!operation) {
      // "Reset": volta à operação padrão e tira a condição.
      this.#debouncer.cancel(column);
      this.#drafts.delete(column);
      this.#operations.delete(column);
      this.#host._userFilterColumn(column, 'row', null);
      this.#host.requestUpdate();
      return;
    }

    const texts = this.textsOf(column);

    this.#debouncer.cancel(column);
    this.#drafts.delete(column);
    this.#operations.set(column, operation);
    this.#apply(column, operation, texts);
    this.#host.requestUpdate();
  }

  #apply(column: GridColumnDef, operation: GridFilterOperation, texts: readonly string[]): void {
    const dataType = this.#host._columnDataType(column);
    const path = column.path!;
    let condition: GridFilterCondition | null = null;

    if (NO_VALUE.has(operation)) {
      condition = [path, operation];
    } else if (operation === 'between') {
      const start = parseEditorText(texts[0] ?? '', dataType);
      const end = parseEditorText(texts[1] ?? '', dataType);

      condition = start === undefined && end === undefined ? null : [path, 'between', [start ?? null, end ?? null]];
    } else {
      const value = parseEditorText(texts[0] ?? '', dataType);

      condition = value === undefined ? null : [path, operation, value];
    }

    // Guarda a operação mesmo sem valor: o botão continua mostrando a escolha.
    if (operation !== defaultOperationOf(column, dataType)) {
      this.#operations.set(column, operation);
    }

    this.#host._userFilterColumn(column, 'row', condition);
  }

  // ------------------------------------------------------------ menu

  toggleMenu(column: GridColumnDef): void {
    if (this.#menuColumn === column) {
      this.closeMenu(true);
      return;
    }

    this.closeMenu();
    this.#menuColumn = column;
    this.#menuShown = false;
    this.#host.requestUpdate();
  }

  closeMenu(restoreFocus = false): void {
    if (!this.#menuColumn) {
      return;
    }

    this.#restoreFocusTo = restoreFocus ? this.#menuColumn : undefined;
    this.#menu?.hidePopover?.();
    this.#menuColumn = undefined;
    document.removeEventListener('pointerdown', this.#outsidePointerDown, true);
    this.#host.requestUpdate();
  }

  get #menu(): HTMLElement | null {
    return this.#host.renderRoot.querySelector<HTMLElement>('.filter-menu');
  }

  #buttonOf(column: GridColumnDef): HTMLElement | null {
    return this.#host.renderRoot.querySelector<HTMLElement>(`.filter-operation-button[data-column="${columnKeyOf(column)}"]`);
  }

  hostUpdated(): void {
    if (!this.#menuColumn) {
      if (this.#restoreFocusTo) {
        this.#buttonOf(this.#restoreFocusTo)?.focus();
        this.#restoreFocusTo = undefined;
      }

      return;
    }

    const menu = this.#menu;

    if (!menu || this.#menuShown) {
      return;
    }

    this.#menuShown = true;

    if (typeof menu.showPopover === 'function' && !menu.matches(':popover-open')) {
      menu.showPopover();
    }

    this.#position(menu, this.#buttonOf(this.#menuColumn));
    document.addEventListener('pointerdown', this.#outsidePointerDown, true);
    (menu.querySelector<HTMLElement>('[aria-checked="true"]') ?? menu.querySelector<HTMLElement>('[role="menuitemradio"]'))?.focus();
  }

  /**
   * Mudança de filtro por API: descarta rascunhos e timers (senão o debounce
   * reaplicaria o texto velho por cima) e as operações escolhidas sem valor.
   */
  discardDrafts(): void {
    this.#debouncer.clear();
    this.#drafts.clear();
    this.#operations.clear();
  }

  hostDisconnected(): void {
    document.removeEventListener('pointerdown', this.#outsidePointerDown, true);
    this.#menuColumn = undefined;
    this.#menuShown = false;
    this.#restoreFocusTo = undefined;
    this.#drafts.clear();
  }

  #position(menu: HTMLElement, anchor: HTMLElement | null): void {
    if (!anchor) {
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const width = menu.offsetWidth;
    const margin = 8;
    const viewport = document.documentElement.clientWidth;
    const left = this.#host._isRtl() ? rect.right - width : rect.left;

    menu.style.top = `${Math.round(rect.bottom + 2)}px`;
    menu.style.left = `${Math.round(Math.max(margin, Math.min(left, viewport - width - margin)))}px`;
  }

  readonly #outsidePointerDown = (event: PointerEvent): void => {
    const keep = event.composedPath().some(target =>
      target instanceof HTMLElement
      && (target.classList.contains('filter-menu') || target.classList.contains('filter-operation-button')));

    if (!keep) {
      this.closeMenu();
    }
  };

  /** Setas/Home/End movem o foco entre os itens; Esc fecha; Tab fecha. */
  readonly onMenuKeyDown = (event: KeyboardEvent): void => {
    const items = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role^="menuitem"]')];
    const current = items.indexOf(event.target as HTMLElement);
    let next = -1;

    switch (event.key) {
      case 'ArrowDown':
        next = (current + 1) % items.length;
        break;
      case 'ArrowUp':
        next = (current - 1 + items.length) % items.length;
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
        this.closeMenu(true);
        return;
      case 'Tab':
        this.closeMenu(true);
        event.preventDefault();
        return;
      default:
        return;
    }

    event.preventDefault();
    items[next]?.focus();
  };
}

let nextColumnKey = 0;
const columnKeys = new WeakMap<GridColumnDef, number>();

/** Chave estável da coluna para achar o botão no DOM. */
export const columnKeyOf = (column: GridColumnDef): number => {
  let key = columnKeys.get(column);

  if (key === undefined) {
    key = nextColumnKey++;
    columnKeys.set(column, key);
  }

  return key;
};

export interface FilterCellContext {
  controller: FilterRowController;
  column: GridColumnDef;
  dataType: GridColumnDataType | undefined;
  filterable: boolean;
  translation: GridI18n;
  className: string;
  style: string;
  colIndex: number;
}

const inputType = (dataType: GridColumnDataType | undefined): 'number' | 'date' | 'text' =>
  dataType === 'number' ? 'number' : dataType === 'date' || dataType === 'datetime' ? 'date' : 'text';

/** Célula da linha de filtro: botão de operação + editor(es) pelo `dataType`. */
export const renderFilterCell = ({
  controller,
  column,
  dataType,
  filterable,
  translation,
  className,
  style,
  colIndex,
}: FilterCellContext): TemplateResult => {

  if (!filterable) {
    return html`<td class="filter-cell ${className}" style=${style} part="filter-cell" role="gridcell" aria-colindex=${colIndex}></td>`;
  }

  const operation = controller.operationOf(column);
  const operations = operationsOf(column, dataType);
  const texts = controller.textsOf(column);
  const label = formatMessage(translation.filterEditorLabel, { column: column.label || column.path || '' });
  const isDate = dataType === 'date' || dataType === 'datetime';
  const open = controller.menuColumn === column;

  const editor = (index: number, ariaLabel: string) => html`
    <input
      class="filter-editor"
      part="filter-editor"
      type=${inputType(dataType)}
      inputmode=${ifDefined(dataType === 'number' ? 'decimal' : undefined)}
      autocomplete="off"
      aria-label=${ariaLabel}
      .value=${live(texts[index] ?? '')}
      @input=${isDate ? nothing : (event: Event) => controller.input(column, index, (event.target as HTMLInputElement).value, false)}
      @change=${isDate ? (event: Event) => controller.input(column, index, (event.target as HTMLInputElement).value, true) : nothing}
      @keydown=${(event: KeyboardEvent) => {
        if (event.key === 'Enter') {
          controller.input(column, index, (event.target as HTMLInputElement).value, true);
        } else if (event.key === 'ArrowDown' && event.altKey && operations.length > 1) {
          event.preventDefault();
          controller.toggleMenu(column);
        }
      }}>`;

  let editors: TemplateResult;

  if (dataType === 'boolean') {
    editors = html`
      <select
        class="filter-editor"
        part="filter-editor"
        aria-label=${label}
        .value=${live(texts[0] ?? '')}
        @change=${(event: Event) => controller.input(column, 0, (event.target as HTMLSelectElement).value, true)}>
        <option value="">${translation.filterAll}</option>
        <option value="true">${translation.trueText}</option>
        <option value="false">${translation.falseText}</option>
      </select>`;
  } else if (operation === 'between') {
    editors = html`
      <span class="filter-between">
        ${editor(0, `${label}, ${translation.filterBetweenStart}`)}
        ${editor(1, `${label}, ${translation.filterBetweenEnd}`)}
      </span>`;
  } else if (NO_VALUE.has(operation)) {
    editors = html`<span class="filter-no-value">${operationName(operation, translation)}</span>`;
  } else {
    editors = editor(0, label);
  }

  const operationLabel = `${translation.filterOperationLabel}: ${operationName(operation, translation)}`;

  return html`
    <td class="filter-cell ${className}" style=${style} part="filter-cell" role="gridcell" aria-colindex=${colIndex}>
      <div class="filter-cell-content">
        ${operations.length > 1
          ? html`
            <button
              class="filter-operation-button"
              part="filter-operation-button"
              type="button"
              data-column=${columnKeyOf(column)}
              aria-haspopup="menu"
              aria-expanded=${open ? 'true' : 'false'}
              aria-label=${operationLabel}
              title=${operationLabel}
              @click=${() => controller.toggleMenu(column)}><span aria-hidden="true">${operationGlyph(operation)}</span></button>`
          : nothing}
        ${editors}
      </div>
    </td>`;
};

/** Menu de operação (popover leve; `menuitemradio` com a atual marcada). */
export const renderFilterMenu = (
  controller: FilterRowController,
  column: GridColumnDef,
  dataType: GridColumnDataType | undefined,
  translation: GridI18n,
): TemplateResult => {
  const current = controller.operationOf(column);

  return html`
    <div
      class="filter-menu"
      .popover=${'manual'}
      role="menu"
      aria-label=${translation.filterOperationLabel}
      @keydown=${controller.onMenuKeyDown}>
      ${map(operationsOf(column, dataType), operation => html`
        <button
          class="filter-menu-item"
          type="button"
          role="menuitemradio"
          tabindex="-1"
          aria-checked=${operation === current ? 'true' : 'false'}
          @click=${() => controller.selectOperation(column, operation)}>
          <span class="filter-menu-glyph" aria-hidden="true">${operationGlyph(operation)}</span>
          <span>${operationName(operation, translation)}</span>
        </button>`)}
      <div class="filter-menu-separator" role="separator"></div>
      <button
        class="filter-menu-item"
        type="button"
        role="menuitem"
        tabindex="-1"
        @click=${() => controller.selectOperation(column, null)}>
        <span class="filter-menu-glyph" aria-hidden="true"></span>
        <span>${translation.filterReset}</span>
      </button>
    </div>`;
};
