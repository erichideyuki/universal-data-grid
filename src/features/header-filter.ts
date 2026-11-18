import { html, nothing, type ReactiveController, type ReactiveControllerHost, type TemplateResult } from 'lit';
import { live } from 'lit/directives/live.js';
import { map } from 'lit/directives/map.js';

import type {
  GridColumnDef,
  GridFilterCondition,
  GridFilterExpression,
} from '../grid-column-def.js';
import type { GridI18n } from '../grid-i18n.js';
import type { DistinctDateNode, DistinctValue, DistinctValues } from '../row-model/distinct.js';
import { type ColumnFilterKind, findColumnCondition, hasColumnCondition } from '../row-model/filter.js';
import { createTextMatcher } from '../row-model/fold.js';
import { columnKeyOf } from './filter-row.js';
import { formatMessage } from './sorting.js';

/** Itens desenhados na lista plana; acima disso, a busca do popover estreita. */
export const HEADER_FILTER_RENDER_LIMIT = 500;

const BLANK_KEY = '\u0000blank';

/** Chave de um valor distinto no conjunto de marcados. */
const keyOf = (value: unknown): string =>
  value === null || value === undefined ? BLANK_KEY : `${typeof value}:${String(value)}`;

export interface HeaderFilterHost extends ReactiveControllerHost {
  readonly renderRoot: HTMLElement | DocumentFragment;
  readonly filterValue: GridFilterExpression | null;
  _distinctValues(column: GridColumnDef): DistinctValues;
  _userFilterColumn(column: GridColumnDef, kind: ColumnFilterKind | 'all', condition: GridFilterCondition | null): void;
  _isRtl(): boolean;
}

interface OpenState {
  column: GridColumnDef;
  distinct: DistinctValues;
  /** Todos os valores (vazio = `null`), na ordem da lista. */
  all: unknown[];
  selected: Set<string>;
  search: string;
  expanded: Set<string>;
}

/**
 * Popover do filtro do cabeçalho: valores distintos (com contagem), busca,
 * "selecionar tudo", datas em ano → mês → dia. OK aplica `anyof`/`noneof`
 * (o menor dos dois); Cancelar, Esc e clique fora fecham sem aplicar. Foco
 * preso no popover e devolvido ao botão do funil. O estado (valores, listener
 * do documento) é solto ao fechar e no `hostDisconnected`.
 */
export class HeaderFilterController implements ReactiveController {
  readonly #host: HeaderFilterHost;
  #state: OpenState | undefined;
  #shown = false;
  #restoreFocusTo: GridColumnDef | undefined;

  constructor(host: HeaderFilterHost) {
    this.#host = host;
    host.addController(this);
  }

  get open(): boolean {
    return !!this.#state;
  }

  get column(): GridColumnDef | undefined {
    return this.#state?.column;
  }

  get state(): Readonly<OpenState> | undefined {
    return this.#state;
  }

  toggle(column: GridColumnDef): void {
    if (this.#state?.column === column) {
      this.close(true);
      return;
    }

    this.close();

    const distinct = this.#host._distinctValues(column);
    const all = [...distinct.blanks ? [null] : [], ...distinct.values.map(value => value.value)];
    const condition = findColumnCondition(this.#host.filterValue, column, 'header');
    const listed = new Set((Array.isArray(condition?.[1]) ? condition[1] as unknown[] : []).map(keyOf));
    const selected = new Set<string>();

    for (const value of all) {
      const key = keyOf(value);
      const inList = listed.has(key);

      if (!condition || (condition[0] === 'anyof' ? inList : !inList)) {
        selected.add(key);
      }
    }

    this.#state = { column, distinct, all, selected, search: '', expanded: new Set() };
    this.#shown = false;
    this.#host.requestUpdate();
  }

  close(restoreFocus = false): void {
    if (!this.#state) {
      return;
    }

    this.#restoreFocusTo = restoreFocus ? this.#state.column : undefined;
    this.#popover?.hidePopover?.();
    this.#state = undefined;
    document.removeEventListener('pointerdown', this.#outsidePointerDown, true);
    this.#host.requestUpdate();
  }

  /** A coluna do popover saiu das definições: fecha (não segura a coluna). */
  closeIfRemoved(columns: ReadonlySet<GridColumnDef>): void {
    if (this.#state && !columns.has(this.#state.column)) {
      this.close();
    }
  }

  /** Marca/desmarca valores (folhas). */
  setSelected(values: readonly unknown[], selected: boolean): void {
    const state = this.#state;

    if (!state) {
      return;
    }

    for (const value of values) {
      if (selected) {
        state.selected.add(keyOf(value));
      } else {
        state.selected.delete(keyOf(value));
      }
    }

    this.#host.requestUpdate();
  }

  isSelected(value: unknown): boolean {
    return !!this.#state?.selected.has(keyOf(value));
  }

  /** `true`/`false`/`'mixed'` de um grupo de valores (ano, mês, "selecionar tudo"). */
  stateOf(values: readonly unknown[]): boolean | 'mixed' {
    let checked = 0;

    for (const value of values) {
      if (this.isSelected(value)) {
        checked++;
      }
    }

    return checked === 0 ? false : checked === values.length ? true : 'mixed';
  }

  setSearch(text: string): void {
    if (this.#state) {
      this.#state.search = text;
      this.#host.requestUpdate();
    }
  }

  toggleExpanded(key: string): void {
    const expanded = this.#state?.expanded;

    if (!expanded) {
      return;
    }

    if (!expanded.delete(key)) {
      expanded.add(key);
    }

    this.#host.requestUpdate();
  }

  /** Valores que a busca do popover deixa ver (texto exibido, sem caixa/acento). */
  visibleValues(): DistinctValue[] {
    const state = this.#state;

    if (!state) {
      return [];
    }

    const matcher = createTextMatcher(state.search);

    return matcher ? state.distinct.values.filter(value => matcher.test(value.text)) : state.distinct.values;
  }

  /** OK: todos marcados tira a condição; senão o menor entre `anyof` e `noneof`. */
  apply(): void {
    const state = this.#state;

    if (!state) {
      return;
    }

    const { column, all, selected } = state;
    const checked = all.filter(value => selected.has(keyOf(value)));
    const unchecked = all.filter(value => !selected.has(keyOf(value)));
    let condition: GridFilterCondition | null = null;

    if (unchecked.length) {
      condition = checked.length <= unchecked.length
        ? [column.path!, 'anyof', checked]
        : [column.path!, 'noneof', unchecked];
    }

    this.close(true);
    this.#host._userFilterColumn(column, 'header', condition);
  }

  /** "Limpar filtro": tira todas as condições da coluna (linha e cabeçalho). */
  clearColumn(): void {
    const column = this.#state?.column;

    if (column) {
      this.close(true);
      this.#host._userFilterColumn(column, 'all', null);
    }
  }

  get #popover(): HTMLElement | null {
    return this.#host.renderRoot.querySelector<HTMLElement>('.header-filter');
  }

  #buttonOf(column: GridColumnDef): HTMLElement | null {
    return this.#host.renderRoot.querySelector<HTMLElement>(`.header-filter-button[data-column="${columnKeyOf(column)}"]`);
  }

  hostUpdated(): void {
    if (!this.#state) {
      if (this.#restoreFocusTo) {
        this.#buttonOf(this.#restoreFocusTo)?.focus();
        this.#restoreFocusTo = undefined;
      }

      return;
    }

    const popover = this.#popover;

    if (!popover || this.#shown) {
      return;
    }

    this.#shown = true;

    if (typeof popover.showPopover === 'function' && !popover.matches(':popover-open')) {
      popover.showPopover();
    }

    this.#position(popover, this.#buttonOf(this.#state.column));
    document.addEventListener('pointerdown', this.#outsidePointerDown, true);
    popover.querySelector<HTMLElement>('.header-filter-search')?.focus();
  }

  hostDisconnected(): void {
    document.removeEventListener('pointerdown', this.#outsidePointerDown, true);
    this.#state = undefined;
    this.#shown = false;
    this.#restoreFocusTo = undefined;
  }

  #position(popover: HTMLElement, anchor: HTMLElement | null): void {
    if (!anchor) {
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const width = popover.offsetWidth;
    const margin = 8;
    const viewport = document.documentElement.clientWidth;
    // Abre para dentro da tabela: da borda final do botão em LTR, inicial em RTL.
    const left = this.#host._isRtl() ? rect.left : rect.right - width;

    popover.style.top = `${Math.round(rect.bottom + 4)}px`;
    popover.style.left = `${Math.round(Math.max(margin, Math.min(left, viewport - width - margin)))}px`;
  }

  readonly #outsidePointerDown = (event: PointerEvent): void => {
    const keep = event.composedPath().some(target =>
      target instanceof HTMLElement
      && (target.classList.contains('header-filter') || target.classList.contains('header-filter-button')));

    if (!keep) {
      this.close();
    }
  };

  /** Esc cancela; Tab circula dentro do popover (foco preso). */
  readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close(true);
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const popover = event.currentTarget as HTMLElement;
    const focusable = [...popover.querySelectorAll<HTMLElement>('input, button, [tabindex="0"]')]
      .filter(element => !element.hasAttribute('disabled'));
    const root = popover.getRootNode() as Document | ShadowRoot;
    const active = root.activeElement;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first?.focus();
    }
  };
}

const funnelIcon = html`
  <svg xmlns="http://www.w3.org/2000/svg" height="1em" width="1em" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
    <path d="M400-240v-80h160v80H400ZM240-440v-80h480v80H240ZM120-640v-80h720v80H120Z"/>
  </svg>`;

/** Botão de funil no cabeçalho; ativo quando a coluna tem alguma condição. */
export const renderHeaderFilterButton = (
  controller: HeaderFilterController,
  column: GridColumnDef,
  filterValue: GridFilterExpression | null,
  translation: GridI18n,
): TemplateResult => {
  const active = hasColumnCondition(filterValue, column);
  const label = formatMessage(translation.headerFilterLabel, { column: column.label || column.path || '' });

  return html`
    <button
      class="header-filter-button ${active ? 'active' : ''}"
      part="header-filter-button"
      type="button"
      aria-label=${label}
      title=${label}
      aria-haspopup="dialog"
      aria-expanded=${controller.column === column ? 'true' : 'false'}
      data-column=${columnKeyOf(column)}
      @pointerdown=${(event: PointerEvent) => event.stopPropagation()}
      @click=${(event: MouseEvent) => {
        event.stopPropagation();
        controller.toggle(column);
      }}
      @keydown=${(event: KeyboardEvent) => {
        // Enter/Espaço no funil não podem ordenar a coluna.
        if (event.key === 'Enter' || event.key === ' ') {
          event.stopPropagation();
        }
      }}>${funnelIcon}</button>`;
};

const checkbox = (
  state: boolean | 'mixed',
  label: string,
  count: number | undefined,
  onChange: (checked: boolean) => void,
): TemplateResult => html`
  <label class="header-filter-check">
    <input
      type="checkbox"
      .checked=${live(state === true)}
      .indeterminate=${live(state === 'mixed')}
      @change=${(event: Event) => onChange((event.target as HTMLInputElement).checked)}>
    <span class="header-filter-text">${label}</span>
    ${count === undefined ? nothing : html`<span class="header-filter-count">${count}</span>`}
  </label>`;

const leavesOf = (node: DistinctDateNode | DistinctValue): unknown[] =>
  'children' in node ? node.children.flatMap(leavesOf) : [node.value];

const renderDateNode = (controller: HeaderFilterController, node: DistinctDateNode | DistinctValue, level: number, translation: GridI18n): TemplateResult => {
  if (!('children' in node)) {
    return html`
      <li class="header-filter-item" style="--_level: ${level}">
        ${checkbox(controller.isSelected(node.value), node.text, node.count, checked => controller.setSelected([node.value], checked))}
      </li>`;
  }

  const expanded = !!controller.state?.expanded.has(node.key);
  const leaves = leavesOf(node);

  return html`
    <li class="header-filter-item" style="--_level: ${level}">
      <button
        class="header-filter-expand ${expanded ? 'expanded' : ''}"
        type="button"
        aria-expanded=${expanded ? 'true' : 'false'}
        aria-label=${node.text}
        @click=${() => controller.toggleExpanded(node.key)}>
        <svg xmlns="http://www.w3.org/2000/svg" height="1em" width="1em" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
          <path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"/>
        </svg>
      </button>
      ${checkbox(controller.stateOf(leaves), node.text, node.count, checked => controller.setSelected(leaves, checked))}
    </li>
    ${expanded ? map(node.children, child => renderDateNode(controller, child, level + 1, translation)) : nothing}`;
};

/** O popover (quando aberto). */
export const renderHeaderFilter = (controller: HeaderFilterController, translation: GridI18n): TemplateResult | typeof nothing => {
  const state = controller.state;

  if (!state) {
    return nothing;
  }

  const { distinct, column } = state;
  const searching = !!state.search.trim();
  const useTree = !!distinct.tree && !searching;
  const visible = controller.visibleValues();
  const shown = visible.slice(0, HEADER_FILTER_RENDER_LIMIT);
  const blankVisible = distinct.blanks > 0 && !searching;
  const scope = [...blankVisible ? [null] : [], ...visible.map(value => value.value)];
  const title = formatMessage(translation.headerFilterLabel, { column: column.label || column.path || '' });

  return html`
    <div
      class="header-filter"
      part="header-filter"
      .popover=${'manual'}
      role="dialog"
      aria-modal="true"
      aria-label=${title}
      @keydown=${controller.onKeyDown}>
      <input
        class="header-filter-search"
        type="search"
        autocomplete="off"
        placeholder=${translation.searchPlaceholder}
        aria-label=${translation.searchPlaceholder}
        .value=${live(state.search)}
        @input=${(event: Event) => controller.setSearch((event.target as HTMLInputElement).value)}>
      <div class="header-filter-select-all">
        ${checkbox(controller.stateOf(scope), translation.selectAll, undefined, checked => controller.setSelected(scope, checked))}
      </div>
      <ul class="header-filter-list">
        ${blankVisible
          ? html`<li class="header-filter-item">${checkbox(controller.isSelected(null), translation.filterBlanks, distinct.blanks, checked => controller.setSelected([null], checked))}</li>`
          : nothing}
        ${useTree
          ? map(distinct.tree, node => renderDateNode(controller, node, 0, translation))
          : map(shown, value => html`
            <li class="header-filter-item">
              ${checkbox(controller.isSelected(value.value), value.text, value.count, checked => controller.setSelected([value.value], checked))}
            </li>`)}
      </ul>
      <div class="header-filter-actions">
        <button class="header-filter-clear" type="button" @click=${() => controller.clearColumn()}>${translation.filterClear}</button>
        <span class="header-filter-spacer"></span>
        <button class="header-filter-ok" type="button" @click=${() => controller.apply()}>${translation.ok}</button>
        <button class="header-filter-cancel" type="button" @click=${() => controller.close(true)}>${translation.cancel}</button>
      </div>
    </div>`;
};
