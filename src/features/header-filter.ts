import { html, nothing, type ReactiveController, type ReactiveControllerHost, svg, type TemplateResult } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
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
import { Debouncer } from './search.js';
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
  /** Item da árvore com \`tabindex="0"\` (roving; spec 17, A10). */
  #activeItem: string | undefined;
  /** Itens do último render (o teclado acha nível, pai e estado por eles). */
  #items: HeaderFilterTreeItem[] = [];
  /** Contagem anunciada depois da busca (região \`status\` do popover). */
  #searchAnnouncement = '';
  readonly #announcer: Debouncer<'search'>;

  constructor(host: HeaderFilterHost) {
    this.#host = host;
    host.addController(this);
    this.#announcer = new Debouncer(host);
  }

  get activeItem(): string | undefined {
    return this.#activeItem;
  }

  get searchAnnouncement(): string {
    return this.#searchAnnouncement;
  }

  /** Timers do popover (diagnóstico de memória). */
  get timers(): number {
    return this.#announcer.size;
  }

  setActiveItem(key: string): void {
    if (this.#activeItem !== key) {
      this.#activeItem = key;
      this.#host.requestUpdate();
    }
  }

  /** Linhas da árvore: "(Vazios)", depois as datas expandidas ou os valores (até o limite). */
  treeItems(translation: GridI18n): HeaderFilterTreeItem[] {
    const state = this.#state;

    if (!state) {
      return this.#items = [];
    }

    const searching = !!state.search.trim();
    const blank = state.distinct.blanks > 0 && !searching;
    const offset = blank ? 1 : 0;
    const items: HeaderFilterTreeItem[] = [];
    const flat = state.distinct.tree && !searching ? undefined : this.visibleValues().slice(0, HEADER_FILTER_RENDER_LIMIT);
    const setSize = (flat?.length ?? state.distinct.tree!.length) + offset;

    if (blank) {
      items.push({ key: keyOf(null), text: translation.filterBlanks, count: state.distinct.blanks, values: [null], level: 1, setSize, posInSet: 1 });
    }

    if (flat) {
      flat.forEach((value, index) => items.push({
        key: keyOf(value.value),
        text: value.text,
        count: value.count,
        values: [value.value],
        level: 1,
        setSize,
        posInSet: index + 1 + offset,
      }));
    } else {
      flattenDates(state.distinct.tree!, state.expanded, 1, undefined, offset, items);
    }

    return this.#items = items;
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
    this.#activeItem = undefined;
    this.#items = [];
    this.#searchAnnouncement = '';
    this.#announcer.cancel('search');
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

  setSearch(text: string, translation?: GridI18n): void {
    if (!this.#state) {
      return;
    }

    this.#state.search = text;
    // A lista mudou: o roving volta ao 1º item visível (no render).
    this.#activeItem = undefined;
    this.#host.requestUpdate();

    if (translation) {
      // Quantos valores restaram, depois de parar de digitar (spec 17, A10).
      this.#announcer.run('search', () => {
        const state = this.#state;

        if (state) {
          const count = this.visibleValues().length + (state.distinct.blanks > 0 && !state.search.trim() ? 1 : 0);
          this.#searchAnnouncement = formatMessage(translation.headerFilterSearchAnnouncement, { count: String(count) });
          this.#host.requestUpdate();
        }
      }, 500);
    }
  }

  /** Busca do popover: ↓ vai à árvore; Enter = OK. */
  readonly onSearchKeyDown = (event: KeyboardEvent): void => {
    // Enter que confirma a composição (ja/zh/ko) não aplica.
    if (event.isComposing || event.keyCode === 229) {
      return;
    }

    if (event.key === 'ArrowDown') {
      const item = (event.currentTarget as HTMLElement).closest('.header-filter')?.querySelector<HTMLElement>('[role=treeitem][tabindex="0"]');

      if (item) {
        event.preventDefault();
        item.focus();
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.apply();
    }
  };

  /**
   * Árvore (APG Tree View, um ponto de Tab): ↑/↓/Home/End movem; →/←
   * (invertidas em RTL) expandem/recolhem ou vão ao filho/pai; Espaço marca;
   * Enter = OK; uma letra vai para a busca.
   */
  readonly onTreeKeyDown = (event: KeyboardEvent): void => {
    const tree = event.currentTarget as HTMLElement;
    const nodes = [...tree.querySelectorAll<HTMLElement>('[role=treeitem]')];
    const current = event.target as HTMLElement;
    const index = nodes.indexOf(current);
    const item = this.#items.find(entry => entry.key === current.getAttribute('data-key'));

    if (index < 0 || !item) {
      return;
    }

    let key = event.key;

    if (this.#host._isRtl() && (key === 'ArrowLeft' || key === 'ArrowRight')) {
      key = key === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
    }

    let next: HTMLElement | undefined;

    switch (key) {
      case 'ArrowDown':
        next = nodes[index + 1];
        break;
      case 'ArrowUp':
        next = nodes[index - 1];
        break;
      case 'Home':
        next = nodes[0];
        break;
      case 'End':
        next = nodes[nodes.length - 1];
        break;
      case 'ArrowRight':
        if (item.expanded === false) {
          this.toggleExpanded(item.key.slice(2));
        } else if (item.expanded) {
          next = nodes[index + 1];
        }

        break;
      case 'ArrowLeft':
        if (item.expanded) {
          this.toggleExpanded(item.key.slice(2));
        } else if (item.parent) {
          next = nodes.find(node => node.getAttribute('data-key') === item.parent);
        }

        break;
      case ' ':
        this.setSelected(item.values, this.stateOf(item.values) !== true);
        break;
      case 'Enter':
        event.preventDefault();
        this.apply();
        return;
      default:
        // Digitar: o foco vai para a busca e a letra vai junto (não some).
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          tree.closest('.header-filter')?.querySelector<HTMLElement>('.header-filter-search')
            ?.focus();
        }

        return;
    }

    event.preventDefault();
    next?.focus();
  };

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
    this.#items = [];
    this.#searchAnnouncement = '';
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
    if (event.isComposing || event.keyCode === 229) {
      return;
    }

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

/** Funil; com filtro ganha um ponto no canto (o estado não fica só na cor; spec 17, A5). */
const funnelIcon = (active: boolean) => html`
  <svg xmlns="http://www.w3.org/2000/svg" height="1em" width="1em" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
    <path d="M400-240v-80h160v80H400ZM240-440v-80h480v80H240ZM120-640v-80h${active ? 520 : 720}v80H120Z"/>
    ${active ? svg`<circle class="header-filter-badge" cx="800" cy="-760" r="110"/>` : nothing}
  </svg>`;

/** Botão de funil no cabeçalho; ativo quando a coluna tem alguma condição. */
export const renderHeaderFilterButton = (
  controller: HeaderFilterController,
  column: GridColumnDef,
  filterValue: GridFilterExpression | null,
  translation: GridI18n,
  /** Descrição do cabeçalho (traz "Filtrada"); spec 17, A5. */
  describedBy?: string,
): TemplateResult => {
  const active = hasColumnCondition(filterValue, column);
  const label = formatMessage(translation.headerFilterLabel, { column: column.label || column.path || '' });

  return html`
    <button
      class="header-filter-button ${active ? 'active' : ''}"
      part="header-filter-button"
      type="button"
      tabindex="-1"
      aria-label=${label}
      title=${label}
      aria-haspopup="dialog"
      aria-expanded=${controller.column === column ? 'true' : 'false'}
      aria-describedby=${ifDefined(active ? describedBy : undefined)}
      data-column=${columnKeyOf(column)}
      @pointerdown=${(event: PointerEvent) => event.stopPropagation()}
      @click=${(event: MouseEvent) => {
        event.stopPropagation();
        controller.toggle(column);
      }}
      @keydown=${(event: KeyboardEvent) => {
        // Enter/Espaço no funil não podem ordenar a coluna. Fora da ordem de
        // Tab (o grid tem um ponto só): F2 ou Alt+↓ no cabeçalho chegam aqui.
        if (event.key === 'Enter' || event.key === ' ') {
          event.stopPropagation();
        }
      }}>${funnelIcon(active)}</button>`;
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

/** Item da árvore do popover (uma linha desenhada). */
export interface HeaderFilterTreeItem {
  key: string;
  text: string;
  count: number;
  /** Valores (folhas) que o item marca/desmarca. */
  values: unknown[];
  level: number;
  setSize: number;
  posInSet: number;
  /** Só nós de data (ano, mês); `undefined` nas folhas. */
  expanded?: boolean;
  /** Chave do pai (← volta a ele). */
  parent?: string;
}

/** Achata a árvore de datas expandida em itens com nível e posição (spec 17, A10). */
const flattenDates = (
  nodes: readonly (DistinctDateNode | DistinctValue)[],
  expanded: ReadonlySet<string>,
  level: number,
  parent: string | undefined,
  offset: number,
  out: HeaderFilterTreeItem[],
): void => {
  nodes.forEach((node, index) => {
    const isGroup = 'children' in node;
    const key = isGroup ? `d:${node.key}` : keyOf(node.value);
    const open = isGroup && expanded.has(node.key);

    out.push({
      key,
      text: node.text,
      count: node.count,
      values: leavesOf(node),
      level,
      setSize: nodes.length + offset,
      posInSet: index + 1 + offset,
      expanded: isGroup ? open : undefined,
      parent,
    });

    if (isGroup && open) {
      flattenDates(node.children, expanded, level + 1, key, 0, out);
    }
  });
};

const boxIcon = (state: boolean | 'mixed') => html`
  <span class="header-filter-box" aria-hidden="true">${state
    ? html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="18" height="18" fill="currentColor">
        <path d=${state === 'mixed' ? 'M200-440v-80h560v80H200Z' : 'M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z'}/>
      </svg>`
    : nothing}</span>`;

const renderTreeItem = (controller: HeaderFilterController, item: HeaderFilterTreeItem, active: boolean): TemplateResult => {
  const state = controller.stateOf(item.values);

  return html`
    <li
      class="header-filter-item"
      role="treeitem"
      style="--_level: ${item.level - 1}"
      tabindex=${active ? 0 : -1}
      data-key=${item.key}
      aria-level=${item.level}
      aria-setsize=${item.setSize}
      aria-posinset=${item.posInSet}
      aria-checked=${state === 'mixed' ? 'mixed' : state ? 'true' : 'false'}
      aria-expanded=${ifDefined(item.expanded === undefined ? undefined : item.expanded ? 'true' : 'false')}
      @focus=${() => controller.setActiveItem(item.key)}
      @click=${() => controller.setSelected(item.values, state !== true)}>
      ${item.expanded === undefined
        ? nothing
        : html`<span
          class="header-filter-expand ${item.expanded ? 'expanded' : ''}"
          aria-hidden="true"
          @click=${(event: Event) => {
            // Só ponteiro: pelo teclado, →/← no item (o estado está no aria-expanded do item).
            event.stopPropagation();
            controller.toggleExpanded(item.key.slice(2));
          }}>
          <svg xmlns="http://www.w3.org/2000/svg" height="1em" width="1em" viewBox="0 -960 960 960" fill="currentColor">
            <path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"/>
          </svg>
        </span>`}
      ${boxIcon(state)}
      <span class="header-filter-text">${item.text}</span>
      <span class="header-filter-count">${item.count}</span>
    </li>`;
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
  const items = controller.treeItems(translation);
  const activeKey = items.some(item => item.key === controller.activeItem) ? controller.activeItem : items[0]?.key;
  const truncated = !useTree && visible.length > shown.length;

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
        aria-label=${translation.headerFilterSearchLabel}
        .value=${live(state.search)}
        @keydown=${controller.onSearchKeyDown}
        @input=${(event: Event) => controller.setSearch((event.target as HTMLInputElement).value, translation)}>
      <div class="header-filter-select-all">
        ${checkbox(
          controller.stateOf(scope),
          searching ? formatMessage(translation.selectAllResults, { count: String(scope.length) }) : translation.selectAll,
          undefined,
          checked => controller.setSelected(scope, checked),
        )}
      </div>
      <ul
        class="header-filter-list"
        role="tree"
        aria-multiselectable="true"
        aria-label=${title}
        aria-describedby=${truncated ? 'header-filter-note' : nothing}
        @keydown=${controller.onTreeKeyDown}>
        ${map(items, item => renderTreeItem(controller, item, item.key === activeKey))}
      </ul>
      ${truncated
        ? html`<p class="header-filter-note" id="header-filter-note">${formatMessage(translation.headerFilterTruncated, {
          shown: String(shown.length),
          count: String(visible.length),
        })}</p>`
        : nothing}
      <div class="visually-hidden" role="status" aria-live="polite">${controller.searchAnnouncement}</div>
      <div class="header-filter-actions">
        <button class="header-filter-clear" type="button" @click=${() => controller.clearColumn()}>${translation.filterClear}</button>
        <span class="header-filter-spacer"></span>
        <button class="header-filter-ok" type="button" @click=${() => controller.apply()}>${translation.ok}</button>
        <button class="header-filter-cancel" type="button" @click=${() => controller.close(true)}>${translation.cancel}</button>
      </div>
    </div>`;
};
