import { ContextConsumer } from '@lit/context';

import { html, type HTMLTemplateResult, LitElement, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { map } from 'lit/directives/map.js';
import { createRef, type Ref, ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';

import { VirtualizerController } from '@tanstack/lit-virtual';
import type { VirtualItem } from '@tanstack/virtual-core';

import {
  ColumnChooserController,
  columnChooserIcon,
  type ColumnChooserItem,
  renderColumnChooser,
} from './features/column-chooser.js';
import { ColumnDragAndDropAdapter } from './features/column-dnd.js';
import { releaseInteractions } from './features/drag-helper.js';
import { isRtl } from './features/drop-position.js';
import { GroupDragAndDropAdapter } from './features/group-dnd.js';
import {
  clampWidth,
  ColumnResizeController,
  DEFAULT_MIN_COLUMN_WIDTH,
  type GridColumnResizeEventDetail,
  type GridResizeMode,
  measureContentWidth,
  type ResizeHost,
  type WidthBounds,
} from './features/resize.js';
import {
  formatMessage,
  type GridSortingMode,
  initialSorting,
  nextSorting,
  sameSorting,
  sortGestureOf,
  sortingAfterGesture,
  toggleOrder,
} from './features/sorting.js';
import {
  type GridColumnDataType,
  type GridColumnDef,
  type GridColumnFixed,
  type GridSort,
  type GridSortOrder,
  isColumnSortable,
} from './grid-column-def.js';
import type { GridColumnChange } from './grid-column.js';
import {
  DEFAULT_GRID_LANGUAGE,
  type GridI18n,
  gridLanguageContext,
  observeDocumentLanguage,
  resolveGridTranslation,
} from './grid-i18n.js';
import { styles } from './grid.styles.js';
import { renderDataCell } from './render/cell.js';
import { renderGroupRowCells } from './render/group-row.js';
import { isActivationKey, renderHeaderCell, renderSortIndicator } from './render/header.js';
import { keyedRows } from './render/keyed-rows.js';
import { createComparer } from './row-model/compare.js';
import { flattenRows } from './row-model/flatten.js';
import { type FormatContext, formatCellValue, resolveAlignment, resolveDataType } from './row-model/format.js';
import { buildGroups } from './row-model/group.js';
import { type RankCache, sortItems } from './row-model/sort.js';
import type { DataRow, GroupNode, GroupRow, Row } from './row-model/types.js';

import './grid-column.js';

export type {
  GridColumnAlignment,
  GridColumnBooleanDisplay,
  GridColumnComparator,
  GridColumnDataType,
  GridColumnDef,
  GridColumnFixed,
  GridColumnFormat,
  GridColumnFormatter,
  GridSort,
  GridSortOrder,
} from './grid-column-def.js';
export type { GridSortingMode } from './features/sorting.js';

/** `detail` de `u-grid-sorting` e `u-grid-sort-change`. */
export interface GridSortEventDetail {
  /** Ordenação nova (cópia). */
  sorting: GridSort[];
  /** Ordenação anterior (cópia). */
  previous: GridSort[];
}
export type { GridColumnResizeEventDetail, GridResizeMode } from './features/resize.js';
export { setGridLanguage, setGridTranslation, gridLanguageContext, type GridI18n } from './grid-i18n.js';

/** Linhas renderizadas antes de o virtualizador medir o contêiner (1º render, SSR). */
const INITIAL_RENDER_ROWS = 30;

/** Largura (px) de cada coluna de recuo de grupo; igual ao `--_group-column-width`. */
const GROUP_COLUMN_WIDTH = 32;

export interface GridColumnVisibilityChangeEventDetail {
  column: GridColumnDef;
  visible: boolean;
}

export interface GridColumnReorderEventDetail {
  column: GridColumnDef;
  /** Posições entre as colunas comuns (as ocultas contam). */
  fromIndex: number;
  toIndex: number;
}

/** Opções do hospedeiro vistas por último — mudança nelas vence o estado do usuário. */
interface HostColumnOptions {
  width: number | null;
  visible: boolean;
  fixed: GridColumnFixed;
}

/** Como uma coluna visível é desenhada neste render (calculado uma vez, usado em toda linha). */
interface ColumnLayout {
  column: GridColumnDef;
  id: number;
  format: FormatContext;
  /** Classes do cabeçalho e das células: fixação, alinhamento e quebra de linha. */
  className: string;
  /** Classes só das células de dados (acrescenta `truncate`). */
  cellClassName: string;
  /** Deslocamento `sticky` das fixas (cabeçalho e células). */
  style: string;
  /** Classes do cabeçalho (mesmas de `className`) para o `classMap`. */
  headerClasses: Record<string, boolean>;
  /** Deslocamento `sticky` e `min-width` do cabeçalho (com `table-layout: fixed` só ele conta). */
  headerStyles: Record<string, string | undefined>;
  resizable: boolean;
  bounds: WidthBounds;
  /** Largura conhecida (px) ou `undefined` antes da 1ª medição. */
  width: number | undefined;
}

const normalizeFixed = (fixed: unknown): GridColumnFixed =>
  fixed === 'start' || fixed === 'end' ? fixed : null;

const blockRank = (fixed: GridColumnFixed): number =>
  fixed === 'start' ? 0 : fixed === 'end' ? 2 : 1;

const getDocumentLanguage = (): string | undefined => {

  if (typeof document === 'undefined') {
    return undefined;
  }

  const htmlLang = document.documentElement.lang;

  if (htmlLang) {
    return htmlLang;
  }

  const meta = document.querySelector('meta[http-equiv="content-language" i]');

  return meta?.getAttribute('content')?.split(',')[0].trim() || undefined;
};

const getBrowserLanguage = (): string | undefined =>
  typeof navigator === 'undefined'
    ? undefined
    : navigator.language || undefined;

const sameItems = <T>(a: readonly T[], b: readonly T[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

let nextObjectKey = 0;
const objectKeys = new WeakMap<object, number>();

/** Chave de linha sem `keyExpr`: a identidade do objeto. */
const rowKeyOf = (item: unknown): string => {
  if (item !== null && (typeof item === 'object' || typeof item === 'function')) {
    let key = objectKeys.get(item);

    if (key === undefined) {
      key = nextObjectKey++;
      objectKeys.set(item, key);
    }

    return `o${key}`;
  }

  return `${typeof item}:${String(item)}`;
};

let nextColumnId = 0;
const columnIds = new WeakMap<GridColumnDef, number>();

const columnIdOf = (column: GridColumnDef): number => {
  let id = columnIds.get(column);

  if (id === undefined) {
    id = nextColumnId++;
    columnIds.set(column, id);
  }

  return id;
};

/**
 * @fires u-grid-sorting - Before the sorting changes (by the user or by the API). Cancelable; `detail: GridSortEventDetail`.
 * @fires u-grid-sort-change - After the sorting changed. `detail: GridSortEventDetail`.
 * @fires u-grid-column-resize - The user finished resizing a column (pointer
 * release, keyboard or double-click auto-size). Detail: `GridColumnResizeEventDetail`.
 * @fires u-grid-column-visibility-change - The user showed or hid a column in
 * the column chooser. Detail: `GridColumnVisibilityChangeEventDetail`.
 * @fires u-grid-column-reorder - The user moved a column by drag and drop.
 * Detail: `GridColumnReorderEventDetail`.
 */
@customElement('u-grid')
export class DataGrid extends LitElement implements ResizeHost {
  static override styles = [styles];

  // ---------------------------------------------------------------- dados

  #items: readonly any[] = [];

  @property({ type: Boolean, attribute: 'auto-expand-groups' }) autoExpandGroups = false;

  /** Dados das linhas. O grid nunca altera este array nem os itens. */
  @property({ type: Array })
  get items(): any[] {
    return this.#items as any[];
  }

  set items(items: readonly any[] | null | undefined) {
    this.#items = items ?? [];
    this.#sortDirty = true;
    this.#itemsReplaced = true;
    this.#rankCache.clear();
    this.#dataTypes.clear();
    this.#autoWidthDirty = true;
    this.#layoutDirty = true;
  }

  /** `items` na ordem da ordenação atual (o próprio `items` sem ordenação). */
  #sortedItems: readonly any[] = [];
  /** Postos por coluna para os `items` e o idioma atuais (inverter a direção não reordena textos). */
  readonly #rankCache: RankCache = new Map();
  #groups: GroupNode[] = [];
  #rows: Row[] = [];
  #sortDirty = true;
  #groupsDirty = true;
  #rowsDirty = true;
  #itemsReplaced = false;
  #modelLanguage: string | undefined;
  /** `dataType` efetivo (informado ou inferido dos itens) por coluna. */
  readonly #dataTypes = new Map<GridColumnDef, GridColumnDataType | undefined>();
  #hasWrap = false;
  #measuredWrap = false;
  /** Expansão escolhida pelo usuário, por chave de grupo (sobrevive a troca de dados). */
  readonly #expansion = new Map<string, boolean>();

  // -------------------------------------------------------------- colunas

  /** Colunas por propriedade; `undefined` = usar os `<u-grid-column>` filhos. */
  #columnsProperty: GridColumnDef[] | undefined;
  #declarativeColumns: GridColumnDef[] = [];

  readonly _nativeColumnMap = new WeakMap<HTMLElement, GridColumnDef>();

  /**
   * Ordem atual (do usuário) das colunas comuns e de grupo — estado do grid.
   * As comuns ficam sempre em blocos: fixas no início, livres, fixas no fim.
   */
  @state() _groupColumns: GridColumnDef[] = [];
  @state() _regularColumns: GridColumnDef[] = [];

  /** Colunas comuns visíveis, na ordem de exibição (recalculado a cada update). */
  _visibleColumns: GridColumnDef[] = [];

  // Estado do usuário por coluna — nunca escrito nos objetos do hospedeiro.
  readonly #userWidths = new Map<GridColumnDef, number>();
  readonly #userVisible = new Map<GridColumnDef, boolean>();
  readonly #userFixed = new Map<GridColumnDef, GridColumnFixed>();
  /** Larguras de conteúdo medidas pelo `column-auto-width`. */
  readonly #autoWidths = new Map<GridColumnDef, number>();
  /** Largura renderizada (px) de cada coluna visível, medida após o layout. */
  readonly #renderedWidths = new Map<GridColumnDef, number>();
  readonly #hostOptions = new Map<GridColumnDef, HostColumnOptions>();
  #layoutDirty = true;
  #autoWidthDirty = true;

  /**
   * Definições de coluna. Por propriedade têm precedência sobre os
   * `<u-grid-column>` filhos. O grid não altera o array nem os objetos.
   */
  @property({ attribute: false })
  get columns(): GridColumnDef[] {
    return this.#columnsProperty ?? this.#declarativeColumns;
  }

  set columns(value: GridColumnDef[] | null | undefined) {
    this.#columnsProperty = value ?? undefined;
    this.#syncColumns();
  }

  // ------------------------------------------------------------ ordenação

  /**
   * How the user sorts by clicking the column headers: `single` (default)
   * keeps one sorted column, `multiple` adds columns with Shift+click and
   * `none` disables header sorting (the API still works).
   */
  @property() sorting: GridSortingMode = 'single';

  /** Ordenação atual, em ordem de prioridade. Inclui a direção das colunas agrupadas. */
  #sorting: GridSort[] = [];
  /** Texto da região `aria-live` (último gesto de ordenação). */
  #announcement = '';
  /** Houve arrasto desde o último `pointerdown` no cabeçalho/chip. */
  #dragged = false;

  get #sortingMode(): GridSortingMode {
    return this.sorting === 'none' || this.sorting === 'multiple' ? this.sorting : 'single';
  }

  readonly #isGrouped = (column: GridColumnDef): boolean => this._groupColumns.includes(column);

  // ------------------------------------------------------------ aparência

  @property({ type: Number }) rowHeight = 48;
  @property({ type: Boolean }) striped = false;
  @property({ type: Boolean, attribute: 'show-group-panel' }) showGroupPanel = true;
  @property({ type: Boolean, attribute: 'show-column-headers' }) showColumnHeaders = true;
  @property({ type: Boolean }) showRowLines = true;
  @property({ type: Boolean }) showColumnLines = false;

  // -------------------------------------------------------- recursos de coluna

  /** Deixa o usuário redimensionar as colunas pela borda do cabeçalho. */
  @property({ type: Boolean, attribute: 'column-resizing' }) columnResizing = false;

  /**
   * `widget`: só a coluna muda e a largura total acompanha. `next-column`: a
   * coluna seguinte cede ou ganha o mesmo tanto (a largura total se mantém).
   */
  @property({ attribute: 'resize-mode' }) resizeMode: GridResizeMode = 'widget';

  /** Mostra o botão do seletor de colunas na barra do cabeçalho. */
  @property({ type: Boolean, attribute: 'column-chooser' }) columnChooser = false;

  /** Colunas sem `width` ganham a largura do conteúdo (cabeçalho + linhas visíveis). */
  @property({ type: Boolean, attribute: 'column-auto-width' }) columnAutoWidth = false;

  /** @deprecated Use `striped`. */
  @property({ type: Boolean })
  get stripped(): boolean {
    return this.striped;
  }

  set stripped(value: boolean) {
    this.#deprecated('stripped', 'striped');
    this.striped = value;
  }

  /** @deprecated Use `showGroupPanel` (o nome antigo só controlava o painel de grupos). */
  @property({ type: Boolean })
  get showHeader(): boolean {
    return this.showGroupPanel;
  }

  set showHeader(value: boolean) {
    this.#deprecated('showHeader', 'showGroupPanel');
    this.showGroupPanel = value;
  }

  readonly #warnedDeprecations = new Set<string>();

  #deprecated(name: string, replacement: string): void {
    if (this.#warnedDeprecations.has(name)) {
      return;
    }

    this.#warnedDeprecations.add(name);
    console.warn(`<u-grid>: "${name}" is deprecated, use "${replacement}" instead.`);
  }

  // ------------------------------------------------------------------ i18n

  #explicitLanguage?: string;
  #unobserveDocumentLanguage?: () => void;

  readonly #languageConsumer = new ContextConsumer(this, {
    context: gridLanguageContext,
    subscribe: true,
  });

  /**
   * Language used to resolve the built-in translations. When not set on the
   * component it is resolved, in order, from the Lit context, the document
   * (`<html lang>` / content-language meta) and finally the browser.
   */
  @property()
  get language(): string {
    return this.#effectiveLanguage ?? DEFAULT_GRID_LANGUAGE;
  }

  set language(value: string | null | undefined) {
    this.#explicitLanguage = value || undefined;
  }

  get #effectiveLanguage(): string | undefined {
    return this.#explicitLanguage
      ?? this.#languageConsumer.value
      ?? getDocumentLanguage()
      ?? getBrowserLanguage();
  }

  get #translation(): GridI18n {
    return resolveGridTranslation(this.#effectiveLanguage);
  }

  // ------------------------------------------------------- refs/controllers

  readonly _containerRef: Ref<HTMLDivElement> = createRef();
  readonly _scrollContainerRef: Ref<HTMLDivElement> = createRef();
  readonly _groupContainerRef: Ref<HTMLDivElement> = createRef();

  readonly #virtualizerController = new VirtualizerController(this, {
    getScrollElement: () => this._scrollContainerRef.value ?? null,
    count: 0,
    estimateSize: () => this.rowHeight,
    getItemKey: index => this.#rows[index]?.key ?? index,
    overscan: 5,
  });

  readonly #columnDragAndDrop = new ColumnDragAndDropAdapter(this);
  readonly #groupDragAndDrop = new GroupDragAndDropAdapter(this);
  #dragAndDropDirty = true;

  readonly #resize = new ColumnResizeController(this);
  readonly #chooser = new ColumnChooserController(this);
  #resizeObserver: ResizeObserver | undefined;

  /** Quantos elementos estão registrados no interactjs (diagnóstico/testes). */
  get _dragAndDropRegistrations(): number {
    return this.#columnDragAndDrop.size + this.#groupDragAndDrop.size;
  }

  /**
   * Tamanho dos registros internos que crescem com o uso (diagnóstico e
   * testes de vazamento, spec 14). Num grid de vida longa têm de ficar
   * estáveis.
   */
  get _memoryStats(): Record<string, number> {
    const virtualizer = this.#virtualizerController.getVirtualizer();

    return {
      dragAndDrop: this._dragAndDropRegistrations,
      measuredElements: virtualizer.elementsCache.size,
      // privado no tipo do virtual-core; só leitura para diagnóstico
      measuredSizes: (virtualizer as unknown as { itemSizeCache: Map<unknown, number> }).itemSizeCache.size,
      dataTypes: this.#dataTypes.size,
      expansion: this.#expansion.size,
      sortRanks: this.#rankCache.size,
    };
  }

  // ----------------------------------------------------------- ciclo de vida

  override connectedCallback() {
    super.connectedCallback();
    this.#readDeclarativeColumns();
    this.#unobserveDocumentLanguage = observeDocumentLanguage(() => this.requestUpdate());
    this.#dragAndDropDirty = true;
    this.#layoutDirty = true;
    this.#observeScrollContainer();
  }

  override disconnectedCallback() {
    // Antes do super: ele solta os refs (o contêiner) dos diretivos.
    this.#resize.cancel();
    super.disconnectedCallback();
    this.#unobserveDocumentLanguage?.();
    this.#unobserveDocumentLanguage = undefined;
    this.#columnDragAndDrop.detach();
    this.#groupDragAndDrop.detach();
    releaseInteractions(this);
    // Arrasto interrompido (o `unset` para a interação sem o evento `end`):
    // o fantasma não pode reaparecer se o grid for reconectado.
    this.renderRoot?.querySelectorAll('.move-container').forEach(ghost => ghost.remove());
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = undefined;
  }

  override willUpdate(changed: PropertyValues<this>) {
    if (changed.has('autoExpandGroups')) {
      this.#rowsDirty = true;
    }

    if (changed.has('columnAutoWidth')) {
      this.#autoWidths.clear();
      this.#autoWidthDirty = true;
    }

    if (
      changed.has('columnAutoWidth')
      || changed.has('columnResizing')
      || changed.has('resizeMode')
      || changed.has('showColumnHeaders')
      || changed.has('_regularColumns')
      || changed.has('_groupColumns')
    ) {
      this.#layoutDirty = true;
    }

    this.#reconcileColumnOptions();
  }

  override firstUpdated() {
    this._scrollContainerRef.value?.addEventListener('scroll', this.#updateScrollShadows, { passive: true });
    this.#observeScrollContainer();
  }

  override updated(changed: PropertyValues<this>) {
    const virtualizer = this.#virtualizerController.getVirtualizer();

    if (changed.has('rowHeight')) {
      virtualizer.measure();
    }

    // Com `wrap` a linha pode crescer: mede as renderizadas (o virtualizador
    // observa o tamanho delas daí em diante).
    if (this.#hasWrap !== this.#measuredWrap) {
      this.#measuredWrap = this.#hasWrap;

      if (!this.#hasWrap) {
        virtualizer.measure();
      }
    }

    // Alturas medidas são por chave de linha: com itens novos as chaves
    // antigas nunca mais voltam (sem `keyExpr` a chave é o objeto) e o mapa
    // cresceria a cada troca de `items`.
    if (this.#itemsReplaced) {
      this.#itemsReplaced = false;

      if (this.#hasWrap) {
        virtualizer.measure();
      }
    }

    if (this.#hasWrap) {
      this.renderRoot.querySelectorAll<HTMLElement>('tbody tr[data-index]')
        .forEach(row => virtualizer.measureElement(row));
    }

    if (this.#layoutDirty) {
      this.#layoutDirty = false;

      const autoWidthsChanged = this.#applyAutoWidths();
      const renderedChanged = this.#measureRenderedWidths();
      this.#updateScrollShadows();

      // Deslocamentos das fixas e `aria-valuenow` usam a largura medida.
      if (autoWidthsChanged || (renderedChanged && (this.columnResizing || this.#hasFixedColumns()))) {
        this.#layoutDirty = autoWidthsChanged;
        this.requestUpdate();
      }
    }

    // O virtualizador guarda cada `<tr>` medida e só solta as que saíram do
    // DOM quando chamado sem elemento: sem isso, rolar retém toda linha já
    // vista (e os itens dela).
    virtualizer.measureElement(null);

    if (
      this.#dragAndDropDirty
      || changed.has('_regularColumns')
      || changed.has('_groupColumns')
      || changed.has('showColumnHeaders')
      || changed.has('showGroupPanel')
      || changed.has('columnChooser')
    ) {
      this.#dragAndDropDirty = false;
      this.#syncDragAndDrop();
    }
  }

  // ------------------------------------------------------------------ API

  /**
   * Sorts by `column` in `order` (`null` removes the column from the
   * sorting). Without `append` the column replaces the current sorting; with
   * it, the column is added (or keeps its priority if already sorted). For a
   * grouped column it sets the direction of its groups.
   */
  sortBy(column: GridColumnDef, order: GridSortOrder | null, { append = false }: { append?: boolean } = {}): void {
    this.#changeSorting(nextSorting(this.#sorting, column, order, append, this.#isGrouped));
  }

  /** Removes the sorting of every column (grouped columns go back to ascending groups). */
  clearSorting(): void {
    this.#changeSorting([]);
  }

  /** Current sorting, in priority order. */
  getSorting(): GridSort[] {
    return this.#sorting.map(({ column, order }) => ({ column, order }));
  }

  groupColumn(column: GridColumnDef, targetIndex: number): void {
    this.#moveColumnTo(true, column, targetIndex);
  }

  /**
   * Move uma coluna comum para `targetIndex` (posição entre as comuns). A
   * coluna fica no próprio bloco: fixas no início, livres ou fixas no fim.
   */
  moveColumn(column: GridColumnDef, targetIndex: number): void {
    this.#moveColumnTo(false, column, targetIndex);
  }

  /** Chamado pelos adaptadores de arrasto quando um arrasto começa. */
  _dragStarted(): void {
    this.#dragged = true;
  }

  /** Define a largura (px) de uma coluna, respeitando `minWidth`/`maxWidth`. */
  setColumnWidth(column: GridColumnDef, width: number): void {
    if (!this._regularColumns.includes(column) || !Number.isFinite(width)) {
      return;
    }

    const { min, max } = this._boundsOf(column);
    this._setUserWidths(new Map([[column, clampWidth(width, min, max)]]));
  }

  /** Ajusta a largura ao conteúdo do cabeçalho e das linhas renderizadas. */
  autoSizeColumn(column: GridColumnDef): void {
    const width = this.#measureColumnContent(column);

    if (width !== undefined) {
      this.setColumnWidth(column, width);
    }
  }

  /** Abre o seletor de colunas (mesmo sem o botão de `column-chooser`). */
  showColumnChooser(): void {
    this.#chooser.show();
  }

  /**
   * Chamado por `<u-grid-column>` quando uma propriedade muda: `value` =
   * muda o valor das células (`path`, `valueGetter`, `dataType`); `display`
   * = só a exibição (formato, largura, fixação, visibilidade…).
   */
  _columnChanged(column: GridColumnDef, change: GridColumnChange): void {

    const grouped = this._groupColumns.includes(column);

    if (!grouped && !this._regularColumns.includes(column)) {
      return;
    }

    if (change === 'groupIndex') {
      const groupIndex = column.groupIndex;

      if (groupIndex === null || groupIndex === undefined) {
        if (grouped) {
          this.moveColumn(column, this._regularColumns.length);
        }
      } else {
        this.groupColumn(column, groupIndex);
      }
    }

    if (change === 'value') {
      this.#dataTypes.delete(column);
      this.#rankCache.delete(column);
      this.#sortDirty ||= grouped || this.#sorting.some(spec => spec.column === column);
    }

    this.requestUpdate();
  }

  // ------------------------------------------------------------- colunas

  readonly #readDeclarativeColumns = (): void => {
    if (this.#columnsProperty) {
      return;
    }

    const columns: GridColumnDef[] = Array.from(this.querySelectorAll('u-grid-column'))
      .filter(column => column.parentElement === this);

    if (sameItems(columns, this.#declarativeColumns)) {
      return;
    }

    this.#declarativeColumns = columns;
    this.#syncColumns();
  };

  /**
   * Concilia as definições com a ordem atual: colunas já conhecidas mantêm a
   * posição e o agrupamento escolhidos pelo usuário; novas entram pelo
   * `groupIndex` (inicial) ou na posição da definição.
   */
  #syncColumns(): void {
    const definitions = this.columns;
    const defined = new Set(definitions);

    // Colunas reatribuídas podem trazer outro `path` no mesmo objeto.
    this.#rankCache.clear();
    const known = new Set([...this._regularColumns, ...this._groupColumns]);

    for (const store of [this.#userWidths, this.#userVisible, this.#userFixed, this.#autoWidths, this.#renderedWidths, this.#hostOptions]) {
      for (const column of store.keys()) {
        if (!defined.has(column)) {
          store.delete(column);
        }
      }
    }

    const regular = this._regularColumns.filter(c => defined.has(c));
    const group = this._groupColumns.filter(c => defined.has(c));
    const newGroupColumns: GridColumnDef[] = [];

    // Ordenação: some a das colunas removidas; as novas trazem `sortOrder`.
    const sorting = [
      ...this.#sorting.filter(spec => defined.has(spec.column)),
      ...initialSorting(definitions.filter(column => !known.has(column))),
    ];

    if (!sameSorting(sorting, this.#sorting)) {
      this.#sorting = sorting;
      this.#sortDirty = true;
    }

    definitions.forEach((column, index) => {
      if (known.has(column)) {
        return;
      }

      if (column.groupIndex === null || column.groupIndex === undefined) {
        regular.splice(Math.min(index, regular.length), 0, column);
      } else {
        newGroupColumns.push(column);
      }
    });

    newGroupColumns
      .sort((a, b) => a.groupIndex! - b.groupIndex!)
      .forEach(column => group.splice(Math.min(column.groupIndex!, group.length), 0, column));

    this.#autoWidthDirty = true;
    this.#setColumnState(regular, group);
  }

  #moveColumnTo(toGroup: boolean, column: GridColumnDef, targetIndex: number): void {
    const regular = [...this._regularColumns];
    const group = [...this._groupColumns];
    const source = regular.includes(column) ? regular : group.includes(column) ? group : null;

    if (!source) {
      return;
    }

    const target = toGroup ? group : regular;
    const targetColumn = target[targetIndex];

    if (targetColumn === column) {
      return;
    }

    source.splice(source.indexOf(column), 1);

    const insertAt = targetColumn ? target.indexOf(targetColumn) : target.length;
    target.splice(insertAt, 0, column);

    this.#setColumnState(regular, group);
  }

  #setColumnState(regular: GridColumnDef[], group: GridColumnDef[]): void {
    this.#dataTypes.clear();

    if (!sameItems(group, this._groupColumns)) {
      this._groupColumns = group;
      // Muda quais chaves ordenam as linhas e quais dão a direção dos grupos.
      this.#sortDirty = true;
    }

    const partitioned = this.#partition(regular);

    if (!sameItems(partitioned, this._regularColumns)) {
      this._regularColumns = partitioned;
    }

    this.requestUpdate();
  }

  /** Ordem estável em blocos: fixas no início, livres, fixas no fim. */
  #partition(columns: GridColumnDef[]): GridColumnDef[] {
    return columns
      .map((column, index) => ({ column, index, rank: blockRank(this._fixedOf(column)) }))
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .map(entry => entry.column);
  }

  /**
   * Opção mudada pelo hospedeiro (na definição) vence o que o usuário tinha
   * escolhido para ela. Também refaz os blocos e a lista de visíveis.
   */
  #reconcileColumnOptions(): void {
    const reconcile = (column: GridColumnDef): void => {
      const width = column.width ?? null;
      const visible = column.visible !== false;
      const fixed = normalizeFixed(column.fixed);
      const previous = this.#hostOptions.get(column);

      if (previous?.width === width && previous.visible === visible && previous.fixed === fixed) {
        return;
      }

      if (previous) {
        if (previous.width !== width) {
          this.#userWidths.delete(column);
        }

        if (previous.visible !== visible) {
          this.#userVisible.delete(column);
        }

        if (previous.fixed !== fixed) {
          this.#userFixed.delete(column);
        }
      }

      this.#hostOptions.set(column, { width, visible, fixed });
      this.#layoutDirty = true;
    };

    this._regularColumns.forEach(reconcile);
    this._groupColumns.forEach(reconcile);

    const partitioned = this.#partition(this._regularColumns);

    if (!sameItems(partitioned, this._regularColumns)) {
      this._regularColumns = partitioned;
    }

    const visible = this._regularColumns.filter(column => this._isColumnVisible(column));

    if (!sameItems(visible, this._visibleColumns)) {
      this._visibleColumns = visible;
      this.#layoutDirty = true;
      this.#dragAndDropDirty = true;
    }
  }

  _isColumnVisible(column: GridColumnDef): boolean {
    return this.#userVisible.get(column) ?? column.visible !== false;
  }

  _fixedOf(column: GridColumnDef): GridColumnFixed {
    return this.#userFixed.has(column)
      ? this.#userFixed.get(column)!
      : normalizeFixed(column.fixed);
  }

  _isRegularColumn(column: GridColumnDef): boolean {
    return this._regularColumns.includes(column);
  }

  /** Reordenar só vale dentro do mesmo bloco (fixas no início, livres, fixas no fim). */
  _sameBlock(a: GridColumnDef, b: GridColumnDef): boolean {
    return this._fixedOf(a) === this._fixedOf(b);
  }

  #hasFixedColumns(): boolean {
    return this._visibleColumns.some(column => this._fixedOf(column) !== null);
  }

  /** Reordenação feita pelo usuário (arrasto): move e avisa. */
  _userMoveColumn(column: GridColumnDef, targetIndex: number): void {
    const fromIndex = this._regularColumns.indexOf(column);

    this.moveColumn(column, targetIndex);

    const toIndex = this._regularColumns.indexOf(column);

    if (fromIndex >= 0 && toIndex !== fromIndex) {
      this.dispatchEvent(new CustomEvent('u-grid-column-reorder', this.#eventInit<GridColumnReorderEventDetail>({ column, fromIndex, toIndex })));
    }
  }

  /** Mostra/oculta pelo seletor. Recusa ocultar a última coluna visível. */
  _userSetVisible(column: GridColumnDef, visible: boolean): boolean {
    if (!this._isRegularColumn(column) || this._isColumnVisible(column) === visible) {
      return false;
    }

    if (!visible && this._visibleColumns.length <= 1) {
      this.requestUpdate();
      return false;
    }

    this.#userVisible.set(column, visible);
    this.#layoutDirty = true;
    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('u-grid-column-visibility-change', this.#eventInit<GridColumnVisibilityChangeEventDetail>({ column, visible })));
    return true;
  }

  _userSetFixed(column: GridColumnDef, fixed: GridColumnFixed): void {
    if (!this._isRegularColumn(column) || this._fixedOf(column) === fixed) {
      return;
    }

    this.#userFixed.set(column, fixed);
    this.#layoutDirty = true;
    this.requestUpdate();
  }

  #eventInit<T>(detail: T): CustomEventInit<T> {
    return { detail, bubbles: true, composed: true };
  }

  // ----------------------------------------------------------- larguras

  /** Largura escolhida (usuário > hospedeiro > auto-ajuste), sem medir o DOM. */
  #widthOf(column: GridColumnDef): number | undefined {
    const width = this.#userWidths.get(column)
      ?? column.width
      ?? this.#autoWidths.get(column);

    if (width === null || width === undefined) {
      return undefined;
    }

    return clampWidth(width, column.minWidth ?? 0, column.maxWidth ?? Infinity);
  }

  _boundsOf(column: GridColumnDef): WidthBounds {
    const min = Math.max(0, column.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH);
    const max = column.maxWidth ?? Infinity;
    const width = this.#widthOf(column) ?? this.#renderedWidths.get(column) ?? min;

    return { width: Math.round(width), min, max };
  }

  _resizeNeighbor(column: GridColumnDef): GridColumnDef | undefined {
    const next = this._visibleColumns[this._visibleColumns.indexOf(column) + 1];
    return next && this.#isResizable(next) ? next : undefined;
  }

  #isResizable(column: GridColumnDef): boolean {
    return this.columnResizing && column.resizable !== false;
  }

  _freezeWidths(): void {
    this.#measureRenderedWidths();

    for (const column of this._visibleColumns) {
      if (this.#userWidths.has(column)) {
        continue;
      }

      const width = this.#renderedWidths.get(column) ?? this.#widthOf(column);

      if (width !== undefined) {
        this.#userWidths.set(column, Math.round(width));
      }
    }
  }

  _setUserWidths(widths: ReadonlyMap<GridColumnDef, number>): void {
    for (const [column, width] of widths) {
      this.#userWidths.set(column, width);
    }

    this.#layoutDirty = true;
    this.requestUpdate();
  }

  _isRtl(): boolean {
    return isRtl(this);
  }

  _setResizing(active: boolean): void {
    this._containerRef.value?.classList.toggle('resizing', active);
  }

  _dispatchColumnResize(detail: GridColumnResizeEventDetail): void {
    this.dispatchEvent(new CustomEvent('u-grid-column-resize', this.#eventInit(detail)));
  }

  #userAutoSize(column: GridColumnDef): void {
    const previousWidth = this._boundsOf(column).width;

    this.autoSizeColumn(column);

    const width = this._boundsOf(column).width;

    if (width !== previousWidth) {
      this._dispatchColumnResize({ column, width, previousWidth });
    }
  }

  /** Maior largura de conteúdo entre o cabeçalho e as células renderizadas da coluna. */
  #measureColumnContent(column: GridColumnDef): number | undefined {
    const index = this._visibleColumns.indexOf(column);

    if (index < 0) {
      return undefined;
    }

    const colIndex = index + 1;
    const cells = this.renderRoot.querySelectorAll<HTMLElement>(
      `th.header-column[aria-colindex="${colIndex}"], tbody tr:not(.group-row) > td[aria-colindex="${colIndex}"]`,
    );

    let width: number | undefined;

    cells.forEach(cell => {
      width = Math.max(width ?? 0, measureContentWidth(cell));
    });

    return width;
  }

  /** `column-auto-width`: mede as colunas sem largura definida. */
  #applyAutoWidths(): boolean {
    if (!this.columnAutoWidth) {
      return false;
    }

    const refresh = this.#autoWidthDirty;
    this.#autoWidthDirty = false;
    let changed = false;

    for (const column of this._visibleColumns) {
      if (this.#userWidths.has(column) || (column.width !== null && column.width !== undefined)) {
        continue;
      }

      if (!refresh && this.#autoWidths.has(column)) {
        continue;
      }

      const width = this.#measureColumnContent(column);

      if (width !== undefined && width !== this.#autoWidths.get(column)) {
        const { min, max } = this._boundsOf(column);
        this.#autoWidths.set(column, clampWidth(width, min, max));
        changed = true;
      }
    }

    return changed;
  }

  #measureRenderedWidths(): boolean {
    const root = this.renderRoot;
    let cells = [...root.querySelectorAll<HTMLElement>('th.header-column')];

    if (!cells.length) {
      const row = root.querySelector('tbody tr[role=row]:not(.group-row)');
      cells = row ? [...row.querySelectorAll<HTMLElement>('td[role=gridcell]')] : [];
    }

    let changed = false;

    cells.forEach((cell, index) => {
      const column = this._visibleColumns[index];

      if (!column) {
        return;
      }

      const width = cell.getBoundingClientRect().width;

      if (Math.abs((this.#renderedWidths.get(column) ?? -1) - width) > 0.5) {
        this.#renderedWidths.set(column, width);
        changed = true;
      }
    });

    return changed;
  }

  #observeScrollContainer(): void {
    const scroller = this._scrollContainerRef.value;

    if (!scroller || this.#resizeObserver || typeof ResizeObserver === 'undefined') {
      return;
    }

    this.#resizeObserver = new ResizeObserver(() => {
      this.#layoutDirty = true;
      this.requestUpdate();
    });

    this.#resizeObserver.observe(scroller);
  }

  /** Sombra das fixas: só aparece quando há conteúdo rolado por baixo delas. */
  readonly #updateScrollShadows = (): void => {
    const scroller = this._scrollContainerRef.value;
    const container = this._containerRef.value;

    if (!scroller || !container) {
      return;
    }

    // Em RTL o scrollLeft vai de 0 a negativo.
    const offset = Math.abs(scroller.scrollLeft);
    const overflow = scroller.scrollWidth - scroller.clientWidth;

    container.classList.toggle('scroll-start', offset > 0.5);
    container.classList.toggle('scroll-end', overflow - offset > 0.5);
  };

  /**
   * Classe, deslocamento `sticky` e limites de cada coluna visível. Os
   * deslocamentos usam a largura medida (a tabela pode esticar as colunas).
   */
  #columnLayout(): ColumnLayout[] {
    const columns = this._visibleColumns;
    const fixed = columns.map(column => this._fixedOf(column));
    const sizeOf = (column: GridColumnDef): number =>
      this.#renderedWidths.get(column) ?? this.#widthOf(column) ?? 0;

    const offsets: number[] = [];
    let start = this._groupColumns.length * GROUP_COLUMN_WIDTH;

    columns.forEach((column, index) => {
      if (fixed[index] === 'start') {
        offsets[index] = start;
        start += sizeOf(column);
      }
    });

    let end = 0;

    for (let index = columns.length - 1; index >= 0; index--) {
      if (fixed[index] === 'end') {
        offsets[index] = end;
        end += sizeOf(columns[index]);
      }
    }

    const nextColumnMode = this.resizeMode === 'next-column';

    return columns.map((column, index) => {
      const side = fixed[index];
      const format = this.#formatContext(column);
      const alignment = resolveAlignment(column, format.dataType);
      const classes: string[] = [];
      let style = '';

      if (side === 'start') {
        classes.push(fixed[index + 1] === 'start' ? 'fixed fixed-start' : 'fixed fixed-start fixed-start-edge');
        style = `inset-inline-start: ${offsets[index]}px`;
      } else if (side === 'end') {
        classes.push(fixed[index - 1] === 'end' ? 'fixed fixed-end' : 'fixed fixed-end fixed-end-edge');
        style = `inset-inline-end: ${offsets[index]}px`;
      }

      if (alignment === 'center' || alignment === 'end') {
        classes.push(`align-${alignment}`);
      }

      if (column.wrap) {
        classes.push('wrap');
      }

      const className = classes.join(' ');
      const minWidth = column.minWidth ?? null;
      const headerStyles: Record<string, string | undefined> = {
        minWidth: minWidth === null ? undefined : `${minWidth}px`,
        insetInlineStart: side === 'start' ? `${offsets[index]}px` : undefined,
        insetInlineEnd: side === 'end' ? `${offsets[index]}px` : undefined,
      };
      const truncate = !column.wrap && !column.renderer && column.booleanDisplay !== 'icon';
      const bounds = this._boundsOf(column);
      const resizable = this.#isResizable(column) && (!nextColumnMode || !!this._resizeNeighbor(column));

      return {
        column,
        id: columnIdOf(column),
        format,
        className,
        cellClassName: truncate ? `${className} truncate` : className,
        style,
        headerClasses: Object.fromEntries(classes.flatMap(names => names.split(' ')).map(name => [name, true])),
        headerStyles,
        resizable,
        bounds,
        width: this.#widthOf(column) ?? this.#renderedWidths.get(column),
      };
    });
  }

  // -------------------------------------------------------------- row model

  readonly #isExpanded = (key: string): boolean =>
    this.#expansion.get(key) ?? this.autoExpandGroups;

  /** items → ordenar → agrupar → achatar; cada etapa só refaz o que sujou. */
  #ensureRows(): void {
    const language = this.#effectiveLanguage;
    const languageChanged = language !== this.#modelLanguage;
    this.#modelLanguage = language;

    if (languageChanged) {
      this.#rankCache.clear();
    }

    if (this.#sortDirty || (languageChanged && this.#sorting.length)) {
      const rowSorting = this.#sorting.filter(spec => !this.#isGrouped(spec.column));
      this.#sortedItems = sortItems(this.#items, rowSorting, language, this.#rankCache);
      this.#sortDirty = false;
      this.#groupsDirty = true;
    }

    if (this.#groupsDirty || (languageChanged && this._groupColumns.length)) {
      const orders = this._groupColumns.map(column => this.#orderOf(column));
      this.#groups = buildGroups(
        this.#sortedItems,
        this._groupColumns,
        column => createComparer(language, column.dataType),
        orders,
      );
      this.#groupsDirty = false;
      this.#rowsDirty = true;
    }

    if (this.#rowsDirty) {
      this.#rows = flattenRows(this.#sortedItems, this.#groups, this.#isExpanded, rowKeyOf);
      this.#rowsDirty = false;
    }
  }

  // -------------------------------------------------------------- ordenação

  #orderOf(column: GridColumnDef): GridSortOrder | undefined {
    return this.#sorting.find(spec => spec.column === column)?.order;
  }

  /**
   * Único ponto que muda a ordenação: dispara `u-grid-sorting` (cancelável)
   * ANTES e `u-grid-sort-change` depois. Devolve `false` se não mudou.
   */
  #changeSorting(next: GridSort[]): boolean {
    if (sameSorting(next, this.#sorting)) {
      return false;
    }

    const previous = this.getSorting();
    const copy = () => next.map(({ column, order }) => ({ column, order }));
    const sorting = new CustomEvent<GridSortEventDetail>('u-grid-sorting', {
      detail: { sorting: copy(), previous },
      bubbles: true,
      composed: true,
      cancelable: true,
    });

    if (!this.dispatchEvent(sorting)) {
      return false;
    }

    this.#sorting = copy();
    this.#sortDirty = true;
    this.requestUpdate();

    this.dispatchEvent(new CustomEvent<GridSortEventDetail>('u-grid-sort-change', {
      detail: { sorting: this.getSorting(), previous },
      bubbles: true,
      composed: true,
    }));

    return true;
  }

  /** Gesto do usuário que mudou a ordenação de `column`: avisa o leitor de tela. */
  #announceSorting(column: GridColumnDef): void {
    const translation = this.#translation;
    const order = this.#orderOf(column);
    const params = { column: column.label ?? '' };

    this.#announcement = order
      ? formatMessage(translation.sortedAnnouncement, {
        ...params,
        order: order === 'asc' ? translation.sortAscending : translation.sortDescending,
      })
      : formatMessage(translation.clearSorting, params);
  }

  readonly #canSortByUser = (column: GridColumnDef): boolean =>
    this.#sortingMode !== 'none' && isColumnSortable(column);

  readonly #onSortPointerDown = (): void => {
    this.#dragged = false;
  };

  /** Clique/Enter/Espaço num cabeçalho. */
  readonly #onHeaderActivate = (column: GridColumnDef, event: MouseEvent | KeyboardEvent): void => {
    if (this.#consumeDrag(event) || !this.#canSortByUser(column)) {
      return;
    }

    const next = sortingAfterGesture(this.#sorting, column, sortGestureOf(event), this.#sortingMode, this.#isGrouped);

    if (this.#changeSorting(next)) {
      this.#announceSorting(column);
    }
  };

  /** Clique/Enter/Espaço no chip de uma coluna agrupada: alterna a direção dos grupos. */
  readonly #onGroupChipActivate = (column: GridColumnDef, event: MouseEvent | KeyboardEvent): void => {
    if (this.#consumeDrag(event) || !this.#canSortByUser(column)) {
      return;
    }

    const next = nextSorting(this.#sorting, column, toggleOrder(this.#orderOf(column) ?? 'asc'), true, this.#isGrouped);

    if (this.#changeSorting(next)) {
      this.#announceSorting(column);
    }
  };

  /** O clique que encerra um arrasto não ordena. */
  #consumeDrag(event: MouseEvent | KeyboardEvent): boolean {
    if (event.type !== 'click' || !this.#dragged) {
      return false;
    }

    this.#dragged = false;
    return true;
  }

  #dataTypeOf(column: GridColumnDef): GridColumnDataType | undefined {
    if (!this.#dataTypes.has(column)) {
      this.#dataTypes.set(column, resolveDataType(this.#items, column));
    }

    return this.#dataTypes.get(column);
  }

  #formatContext(column: GridColumnDef): FormatContext {
    const { trueText, falseText } = this.#translation;

    return { language: this.language, dataType: this.#dataTypeOf(column), trueText, falseText };
  }

  #groupValueText(row: GroupRow): string {
    return formatCellValue(row.value, row.firstItem, row.column, this.#formatContext(row.column));
  }

  /**
   * Dica com o texto completo só na célula truncada (reticências), calculada
   * ao passar o mouse — medir todas as células a cada render custaria caro.
   */
  readonly #updateCellHint = (event: Event): void => {
    const cell = (event.target as Element | null)?.closest?.('td.truncate');

    if (!(cell instanceof HTMLElement)) {
      return;
    }

    if (cell.scrollWidth > cell.clientWidth) {
      cell.title = cell.textContent.trim();
    } else {
      cell.removeAttribute('title');
    }
  };

  readonly #toggleGroup = (row: GroupRow): void => {
    this.#expansion.set(row.groupKey, !row.expanded);
    this.#rowsDirty = true;
    this.requestUpdate();
  };

  // ----------------------------------------------------------------- render

  override render() {

    this.#ensureRows();
    this.#hasWrap = this._visibleColumns.some(column => column.wrap);

    const rows = this.#rows;
    const virtualizer = this.#virtualizerController.getVirtualizer();

    if (virtualizer.options.count !== rows.length) {
      virtualizer.setOptions({ ...virtualizer.options, count: rows.length });
    }

    let virtualRows: VirtualItem[] = virtualizer.getVirtualItems();

    // Antes de medir (1º render, SSR, contêiner sem altura) o virtualizador
    // não devolve nada: mostra as primeiras linhas em vez de "sem dados".
    if (!virtualRows.length && rows.length) {
      virtualRows = rows.slice(0, INITIAL_RENDER_ROWS).map((row, index) => ({
        key: row.key,
        index,
        start: index * this.rowHeight,
        end: (index + 1) * this.rowHeight,
        size: this.rowHeight,
        lane: 0,
      }));
    }

    const layout = this.#columnLayout();
    const headerRows = this.showColumnHeaders ? 1 : 0;
    const classes = {
      stripped: this.striped,
      'row-lines': this.showRowLines,
      'column-lines': this.showColumnLines,
    };

    // Com todas as larguras definidas a tabela não estica: soma exata (como
    // no modo `widget` da referência). Com alguma automática, ocupa a largura.
    const fit = layout.length > 0 && layout.every(({ column }) =>
      this.#userWidths.has(column) || (column.width !== null && column.width !== undefined));

    return html`
      <div
        class="container ${classMap(classes)}"
        ${ref(this._containerRef)}
        role="grid"
        aria-rowcount="${rows.length + headerRows}"
        aria-colcount="${layout.length}">
        <div class="scroll-container" ${ref(this._scrollContainerRef)}>
          ${this.#renderToolbar()}
          <table class=${fit ? 'fit' : ''} @pointerover=${this.#updateCellHint}>
            <colgroup>${this.#renderColGroups(layout)}</colgroup>
            ${this.#renderColumnHeaders(layout)}
            <tbody role="rowgroup" style="height: ${virtualizer.getTotalSize() || virtualRows.length * this.rowHeight}px;">
              ${this.#renderBody(virtualRows, headerRows, layout)}
              <tr></tr>
            </tbody>
          </table>
        </div>
        ${this.#chooser.open ? this.#renderColumnChooser() : nothing}
      </div>
      <div class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">${this.#announcement}</div>
      <slot hidden @slotchange=${this.#readDeclarativeColumns}></slot>
    `;
  }

  #renderColGroups(layout: ColumnLayout[]): HTMLTemplateResult {
    return html`
      ${map(this._groupColumns, () => html`
        <col class="group-column"/>`)}
      ${map(layout, ({ column }) => {
        const width = this.#widthOf(column);
        const colStyles: { width?: string } = {};

        if (width !== undefined) {
          colStyles.width = `${width}px`;
        }

        return html`
          <col style="${styleMap(colStyles)}"/>`;
      })}
    `;
  }

  #renderColumnHeaders(layout: ColumnLayout[]) {
    if (!this.showColumnHeaders) {
      return nothing;
    }

    const rowSorting = this.#sorting.filter(spec => !this.#isGrouped(spec.column));
    const showIndex = rowSorting.length > 1;

    return html`
      <thead role="rowgroup">
        <tr id="header-columns-row" role="row" aria-rowindex="1">
          ${map(this._groupColumns, (_, index) => html`
            <th
              role="presentation"
              class="group-column sticky-cell"
              style="inset-inline-start: ${index * GROUP_COLUMN_WIDTH}px"></th>`)}
          ${map(layout, (cell, index) => {
            const { column } = cell;
            const position = rowSorting.findIndex(spec => spec.column === column);

            return renderHeaderCell({
              column,
              classes: cell.headerClasses,
              styles: cell.headerStyles,
              colIndex: index + 1,
              sortable: this.#canSortByUser(column),
              order: rowSorting[position]?.order,
              sortIndex: showIndex && position >= 0 ? position + 1 : undefined,
              onActivate: this.#onHeaderActivate,
              onPointerDown: this.#onSortPointerDown,
              onKeyDown: cell.resizable ? (event: KeyboardEvent) => this.#resize.keyDown(event, column, true) : undefined,
              trailing: cell.resizable ? this.#renderResizeHandle(cell) : nothing,
            });
          })}
        </tr>
      </thead>
    `;
  }

  #renderResizeHandle({ column, bounds, width }: ColumnLayout) {
    return html`<div
      class="resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label=${column.label ?? ''}
      aria-valuenow=${ifDefined(width === undefined ? undefined : Math.round(width))}
      aria-valuemin=${bounds.min}
      aria-valuemax=${ifDefined(Number.isFinite(bounds.max) ? bounds.max : undefined)}
      tabindex="0"
      title=${this.#translation.autoSize}
      @pointerdown=${(event: PointerEvent) => this.#resize.pointerDown(event, column)}
      @click=${(event: Event) => event.stopPropagation()}
      @dblclick=${(event: Event) => {
        event.stopPropagation();
        this.#userAutoSize(column);
      }}
      @keydown=${(event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          // Na alça, Enter/Espaço não chegam ao cabeçalho (que ordenaria).
          event.preventDefault();
          event.stopPropagation();

          if (event.key === 'Enter') {
            this.#userAutoSize(column);
          }
        } else {
          this.#resize.keyDown(event, column, false);
        }
      }}></div>`;
  }

  #renderBody(virtualRows: VirtualItem[], headerRows: number, layout: ColumnLayout[]) {

    if (!this.#rows.length) {
      return html`
        <tr>
          <td part="cell no-data" colspan="${Math.max(this._groupColumns.length + layout.length, 1)}">${this.#translation.noData}</td>
        </tr>
      `;
    }

    // As linhas ficam no fluxo da tabela, uma após a outra: todas descem o
    // início da 1ª linha virtual (vale também com alturas diferentes, `wrap`).
    const offset = virtualRows[0]?.start ?? 0;

    return keyedRows(
      virtualRows,
      virtualRow => virtualRow.key,
      virtualRow => this.#renderRow(virtualRow, offset, this.#rows[virtualRow.index], headerRows, layout),
    );
  }

  #renderRow(virtualRow: VirtualItem, offset: number, row: Row, headerRows: number, layout: ColumnLayout[]) {
    const parity = row.isGroup
      ? ''
      : row.index % 2 === 0 ? 'odd' : 'even';

    const classes: Record<string, boolean> = {
      'group-row': row.isGroup,
      last: virtualRow.index === this.#rows.length - 1,
    };

    if (parity) {
      classes[parity] = true;
    }

    return html`
      <tr
        style="transform: translateY(${offset}px); height: ${this.rowHeight}px;"
        data-index=${virtualRow.index}
        role="row"
        aria-rowindex="${virtualRow.index + 1 + headerRows}"
        aria-level=${row.isGroup ? row.level + 1 : nothing}
        class="${classMap(classes)}"
        part="row ${row.isGroup ? 'group-row' : parity}">
        ${row.isGroup
          ? renderGroupRowCells({
            row,
            totalColumns: this._groupColumns.length + layout.length,
            separator: this.#translation.groupLabelSeparator,
            valueText: this.#groupValueText(row),
            onToggle: this.#toggleGroup,
          })
          : this.#renderDataRowCells(row, layout)}
      </tr>
    `;
  }

  #renderDataRowCells(row: DataRow, layout: ColumnLayout[]) {
    return html`
      ${map(this._groupColumns, (_, index) => html`
        <td
          role="presentation"
          class="group-column sticky-cell"
          style="inset-inline-start: ${index * GROUP_COLUMN_WIDTH}px"></td>`)}
      ${map(layout, (cell, index) => html`
        <td
          class=${cell.cellClassName}
          style=${cell.style}
          role="gridcell"
          aria-colindex="${index + 1}">${renderDataCell(this, row, cell.column, cell.id, cell.format)}</td>`)}
    `;
  }

  /** Barra acima da tabela: painel de grupos e/ou botão do seletor de colunas. */
  #renderToolbar() {
    if (!this.showGroupPanel && !this.columnChooser) {
      return nothing;
    }

    const translation = this.#translation;

    return html`
      <div class="header">
        ${this.showGroupPanel ? this.#renderGroupPanel() : nothing}
        ${this.columnChooser
          ? html`
            <button
              class="column-chooser-button"
              type="button"
              aria-label=${translation.columnChooser}
              title=${translation.columnChooser}
              aria-haspopup="dialog"
              aria-expanded=${this.#chooser.open ? 'true' : 'false'}
              @click=${() => this.#chooser.toggle()}>${columnChooserIcon}</button>`
          : nothing}
      </div>
    `;
  }

  #renderGroupPanel() {
    return html`
      <div class="group-container" ${ref(this._groupContainerRef)}>
        ${this._groupColumns.length
          ? html`
            ${map(this._groupColumns, (column, index) => this.#renderGroupChip(column, index))}
            <div class="group-end-dropzone"></div>`
          : html`<div class="drag-here">${this.#translation.dragToGroup}</div>`}
      </div>
    `;
  }

  /** Chip de uma coluna agrupada: arrastável e, se ordenável, alterna a direção dos grupos. */
  #renderGroupChip(column: GridColumnDef, index: number) {
    const sortable = this.#canSortByUser(column);
    const order = this.#orderOf(column) ?? 'asc';
    const translation = this.#translation;

    return html`
      <div
        class="group ${classMap({ sortable })}"
        part="group-chip"
        style="--_order: ${index}"
        role=${ifDefined(sortable ? 'button' : undefined)}
        tabindex=${ifDefined(sortable ? 0 : undefined)}
        aria-label=${ifDefined(sortable ? `${column.label ?? ''}, ${order === 'asc' ? translation.sortAscending : translation.sortDescending}` : undefined)}
        @pointerdown=${sortable ? this.#onSortPointerDown : nothing}
        @click=${sortable ? (event: MouseEvent) => this.#onGroupChipActivate(column, event) : nothing}
        @keydown=${sortable
          ? (event: KeyboardEvent) => {
            if (isActivationKey(event) && !event.repeat) {
              event.preventDefault();
              this.#onGroupChipActivate(column, event);
            }
          }
          : nothing}>
        <span class="group-label">${column.label}</span>${renderSortIndicator(order)}
      </div>`;
  }

  #renderColumnChooser() {
    const visibleCount = this._visibleColumns.length;
    const items: ColumnChooserItem[] = this._regularColumns
      .filter(column => column.showInChooser !== false)
      .map(column => {
        const visible = this._isColumnVisible(column);

        return {
          column,
          id: columnIdOf(column),
          visible,
          canToggle: !visible || visibleCount > 1,
          fixed: this._fixedOf(column),
        };
      });

    return renderColumnChooser({
      items,
      translation: this.#translation,
      onVisibleChange: (column, visible) => this._userSetVisible(column, visible),
      onFixedChange: (column, fixed) => this._userSetFixed(column, fixed),
      onKeyDown: this.#chooser.onKeyDown,
    });
  }

  /**
   * Liga os elementos do cabeçalho e do painel de grupos ao arrasto. Roda só
   * quando colunas/painéis mudam (não a cada render de rolagem) e é
   * idempotente: o mesmo elemento nunca é registrado duas vezes, e os que
   * saíram do DOM são soltos.
   */
  #syncDragAndDrop(): void {
    const root = this.renderRoot;

    this.#columnDragAndDrop.prune();
    this.#groupDragAndDrop.prune();

    root.querySelectorAll<HTMLElement>('th.header-column').forEach((th, index) => {
      const column = this._visibleColumns[index];

      if (column) {
        this._nativeColumnMap.set(th, column);
        this.#columnDragAndDrop.attach(th);
      }
    });

    root.querySelectorAll<HTMLElement>('.group').forEach((chip, index) => {
      const column = this._groupColumns[index];

      if (column) {
        this._nativeColumnMap.set(chip, column);
        this.#groupDragAndDrop.attach(chip);
      }
    });

    const dragHere = root.querySelector<HTMLElement>('.drag-here');

    if (dragHere) {
      this.#groupDragAndDrop.attachToGroupDropTarget(dragHere, 0);
    }

    const endZone = root.querySelector<HTMLElement>('.group-end-dropzone');

    if (endZone) {
      this.#groupDragAndDrop.attachToGroupDropTarget(endZone, 9998);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'u-grid': DataGrid;
  }

  interface HTMLElementEventMap {
    'u-grid-sorting': CustomEvent<GridSortEventDetail>;
    'u-grid-sort-change': CustomEvent<GridSortEventDetail>;
    'u-grid-column-resize': CustomEvent<GridColumnResizeEventDetail>;
    'u-grid-column-visibility-change': CustomEvent<GridColumnVisibilityChangeEventDetail>;
    'u-grid-column-reorder': CustomEvent<GridColumnReorderEventDetail>;
  }
}
