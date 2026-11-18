import { ContextConsumer } from '@lit/context';

import { html, type HTMLTemplateResult, LitElement, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { map } from 'lit/directives/map.js';
import { createRef, type Ref, ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';

import { booleanAttribute, type LegacyAttributes } from './attribute-converters.js';
import {
  ColumnChooserController,
  columnChooserIcon,
  type ColumnChooserItem,
  renderColumnChooser,
} from './features/column-chooser.js';
import { ColumnDragAndDropAdapter } from './features/column-dnd.js';
import { releaseInteractions } from './features/drag-helper.js';
import { isRtl } from './features/drop-position.js';
import { FilterRowController, renderFilterCell, renderFilterMenu } from './features/filter-row.js';
import { FilteringController } from './features/filtering.js';
import { GroupDragAndDropAdapter } from './features/group-dnd.js';
import {
  type GroupPanelMenuAction,
  GroupPanelMenuController,
  isContextMenuKey,
  renderGroupPanelMenu,
} from './features/group-panel-menu.js';
import { HeaderFilterController, renderHeaderFilter, renderHeaderFilterButton } from './features/header-filter.js';
import {
  type CellPosition,
  HEADER_ROW,
  type NavigationKey,
  navigationKeyOf,
  nextCell,
  rangeBetween,
} from './features/keyboard.js';
import {
  clampWidth,
  ColumnResizeController,
  DEFAULT_MIN_COLUMN_WIDTH,
  type GridColumnResizeEventDetail,
  type GridResizeMode,
  measureContentWidth,
  type WidthBounds,
} from './features/resize.js';
import { renderHighlighted, renderSearchPanel, SearchController } from './features/search.js';
import {
  countSelected,
  type GridSelectionMode,
  normalizeSelectionMode,
  type SelectionChange,
  SelectionModel,
} from './features/selection.js';
import {
  formatMessage,
  type GridSortMode,
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
  type GridColumnRef,
  type GridGroupPath,
  type GridGroupSummaryItem,
  type GridSort,
  type GridSortOrder,
  type GridSummary,
  type GridSummaryItem,
  type GridSummaryValue,
  isColumnGroupable,
  type GridFilterCondition,
  type GridFilterExpression,
  isColumnFilterable,
  isColumnSortable,
} from './grid-column-def.js';
import { type DataGridColumn, type GridColumnChange } from './grid-column.js';
import {
  DEFAULT_GRID_LANGUAGE,
  type GridI18n,
  gridLanguageContext,
  observeDocumentLanguage,
  resolveGridTranslation,
} from './grid-i18n.js';
import { styles } from './grid.styles.js';
import { renderDataCell } from './render/cell.js';
import { renderIndentCells, renderSummaryCells, renderTotalFooter, type SummaryText } from './render/footer.js';
import { groupRowLabel, renderGroupRowCells } from './render/group-row.js';
import { isActivationKey, renderHeaderCell, renderSortIndicator } from './render/header.js';
import { keyedRows } from './render/keyed-rows.js';
import { RowVirtualizer, type VirtualWindow } from './render/virtualizer.js';
import { createComparer } from './row-model/compare.js';
import { distinctValues, type DistinctValues } from './row-model/distinct.js';
import {
  allValuesConvert,
  applyMask,
  combineFilters,
  compileFilter,
  type ColumnFilterKind,
  type FilterContext,
  filterItems,
  hasColumnCondition,
  replaceColumnCondition,
  searchExpression,
} from './row-model/filter.js';
import { flattenRows, RowList } from './row-model/flatten.js';
import { createTextMatcher, foldText } from './row-model/fold.js';
import {
  DEFAULT_DATE,
  displayAlphabet,
  formatCell,
  type FormatContext,
  formatCellValue,
  getDateTimeFormat,
  getNumberFormat,
  resolveAlignment,
  resolveDataType,
} from './row-model/format.js';
import { buildGroups, groupKeyOf } from './row-model/group.js';
import { type RankCache, sortOrder } from './row-model/sort.js';
import { type SummaryFormatContext, formatSummaryValue, summarize, type SummarySpec } from './row-model/summary.js';
import type { DataRow, GroupFooterRow, GroupNode, GroupRow, Row } from './row-model/types.js';

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
  GridColumnRef,
  GridGroupPath,
  GridGroupSummaryItem,
  GridFilterCondition,
  GridFilterExpression,
  GridFilterOperation,
  GridSort,
  GridSortOrder,
  GridSummary,
  GridSummaryAggregator,
  GridSummaryFormat,
  GridSummaryItem,
  GridSummaryType,
  GridSummaryValue,
} from './grid-column-def.js';
export type { GridSortMode, GridSortingMode } from './features/sorting.js';
export type { GridSelectionMode } from './features/selection.js';
export { DataGridColumn } from './grid-column.js';

/** @deprecated Use `DataGridColumn`. */
export type UmDataGridColumn = DataGridColumn;

/** Who changed the state: a user gesture or a method call. */
export type GridChangeSource = 'user' | 'api';

/** `detail` of `u-grid-sorting` and `u-grid-sort-change`. */
export interface GridSortEventDetail {
  /** New sorting (a copy). */
  sorting: GridSort[];
  /** Previous sorting (a copy). */
  previous: GridSort[];
  /** `user` (header or group chip) or `api` (`sortColumn`, `clearSorting`). */
  source: GridChangeSource;
}

/** `detail` of `u-grid-group-change`. */
export interface GridGroupEventDetail {
  /** Grouped columns after the change, outermost first (a copy). */
  grouping: GridColumnDef[];
  /** Grouped columns before the change (a copy). */
  previous: GridColumnDef[];
  /** `user` (drag and drop) or `api` (`groupColumn`, `ungroupColumn`, `moveColumn`). */
  source: GridChangeSource;
}

/** `detail` of `u-grid-group-expansion-change`. */
export interface GridGroupExpansionChangeEventDetail {
  /** Values of the group from the outermost level; `null` when several groups changed (`expandAllGroups`/`collapseAllGroups`). */
  groupPath: GridGroupPath | null;
  /** Grouping level (0-based); `null` = every level. */
  groupIndex: number | null;
  /** New state. */
  expanded: boolean;
  /** `user` (toggle button, group panel menu) or `api`. */
  source: GridChangeSource;
}

/** `detail` of `u-grid-filter-change`. */
export interface GridFilterEventDetail {
  /** Column filter after the change (read-only copy). */
  filterValue: GridFilterExpression | null;
  /** Column filter before the change. */
  previousFilterValue: GridFilterExpression | null;
  /** Search text after the change. */
  searchText: string;
  /** Search text before the change. */
  previousSearchText: string;
  /** `user` (filter row, header filter, search panel) or `api` (`clearFilter`). */
  source: GridChangeSource;
}

/** `detail` of `u-grid-selection-change`. */
export interface GridSelectionChangeEventDetail {
  /** Selected keys after the change (the frozen array also returned by `selectedKeys`). */
  selectedKeys: readonly unknown[];
  /** Selected keys before the change (frozen). */
  previous: readonly unknown[];
  /** Keys that entered the selection. */
  added: readonly unknown[];
  /** Keys that left the selection. */
  removed: readonly unknown[];
  /** `user` (click, checkbox, keyboard) or `api` (selection methods, `selectionMode` switched from `multiple` to `single`). */
  source: GridChangeSource;
}

/** Kind of the active cell: column header, data cell, selection checkbox cell, group row or summary row (group footer, totals). */
export type GridCellType = 'header' | 'data' | 'selection' | 'group' | 'summary';

/** `detail` of `u-grid-focus-change`. */
export interface GridFocusChangeEventDetail {
  /** Key of the data row of the active cell (the item without `keyExpr`); `null` in headers, group and summary rows. */
  rowKey: unknown;
  /** Column of the active cell; `null` in the selection column and in group rows. */
  column: GridColumnDef | null;
  /** Kind of the active cell. */
  cellType: GridCellType;
  /** `rowKey` before the change. */
  previousRowKey: unknown;
  /** `column` before the change. */
  previousColumn: GridColumnDef | null;
  /** `user` (keyboard, click) or `api` (`focusCell`). */
  source: GridChangeSource;
}
export type { GridColumnResizeEventDetail, GridResizeMode } from './features/resize.js';
export { setGridLanguage, setGridTranslation, gridLanguageContext, type GridI18n, type GridI18nInput } from './grid-i18n.js';

/** Largura (px) de cada coluna de recuo de grupo; igual ao `--_group-column-width`. */
const GROUP_COLUMN_WIDTH = 32;

/** Largura (px) da coluna de caixas de seleção; igual ao `--_selection-column-width`. */
const SELECTION_COLUMN_WIDTH = 48;

/** Coluna de caixas de seleção entre as navegáveis (não é `GridColumnDef`). */
const SELECTION_COLUMN = 'selection' as const;

type NavColumn = GridColumnDef | typeof SELECTION_COLUMN;

/** Célula ativa como o hospedeiro a vê (eventos). */
interface PublicFocus {
  rowKey: unknown;
  column: GridColumnDef | null;
  cellType: GridCellType;
}

/** `detail` of `u-grid-column-visibility-change`. */
export interface GridColumnVisibilityChangeEventDetail {
  /** The column shown or hidden. */
  column: GridColumnDef;
  /** New visibility. */
  visible: boolean;
}

/** `detail` of `u-grid-column-fixed-change`. */
export interface GridColumnFixedChangeEventDetail {
  /** The column fixed or unfixed. */
  column: GridColumnDef;
  /** New side (`null` = not fixed). */
  fixed: GridColumnFixed;
  /** Side before the change. */
  previousFixed: GridColumnFixed;
}

/** `detail` of `u-grid-column-reorder`. Positions among the regular (non-grouped) columns; hidden ones count. */
export interface GridColumnReorderEventDetail {
  /** The moved column. */
  column: GridColumnDef;
  /** New position. */
  index: number;
  /** Position before the move. */
  previousIndex: number;
  /** @deprecated Use `previousIndex`. */
  fromIndex: number;
  /** @deprecated Use `index`. */
  toIndex: number;
}

/** Atributos renomeados na revisão de API (spec 15): antigo → novo. */
const LEGACY_ATTRIBUTES: LegacyAttributes = {
  rowheight: 'row-height',
  showrowlines: 'show-row-lines',
  showcolumnlines: 'show-column-lines',
};

/**
 * Separador de itens de lista do idioma (`", "`, `"、"`, `"، "`), tirado do
 * `Intl.ListFormat`: o 1º separador de pontuação entre dois itens, sem a
 * conjunção (o árabe só pontua no tipo `unit`).
 */
const listSeparatorOf = (language: string): string => {
  const options: Intl.ListFormatOptions[] = [{ type: 'conjunction', style: 'long' }, { type: 'unit', style: 'short' }];

  for (const option of options) {
    try {
      const text = new Intl.ListFormat(language, option).format(['\u0001', '\u0002', '\u0003']);
      const match = (/^\s*\p{P}\s*/u).exec(text.slice(text.indexOf('\u0001') + 1, text.indexOf('\u0002')));

      if (match) {
        return match[0];
      }
    } catch {
      // idioma inválido: tenta o próximo / padrão
    }
  }

  return ', ';
};

/** Mesmos resumos (item, coluna, tipo de dado), na mesma ordem? */
const sameSummaries = (a: readonly ResolvedSummary[], b: readonly ResolvedSummary[]): boolean =>
  a.length === b.length && a.every((summary, index) => {
    const other = b[index];

    return summary.item === other.item
      && summary.spec.column === other.spec.column
      && summary.spec.type === other.spec.type
      && summary.spec.dataType === other.spec.dataType;
  });

/** Resumo com a coluna resolvida e pronto para calcular. */
interface ResolvedSummary<T extends GridSummaryItem = GridSummaryItem> {
  item: T;
  spec: SummarySpec;
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

// Ícones Material Symbols (Apache 2.0): check e remove (estado misto).
const CHECK_PATH = 'M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z';
const MIXED_PATH = 'M200-440v-80h560v80H200Z';

/** Linha de dados (não grupo nem rodapé de grupo). */
const isDataRow = (row: Row | undefined): row is DataRow => !!row && !row.isGroup && !row.isFooter;

/** Identidade estável da linha ativa: item (dados), chave (grupo, rodapé de grupo) ou o rodapé de totais. */
type ActiveRef = { item: unknown } | { rowKey: string } | { totals: true };

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** Enter/F2: foca o 1º elemento interativo da célula (inclusive o projetado por `renderer`). */
const focusFirstWithin = (cell: HTMLElement): boolean => {
  const slotted = [...cell.querySelectorAll('slot')].flatMap(slot => slot.assignedElements({ flatten: true }));

  for (const root of [cell, ...slotted]) {
    const target = root !== cell && root.matches(FOCUSABLE) ? root : root.querySelector(FOCUSABLE);

    if (target instanceof HTMLElement || target instanceof SVGElement) {
      target.focus();
      return true;
    }
  }

  return false;
};

/**
 * Data grid with row virtualization, grouping, sorting, filtering (filter
 * row, header filter, search panel), column resizing, fixing, hiding and
 * reordering, i18n and SSR.
 *
 * @summary Data grid web component.
 *
 * @slot - `<u-grid-column>` elements (declarative columns).
 *
 * @fires {CustomEvent<GridSortEventDetail>} u-grid-sorting - Before the sorting changes (user or API). Cancelable.
 * @fires {CustomEvent<GridSortEventDetail>} u-grid-sort-change - After the sorting changed (user or API).
 * @fires {CustomEvent<GridGroupEventDetail>} u-grid-group-change - After the grouping changed (user or API).
 * @fires {CustomEvent<GridGroupExpansionChangeEventDetail>} u-grid-group-expansion-change - After groups were expanded or collapsed (user or API).
 * @fires {CustomEvent<GridFilterEventDetail>} u-grid-filter-change - After the user filtered (filter row, header filter, search panel) or `clearFilter()` ran.
 * Setting `filterValue`/`searchText` does not fire it.
 * @fires {CustomEvent<GridColumnResizeEventDetail>} u-grid-column-resize - The user finished resizing a column (pointer release, keyboard or double-click auto-size).
 * @fires {CustomEvent<GridColumnVisibilityChangeEventDetail>} u-grid-column-visibility-change - The user showed or hid a column in the column chooser.
 * @fires {CustomEvent<GridColumnFixedChangeEventDetail>} u-grid-column-fixed-change - The user fixed or unfixed a column in the column chooser.
 * @fires {CustomEvent<GridColumnReorderEventDetail>} u-grid-column-reorder - The user moved a column (drag and drop or Alt+Shift+←/→ on the header).
 * @fires {CustomEvent<GridSelectionChangeEventDetail>} u-grid-selection-change - The selection changed: user gesture, selection method, `multiple` → `single` (not the `selectedKeys` setter).
 * @fires {CustomEvent<GridFocusChangeEventDetail>} u-grid-focus-change - The active cell changed: keyboard, click, `focusCell` (not the `focusedRowKey` setter nor a relocation).
 *
 * @cssprop --u-grid-background-color - Grid background.
 * @cssprop --u-grid-striped-background-color - Background of even rows when `striped`.
 * @cssprop --u-grid-header-background-color - Header and sticky cells background.
 * @cssprop --u-grid-toolbar-height - Height of the bar above the table (group panel, chooser button). Default `56px`.
 * @cssprop --u-grid-toolbar-padding - Padding of the bar. Default `8px 16px`.
 * @cssprop --u-grid-toolbar-block-padding - Block padding of the bar. Default `8px`.
 * @cssprop --u-grid-toolbar-inline-padding - Inline padding of the bar. Default: the cell inline padding.
 * @cssprop --u-grid-header-cell-height - Height of the column header cells. Default `46px`.
 * @cssprop --u-grid-header-cell-padding - Header cell padding.
 * @cssprop --u-grid-header-cell-font-size - Header cell font size. Default `0.8125rem`.
 * @cssprop --u-grid-header-cell-font-weight - Header cell font weight.
 * @cssprop --u-grid-cell-padding - Data cell padding. Default `13px 16px`.
 * @cssprop --u-grid-cell-block-padding - Block padding of data and header cells. Default `13px`.
 * @cssprop --u-grid-cell-inline-padding - Inline padding of data and header cells. Default `16px`.
 * @cssprop --u-grid-cell-font-size - Data cell font size. Default `0.875rem`.
 * @cssprop --u-grid-cell-font-weight - Data cell font weight.
 * @cssprop --u-grid-row-hover-opacity - Intensity of the row hover tint (`0%` disables it). Default: state-layer hover token or `8%`.
 * @cssprop --u-grid-line-opacity - Opacity of the row/column lines (derived from the text color). Default `20%`.
 * @cssprop --u-grid-line-width - Base line thickness. Default `1px`.
 * @cssprop --u-grid-row-line-width - Row separator thickness.
 * @cssprop --u-grid-column-line-width - Column separator thickness.
 * @cssprop --u-grid-group-toggle-color - Group expand/collapse chevron (and chooser button) color.
 * @cssprop --u-grid-group-toggle-shape - Corner radius of the chevron button. Default `50%`.
 * @cssprop --u-grid-group-row-emphasis - Emphasis of the group row text. Default `80%`.
 * @cssprop --u-grid-group-chip-height - Group chip height. Default `32px`.
 * @cssprop --u-grid-group-chip-padding - Group chip inline padding. Default `16px`.
 * @cssprop --u-grid-group-chip-shape - Group chip corner radius. Default `8px`.
 * @cssprop --u-grid-group-chip-outline-color - Group chip border color.
 * @cssprop --u-grid-group-chip-outline-width - Group chip border width. Default `1px`.
 * @cssprop --u-grid-group-chip-font-size - Group chip font size.
 * @cssprop --u-grid-group-chip-font-weight - Group chip font weight.
 * @cssprop --u-grid-group-chip-line-height - Group chip line height.
 * @cssprop --u-grid-group-chip-letter-spacing - Group chip letter spacing.
 * @cssprop --u-grid-focus-ring-color - Keyboard focus ring color.
 * @cssprop --u-grid-focus-ring-width - Keyboard focus ring width. Default `2px`.
 * @cssprop --u-grid-selected-row-background-color - Background of selected rows. Default: primary color at 12%.
 * @cssprop --u-grid-sorted-header-color - Text color of sorted column headers.
 * @cssprop --u-grid-sort-indicator-size - Size of the sort arrow. Default `1.125em`.
 * @cssprop --u-grid-drop-indicator-color - Drag-and-drop drop indicator color.
 * @cssprop --u-grid-drop-indicator-width - Drop indicator thickness. Default `3px`.
 * @cssprop --u-grid-resize-handle-width - Width of the column resize handle. Default `8px`.
 * @cssprop --u-grid-fixed-shadow-color - Shadow at the edge of fixed columns while scrolling.
 * @cssprop --u-grid-column-chooser-background-color - Column chooser background.
 * @cssprop --u-grid-column-chooser-shape - Column chooser corner radius. Default `12px`.
 * @cssprop --u-grid-summary-background-color - Background of the totals footer and group footers. Default: the header background.
 * @cssprop --u-grid-summary-cell-font-weight - Font weight of summary cells. Default `500`.
 * @cssprop --u-grid-filter-row-height - Height of the filter row. Default: `--u-grid-header-cell-height` (`46px`).
 * @cssprop --u-grid-search-highlight-background-color - Background of the search matches in cells.
 * @cssprop --u-grid-search-highlight-color - Text color of the search matches in cells.
 * @cssprop --u-grid-header-filter-button-active-color - Color of the header filter button of a filtered column.
 * @cssprop --u-grid-header-filter-background-color - Header filter popover background.
 * @cssprop --u-grid-header-filter-shape - Header filter popover corner radius. Default `12px`.
 *
 * @csspart row - Every body row (`<tr>`; not the header nor the totals footer).
 * @csspart group-row - Group header rows.
 * @csspart odd - Data rows in odd positions (the first data row is `odd`).
 * @csspart even - Data rows in even positions.
 * @csspart selected - Selected data rows (with `row`).
 * @csspart cell - Data cells (`<td>`).
 * @csspart selection-cell - Cells and header of the selection checkbox column.
 * @csspart selection-checkbox - The selection checkboxes (rows and "select all").
 * @csspart no-data - The cell rendered in the empty state.
 * @csspart header-cell - Column header cells (`<th>`).
 * @csspart sort-indicator - The sort arrow (and priority number) in headers and group chips.
 * @csspart group-chip - Group chips in the group panel.
 * @csspart column-chooser - The column chooser popover.
 * @csspart summary-row - Rows with summaries: the totals footer and group footers.
 * @csspart total-row - The totals footer row.
 * @csspart group-footer-row - Group footer rows (summaries with `display: 'footer'`).
 * @csspart summary-cell - Cells with summaries (footers and `display: 'column'` in group rows).
 * @csspart group-count - Count and inline summaries in a group row (`"(3, Sum of Population: 1,234)"`).
 * @csspart group-panel-menu - The group panel context menu.
 * @csspart filter-row - The filter row (`<tr>`) below the column headers.
 * @csspart filter-cell - Cells of the filter row.
 * @csspart filter-editor - Editors (inputs and selects) of the filter row.
 * @csspart filter-operation-button - The operation button of a filter row cell.
 * @csspart search-input - The search panel input.
 * @csspart header-filter-button - The funnel button in a column header (`header-filter`).
 * @csspart header-filter - The header filter popover.
 * @csspart search-highlight - Search matches (`<mark>`) in native cells (not in `renderer` cells).
 */
@customElement('u-grid')
export class DataGrid extends LitElement {
  static override styles = [styles];

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, ...Object.keys(LEGACY_ATTRIBUTES)];
  }

  // ---------------------------------------------------------------- dados

  #items: readonly any[] = [];

  /**
   * Groups start expanded. INITIAL default: afterwards expansion is grid
   * state (`expandGroup`, `expandAllGroups`…); changing it resets that state.
   */
  @property({ type: Boolean, converter: booleanAttribute(false), attribute: 'auto-expand-groups' }) autoExpandGroups = false;

  /**
   * Totals (footer fixed at the bottom) and group summaries (property only).
   * Recomputed when the data, the grouping or the summary changes.
   */
  @property({ attribute: false })
  get summary(): GridSummary | null {
    return this.#summary;
  }

  set summary(value: GridSummary | null | undefined) {
    this.#summary = value ?? null;
    this.#summaryDirty = true;
  }

  #summary: GridSummary | null = null;

  /** Row items (property only). The grid never mutates this array or its items. */
  @property({ attribute: false })
  get items(): any[] {
    return this.#items as any[];
  }

  set items(items: readonly any[] | null | undefined) {
    this.#items = items ?? [];
    this.#sortDirty = true;
    this.#rankCache.clear();
    this.#dataTypes.clear();
    this.#summaryDirty = true;
    // Totais acompanham o conjunto de linhas (o filtro da frente 04 também
    // tem de ligar isto); a ordem não muda o resultado.
    this.#totalsDirty = true;
    this.#allConvert.clear();
    this.#filtering.invalidate();
    this.#autoWidthDirty = true;
    this.#layoutDirty = true;
  }

  /** `items` filtrados, na ordem da ordenação atual (o próprio `items` sem filtro nem ordenação). */
  #sortedItems: readonly any[] = [];
  /**
   * Índices de `items` na ordem da ordenação (`null` = sem ordenação,
   * `undefined` = por calcular). Só fica guardado com filtro ativo (mudar o
   * filtro não reordena); sem filtro é solto depois de montar `#sortedItems`
   * (4 bytes por linha a menos).
   */
  #sortOrder: Int32Array | null | undefined;
  /** Máscara do filtro aplicada em `#sortedItems` (`null` = sem filtro). */
  #appliedMask: Uint8Array | null = null;
  #viewDirty = true;
  /** Postos por coluna para os `items` e o idioma atuais (inverter a direção não reordena textos). */
  readonly #rankCache: RankCache = new Map();
  #groups: GroupNode[] = [];
  #rows = new RowList(rowKeyOf);
  #sortDirty = true;
  #groupsDirty = true;
  #rowsDirty = true;
  #modelLanguage: string | undefined;
  /** `dataType` efetivo (informado ou inferido dos itens) por coluna. */
  readonly #dataTypes = new Map<GridColumnDef, GridColumnDataType | undefined>();
  /** Por coluna: todo valor converte no tipo (atalho da busca); vale para os `items` atuais. */
  readonly #allConvert = new Map<GridColumnDef, boolean>();
  #hasWrap = false;
  #measuredWrap = false;
  /**
   * Expansão de grupos por chave (sobrevive a troca de dados, ordenação e
   * filtro). Só guarda o que difere do padrão do nível — o mapa não cresce
   * com grupos que voltaram ao padrão.
   */
  readonly #expansion = new Map<string, { expanded: boolean; level: number }>();
  /** Padrão por nível vindo de `expandAllGroups(n)`/`collapseAllGroups(n)`. */
  #levelExpansion: (boolean | undefined)[] = [];
  /** Padrão de todos os níveis vindo de `expandAllGroups()`/`collapseAllGroups()`. */
  #allExpansion: boolean | undefined;

  // --------------------------------------------------------------- resumos

  #summaryDirty = true;
  #totalsDirty = true;
  #totalSpecs: ResolvedSummary[] = [];
  #groupSpecs: ResolvedSummary<GridGroupSummaryItem>[] = [];
  #totals: unknown[] = [];
  #listSeparator: { language: string; separator: string } | undefined;

  // -------------------------------------------------------------- colunas

  /** Colunas por propriedade; `undefined` = usar os `<u-grid-column>` filhos. */
  #columnsProperty: GridColumnDef[] | undefined;
  #declarativeColumns: GridColumnDef[] = [];

  /** @internal */
  readonly _nativeColumnMap = new WeakMap<HTMLElement, GridColumnDef>();

  /**
   * Ordem atual (do usuário) das colunas comuns e de grupo — estado do grid.
   * As comuns ficam sempre em blocos: fixas no início, livres, fixas no fim.
   */
  /** @internal */
  @state() _groupColumns: GridColumnDef[] = [];
  /** @internal */
  @state() _regularColumns: GridColumnDef[] = [];

  /**
   * Colunas comuns visíveis, na ordem de exibição (recalculado a cada update).
   * @internal
   */
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
   * Column definitions (property only). When set they take precedence over
   * the `<u-grid-column>` children. The grid never mutates the array or the
   * objects.
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
  @property({ attribute: 'sort-mode' }) sortMode: GridSortMode = 'single';

  /** @deprecated Use `sortMode` (attribute `sort-mode`). */
  @property()
  get sorting(): GridSortMode {
    return this.sortMode;
  }

  set sorting(value: GridSortMode) {
    this.#deprecated('sorting', 'sortMode');
    this.sortMode = value;
  }

  /** Ordenação atual, em ordem de prioridade. Inclui a direção das colunas agrupadas. */
  #sorting: GridSort[] = [];
  /** Texto da região `aria-live` (último gesto de ordenação). */
  #announcement = '';
  /** Houve arrasto desde o último `pointerdown` no cabeçalho/chip. */
  #dragged = false;

  get #sortingMode(): GridSortMode {
    return this.sortMode === 'none' || this.sortMode === 'multiple' ? this.sortMode : 'single';
  }

  readonly #isGrouped = (column: GridColumnDef): boolean => this._groupColumns.includes(column);

  // ------------------------------------------------------------ aparência

  // Booleanos: `"false"` desliga (padrão `true` precisa disso — spec 15).

  /** Row height in px (rows with `wrap` columns can grow). */
  @property({ type: Number, attribute: 'row-height' }) rowHeight = 48;

  /** Tints even rows. */
  @property({ type: Boolean, converter: booleanAttribute(false) }) striped = false;

  /** Shows the group panel (drop a header there to group). Default `true`; `show-group-panel="false"` hides it. */
  @property({ type: Boolean, converter: booleanAttribute(true), attribute: 'show-group-panel' }) showGroupPanel = true;

  /** Shows the column headers. Default `true`; `show-column-headers="false"` hides them. */
  @property({ type: Boolean, converter: booleanAttribute(true), attribute: 'show-column-headers' }) showColumnHeaders = true;

  /** Horizontal row separators. Default `true`; `show-row-lines="false"` hides them. */
  @property({ type: Boolean, converter: booleanAttribute(true), attribute: 'show-row-lines' }) showRowLines = true;

  /** Vertical column separators. */
  @property({ type: Boolean, converter: booleanAttribute(false), attribute: 'show-column-lines' }) showColumnLines = false;

  /** Shows the number of rows in group rows (`"Country: Brazil (3)"`). Default `true`; `show-group-count="false"` hides it. */
  @property({ type: Boolean, converter: booleanAttribute(true), attribute: 'show-group-count' }) showGroupCount = true;

  /**
   * Context menu of the group panel (right-click, Shift+F10 or the context
   * menu key on a group chip): ungroup, ungroup all, expand/collapse all
   * groups. Default `true`; `group-panel-menu="false"` disables it.
   */
  @property({ type: Boolean, converter: booleanAttribute(true), attribute: 'group-panel-menu' }) groupPanelMenu = true;
  // ---------------------------------------------------------------- filtro

  /** Shows the filter row below the column headers (an editor and an operation menu per filterable column). */
  @property({ type: Boolean, converter: booleanAttribute(false), attribute: 'show-filter-row' }) showFilterRow = false;

  /** Shows the search box in the bar above the table (searches the displayed text of the visible filterable columns). */
  @property({ type: Boolean, converter: booleanAttribute(false), attribute: 'show-search-panel' }) showSearchPanel = false;

  /** Shows a filter button in the headers of filterable columns: a popover with the distinct values. */
  @property({ type: Boolean, converter: booleanAttribute(false), attribute: 'header-filter' }) headerFilter = false;

  /**
   * Column filter (property only): a serializable expression such as
   * `[['age', '>', 30], 'and', ['name', 'contains', 'an']]`. The filter row
   * and the header filter read and write it, so it always holds the current
   * filter. The grid keeps a frozen copy (never the host array). Setting it
   * does not fire `u-grid-filter-change`.
   */
  @property({ attribute: false })
  get filterValue(): GridFilterExpression | null {
    return this.#filtering.filterValue;
  }

  set filterValue(value: GridFilterExpression | null | undefined) {
    this.#filterRow.discardDrafts();
    this.#filtering.set(value, this.#filtering.searchText);
  }

  /** Text of the search panel (case and accent insensitive). Setting it does not fire `u-grid-filter-change`. */
  @property({ attribute: 'search-text' })
  get searchText(): string {
    return this.#filtering.searchText;
  }

  set searchText(value: string | null | undefined) {
    this.#search.discardDraft();
    this.#filtering.set(this.#filtering.filterValue, value ?? '');
  }

  /** Último gesto de filtro aguardando a contagem para anunciar. */
  #announceFilter = false;
  #searchColumnsKey = '';
  #searchMatcherText = '';
  #searchMatcher: RegExp | null = null;

  // -------------------------------------------------------- recursos de coluna

  /** Lets the user resize columns from the header edge (pointer and keyboard). */
  @property({ type: Boolean, converter: booleanAttribute(false), attribute: 'column-resizing' }) columnResizing = false;

  /**
   * `widget`: only the column changes and the total width follows.
   * `next-column`: the next column gives or takes the same amount (the
   * total width is kept).
   */
  @property({ attribute: 'resize-mode' }) resizeMode: GridResizeMode = 'widget';

  /** Shows the column chooser button in the bar above the table. */
  @property({ type: Boolean, converter: booleanAttribute(false), attribute: 'column-chooser' }) columnChooser = false;

  /** Columns without `width` take the width of their content (header and rendered rows). */
  @property({ type: Boolean, converter: booleanAttribute(false), attribute: 'column-auto-width' }) columnAutoWidth = false;

  // ------------------------------------------------------ seleção e foco

  /**
   * Row selection: `none` (default; the selection methods do nothing),
   * `single` or `multiple`. Click selects, Ctrl+click toggles, Shift+click
   * extends; Space, Shift+Space, Shift+↑/↓ and Ctrl+A on the keyboard.
   */
  @property({ attribute: 'selection-mode' }) selectionMode: GridSelectionMode = 'none';

  /**
   * Shows a checkbox column (fixed at the start) with "select all" in the
   * header. Only with `selection-mode="multiple"`; then a click on a row only
   * moves the focus and the checkbox (or Space) selects.
   */
  @property({ type: Boolean, converter: booleanAttribute(false), attribute: 'show-checkboxes' }) showCheckboxes = false;

  readonly #selection = new SelectionModel();
  /** Âncora do Shift+clique/Shift+setas: chave da última linha alternada. */
  #selectionAnchor: unknown = undefined;
  /** Contagem de selecionadas entre as linhas filtradas (estado do "selecionar tudo"). */
  readonly #selectedInView = { version: -1, items: undefined as readonly unknown[] | undefined, count: 0 };

  /**
   * Selected row keys (property only). Without `keyExpr` the key is the item
   * object itself, so replacing `items` with new objects loses the selection.
   * Keys missing from `items` are kept (and retained) until deselected. The
   * getter returns a frozen array — the same instance until the selection
   * changes. Setting it does not fire `u-grid-selection-change`.
   */
  @property({ attribute: false })
  get selectedKeys(): readonly unknown[] {
    return this.#selection.keys;
  }

  set selectedKeys(keys: readonly unknown[] | null | undefined) {
    const list = [...keys ?? []];
    this.#selection.replace(this.#selectionMode === 'single' ? list.slice(-1) : list);
  }

  get #selectionMode(): GridSelectionMode {
    return normalizeSelectionMode(this.selectionMode);
  }

  get #showSelectionColumn(): boolean {
    return this.showCheckboxes && this.#selectionMode === 'multiple';
  }

  /** Célula ativa (roving tabindex): identidade da linha (`null` = cabeçalho). */
  #activeRef: ActiveRef | null = null;
  /** Último índice conhecido da linha ativa (`HEADER_ROW` = cabeçalho). */
  #activeRowIndex = HEADER_ROW;
  /** Coluna ativa (segue a coluna quando ela muda de lugar). */
  #activeColumn: NavColumn | undefined;
  /** Último índice conhecido da coluna ativa entre as navegáveis. */
  #activeCol = 0;
  /** Célula ativa já resolvida num render (antes disso não há o que avisar). */
  #activeResolved = false;
  /** O que foi avisado por último em `u-grid-focus-change`. */
  #reportedFocus: PublicFocus | undefined;
  /** Depois do próximo render: levar o foco do DOM à célula ativa. */
  #focusPending = false;
  /** Depois do próximo render: rolar até a célula ativa. */
  #revealPending = false;
  /** Chip do painel de grupos com `tabindex="0"` (roving na barra). */
  #activeChip = 0;
  #chipFocusPending = false;
  /** Colunas navegáveis do último render (caixa de seleção + visíveis). */
  #navColumns: NavColumn[] = [];
  readonly #tableRef: Ref<HTMLTableElement> = createRef();

  /**
   * Key of the data row of the active cell (the cell keyboard navigation
   * starts from); `null` when it is a header or group row. Setting it moves
   * the active cell to that row (scrolling to it) without taking the DOM
   * focus and without firing `u-grid-focus-change`; a key not in the rows is
   * ignored and `null` moves it to the first header (ignored when
   * `show-column-headers` is `false`).
   */
  @property({ attribute: false })
  get focusedRowKey(): unknown {
    return this.#publicFocus().rowKey;
  }

  set focusedRowKey(key: unknown) {
    if (key === null || key === undefined) {
      if (this.showColumnHeaders) {
        this.#setActive({ row: HEADER_ROW, col: 0 }, null);
      }

      return;
    }

    // `items` pode ter sido trocado no mesmo tick (ou antes do 1º render).
    this.#ensureRows();

    const row = this.#rowIndexOfKey(key);

    if (row >= 0) {
      this.#setActive({ row, col: this.#activeCol }, null, { reveal: true });
    }
  }

  /** @deprecated Use `striped`. */
  @property({ type: Boolean, converter: booleanAttribute(false) })
  get stripped(): boolean {
    return this.striped;
  }

  set stripped(value: boolean) {
    this.#deprecated('stripped', 'striped');
    this.striped = value;
  }

  /** @deprecated Use `showGroupPanel` (attribute `show-group-panel`). */
  @property({ type: Boolean, converter: booleanAttribute(true), attribute: 'showheader' })
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

  override attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    const renamed = LEGACY_ATTRIBUTES[name];

    if (renamed) {
      this.#deprecated(`${name} attribute`, `${renamed} attribute`);
      // Conversor e propriedade são os do atributo novo.
      super.attributeChangedCallback(renamed, old, value);
      return;
    }

    super.attributeChangedCallback(name, old, value);
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

  /** @internal */
  readonly _containerRef: Ref<HTMLDivElement> = createRef();
  /** @internal */
  readonly _scrollContainerRef: Ref<HTMLDivElement> = createRef();
  /** @internal */
  readonly _groupContainerRef: Ref<HTMLDivElement> = createRef();

  readonly #virtualizer = new RowVirtualizer(this, {
    getScrollElement: () => this._scrollContainerRef.value ?? null,
    rowHeight: () => this.rowHeight,
    overscan: 3,
    getScrollMargin: () => {
      const scroller = this._scrollContainerRef.value;
      const table = scroller?.querySelector('table');

      return scroller && table
        ? table.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop + (table.tHead?.offsetHeight ?? 0)
        : 0;
    },
    // Barra e cabeçalho grudam no topo: a área coberta vai até o fim do `<thead>`.
    getStickyHeight: () => {
      const scroller = this._scrollContainerRef.value;
      const thead = scroller?.querySelector('thead');

      return scroller && thead ? Math.max(0, thead.getBoundingClientRect().bottom - scroller.getBoundingClientRect().top) : 0;
    },
  });

  readonly #columnDragAndDrop = new ColumnDragAndDropAdapter(this);
  readonly #groupDragAndDrop = new GroupDragAndDropAdapter(this);
  #dragAndDropDirty = true;

  readonly #resize = new ColumnResizeController(this);
  readonly #chooser = new ColumnChooserController(this);
  readonly #groupMenu = new GroupPanelMenuController(this);
  readonly #filtering = new FilteringController(this);
  readonly #filterRow = new FilterRowController(this);
  readonly #headerFilterPopover = new HeaderFilterController(this);
  readonly #search = new SearchController(this);
  #resizeObserver: ResizeObserver | undefined;

  /**
   * Quantos elementos estão registrados no interactjs (diagnóstico/testes).
   * @internal
   */
  get _dragAndDropRegistrations(): number {
    return this.#columnDragAndDrop.size + this.#groupDragAndDrop.size;
  }

  /**
   * Virtualizador de linhas (testes e adaptadores; spec 16).
   * @internal
   */
  get _virtualizer(): RowVirtualizer {
    return this.#virtualizer;
  }

  /**
   * Tamanho dos registros internos que crescem com o uso (diagnóstico e
   * testes de vazamento, spec 14). Num grid de vida longa têm de ficar
   * estáveis.
   * @internal
   */
  get _memoryStats(): Record<string, number> {
    return {
      dragAndDrop: this._dragAndDropRegistrations,
      // O virtualizador próprio não guarda elementos (spec 16).
      measuredElements: 0,
      measuredSizes: this.#virtualizer.measuredSizes,
      dataTypes: this.#dataTypes.size,
      expansion: this.#expansion.size,
      sortRanks: this.#rankCache.size,
      // Estado por coluna (larguras, visibilidade, fixação, medições): só colunas definidas.
      columnState: this.#userWidths.size + this.#userVisible.size + this.#userFixed.size
        + this.#autoWidths.size + this.#renderedWidths.size + this.#hostOptions.size,
      chooserDropzones: this.#chooser.dropzones,
      filterRowState: this.#filterRow.size,
      filterTimers: this.#filterRow.timers + this.#search.timers + (this.#filtering.pending ? 1 : 0),
      headerFilterOpen: this.#headerFilterPopover.open ? 1 : 0,
      selectedKeys: this.#selection.size,
    };
  }

  // ----------------------------------------------------------- ciclo de vida

  /**
   * Também espera a filtragem em fatias de um `items` grande.
   * @internal
   */
  protected override async getUpdateComplete(): Promise<boolean> {
    let result = await super.getUpdateComplete();

    while (this.#filtering.pending) {
      await this.#filtering.pending;
      result = await super.getUpdateComplete();
    }

    return result;
  }

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
    // `single` guarda uma chave só. Evento só na troca `multiple` → `single`
    // de um grid já renderizado; na inicialização (setters) corta calado.
    if (changed.has('selectionMode') && this.#selectionMode === 'single' && this.#selection.size > 1) {
      const change = this.#selection.replace(this.#selection.keys.slice(-1));

      if (this.hasUpdated && normalizeSelectionMode(changed.get('selectionMode')) === 'multiple') {
        this.#applySelection(change, 'api');
      }
    }

    if (changed.has('autoExpandGroups')) {
      // Opção do hospedeiro vence o estado do usuário (como nas colunas).
      if (changed.get('autoExpandGroups') !== undefined) {
        this.#resetExpansion();
      }

      this.#rowsDirty = true;
    }

    const menuColumn = this.#groupMenu.column;

    if (this.#groupMenu.open && (
      !this.groupPanelMenu
      || !this.showGroupPanel
      || !this._groupColumns.length
      || (menuColumn && !this._groupColumns.includes(menuColumn)))) {
      this.#groupMenu.hide();
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
    const virtualizer = this.#virtualizer;

    // Com `wrap` a linha pode crescer: mede as renderizadas a cada render
    // (alturas por índice; trocar as linhas ou o `rowHeight` as esquece).
    if (this.#hasWrap !== this.#measuredWrap) {
      this.#measuredWrap = this.#hasWrap;

      if (!this.#hasWrap) {
        virtualizer.measure();
      }
    }

    if (this.#hasWrap) {
      virtualizer.measureRows(this.renderRoot.querySelectorAll<HTMLElement>('tbody tr[data-index]'));
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

    // Célula ativa realocada neste render (a linha ou a coluna saiu): só
    // registra, sem evento — quem precisa lê `focusedRowKey`.
    this.#reportFocus(null);

    if (this.#focusPending || this.#revealPending) {
      this.#afterActiveRender();
    }

    if (this.#chipFocusPending) {
      this.#chipFocusPending = false;
      this.renderRoot.querySelector<HTMLElement>('.group[tabindex="0"]')?.focus();
    }

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
  sortColumn(column: GridColumnDef, order: GridSortOrder | null, options: { append?: boolean } = {}): void {
    this.#changeSorting(nextSorting(this.#sorting, column, order, options.append ?? false, this.#isGrouped), 'api');
  }

  /** @deprecated Use `sortColumn()`. */
  sortBy(column: GridColumnDef, order: GridSortOrder | null, options: { append?: boolean } = {}): void {
    this.#deprecated('sortBy()', 'sortColumn()');
    this.sortColumn(column, order, options);
  }

  /** Removes the sorting of every column (grouped columns go back to ascending groups). */
  clearSorting(): void {
    this.#changeSorting([], 'api');
  }

  /** Current sorting, in priority order (a copy). */
  getSorting(): GridSort[] {
    return this.#sorting.map(({ column, order }) => ({ column, order }));
  }

  /**
   * Groups by `column` at grouping level `targetIndex` (default: the
   * innermost level). An already grouped column moves to that level.
   */
  groupColumn(column: GridColumnDef, targetIndex?: number): void {
    this.#moveColumnTo(true, column, targetIndex ?? this._groupColumns.length, 'api');
  }

  /** Removes `column` from the grouping; it goes back to the end of the regular columns. */
  ungroupColumn(column: GridColumnDef): void {
    if (this._groupColumns.includes(column)) {
      this.#moveColumnTo(false, column, this._regularColumns.length, 'api');
    }
  }

  /** Grouped columns, outermost first (a copy). */
  getGrouping(): GridColumnDef[] {
    return [...this._groupColumns];
  }

  /**
   * Expands every group of grouping level `groupIndex` (0-based), or of
   * every level without it. Also applies to groups that appear later
   * (new data, filter), until the next `expandAllGroups`/`collapseAllGroups`
   * call or a change of `autoExpandGroups` (which fires no event).
   */
  expandAllGroups(groupIndex?: number): void {
    this.#setAllExpanded(true, groupIndex, 'api');
  }

  /** Collapses every group of level `groupIndex`, or of every level without it. See `expandAllGroups`. */
  collapseAllGroups(groupIndex?: number): void {
    this.#setAllExpanded(false, groupIndex, 'api');
  }

  /**
   * Expands one group (not its parents). `groupPath` = the group values from
   * the outermost level, e.g. `['Brazil', 'SP']`, compared as when grouping.
   * Needs the grouping set (at least `groupPath.length` grouped columns),
   * otherwise it is ignored; a group that has no rows yet keeps the state
   * (and the event fires) for when it appears.
   */
  expandGroup(groupPath: GridGroupPath): void {
    this.#setPathExpanded(groupPath, true);
  }

  /** Collapses one group (`groupPath` as in `expandGroup`). */
  collapseGroup(groupPath: GridGroupPath): void {
    this.#setPathExpanded(groupPath, false);
  }

  /** Whether the group of `groupPath` is (or would be) expanded. */
  isGroupExpanded(groupPath: GridGroupPath): boolean {
    const key = Array.isArray(groupPath) ? groupKeyOf(groupPath, this._groupColumns) : undefined;

    return key !== undefined && this.#isExpanded(key, groupPath.length - 1);
  }

  /**
   * Computed summaries: the totals (`summary.total`) or, with `groupPath`,
   * the summaries of that group (`summary.group`; empty if the group does
   * not exist).
   */
  getSummaryValues(groupPath?: GridGroupPath): GridSummaryValue[] {
    this.#ensureRows();

    if (groupPath === undefined) {
      return this.#totalSpecs.map((summary, index) => this.#summaryValue(summary, this.#totals[index]));
    }

    const node = this.#findGroup(groupPath);

    return node
      ? this.#groupSpecs.map((summary, index) => this.#summaryValue(summary, node.summaries[index]))
      : [];
  }

  #summaryValue({ item, spec }: ResolvedSummary, value: unknown): GridSummaryValue {
    return { item, value: value ?? null, text: formatSummaryValue(value, spec, item.format, this.#summaryFormatContext) };
  }

  #findGroup(groupPath: GridGroupPath): GroupNode | undefined {
    if (!Array.isArray(groupPath)) {
      return undefined;
    }

    let nodes: readonly GroupNode[] = this.#groups;
    let node: GroupNode | undefined;

    for (let level = 0; level < groupPath.length; level++) {
      const key = groupKeyOf(groupPath.slice(0, level + 1), this._groupColumns);
      node = key === undefined ? undefined : nodes.find(candidate => candidate.key === key);

      if (!node) {
        return undefined;
      }

      nodes = node.children;
    }

    return node;
  }

  #setPathExpanded(groupPath: GridGroupPath, expanded: boolean): void {
    const key = Array.isArray(groupPath) ? groupKeyOf(groupPath, this._groupColumns) : undefined;

    if (key !== undefined) {
      this.#setGroupExpanded(key, groupPath.length - 1, Object.freeze([...groupPath]), expanded, 'api');
    }
  }

  /** Único ponto que muda a expansão de UM grupo; evento só se mudou. */
  #setGroupExpanded(key: string, level: number, groupPath: GridGroupPath, expanded: boolean, source: GridChangeSource): void {
    if (this.#isExpanded(key, level) === expanded) {
      return;
    }

    if (expanded === this.#defaultExpanded(level)) {
      this.#expansion.delete(key);
    } else {
      this.#expansion.set(key, { expanded, level });
    }

    this.#rowsDirty = true;
    this.requestUpdate();
    this.#dispatchExpansion({ groupPath, groupIndex: level, expanded, source });
  }

  /** Expandir/recolher tudo (um nível ou todos); evento só se algum grupo existente mudou. */
  #setAllExpanded(expanded: boolean, groupIndex: number | undefined, source: GridChangeSource): void {
    if (groupIndex !== undefined && (!Number.isInteger(groupIndex) || groupIndex < 0)) {
      return;
    }

    this.#ensureRows();

    let changed = false;

    const visit = (nodes: readonly GroupNode[]): void => {
      for (const node of nodes) {
        if (changed) {
          return;
        }

        if ((groupIndex === undefined || node.level === groupIndex) && this.#isExpanded(node.key, node.level) !== expanded) {
          changed = true;
          return;
        }

        if (groupIndex === undefined || node.level < groupIndex) {
          visit(node.children);
        }
      }
    };

    visit(this.#groups);

    if (groupIndex === undefined) {
      this.#expansion.clear();
      this.#levelExpansion = [];
      this.#allExpansion = expanded;
    } else {
      for (const [key, entry] of this.#expansion) {
        if (entry.level === groupIndex) {
          this.#expansion.delete(key);
        }
      }

      this.#levelExpansion[groupIndex] = expanded;
    }

    this.#rowsDirty = true;
    this.requestUpdate();

    if (changed) {
      this.#dispatchExpansion({ groupPath: null, groupIndex: groupIndex ?? null, expanded, source });
    }
  }

  #dispatchExpansion(detail: GridGroupExpansionChangeEventDetail): void {
    this.dispatchEvent(new CustomEvent('u-grid-group-expansion-change', this.#eventInit(detail)));
  }

  /** Desagrupa todas as colunas de uma vez (um só `u-grid-group-change`). */
  #ungroupAll(source: GridChangeSource): void {
    const previous = this.getGrouping();

    if (!previous.length) {
      return;
    }

    this.#setColumnState([...this._regularColumns, ...previous], []);
    this.dispatchEvent(new CustomEvent('u-grid-group-change', this.#eventInit<GridGroupEventDetail>({
      grouping: [],
      previous,
      source,
    })));
  }

  /**
   * Moves a column to `targetIndex` among the regular (non-grouped) columns.
   * The column stays in its block: fixed at the start, free, or fixed at the
   * end. A grouped column is ungrouped.
   */
  moveColumn(column: GridColumnDef, targetIndex: number): void {
    this.#moveColumnTo(false, column, targetIndex, 'api');
  }

  /**
   * Chamado pelos adaptadores de arrasto quando um arrasto começa.
   * @internal
   */
  _dragStarted(): void {
    this.#dragged = true;
  }

  /** Sets the width (px) of a column, within its `minWidth`/`maxWidth`. */
  setColumnWidth(column: GridColumnDef, width: number): void {
    if (!this._regularColumns.includes(column) || !Number.isFinite(width)) {
      return;
    }

    const { min, max } = this._boundsOf(column);
    this._setUserWidths(new Map([[column, clampWidth(width, min, max)]]));
  }

  /** Fits the width of a column to its header and rendered cells. */
  autoSizeColumn(column: GridColumnDef): void {
    const width = this.#measureColumnContent(column);

    if (width !== undefined) {
      this.setColumnWidth(column, width);
    }
  }

  /** Removes every filter: `filterValue` and `searchText`. Fires `u-grid-filter-change` (`source: 'api'`) when something changed. */
  clearFilter(): void {
    this.#filterRow.discardDrafts();
    this.#search.discardDraft();
    this.#changeFilter(null, '', 'api');
  }

  /**
   * The effective filter: `filterValue` `and` the search, as an expression
   * (copy). The search becomes `[path, 'contains', text]` joined by `or`
   * over the visible filterable columns (number and date columns included:
   * `contains` matches their displayed text). `null` without filter.
   */
  getCombinedFilter(): GridFilterExpression | null {
    return this.#filtering.combined();
  }

  /** Opens the column chooser (also without the `column-chooser` button). */
  openColumnChooser(): void {
    this.#chooser.show();
  }

  /** Closes the column chooser. */
  closeColumnChooser(): void {
    this.#chooser.hide();
  }

  /** @deprecated Use `openColumnChooser()`. */
  showColumnChooser(): void {
    this.#deprecated('showColumnChooser()', 'openColumnChooser()');
    this.openColumnChooser();
  }

  /**
   * Selects the rows of `keys`. Without `append` they replace the selection;
   * with it they are added. In `single` mode only the last key is kept; in
   * `none` it does nothing.
   */
  selectRows(keys: readonly unknown[], options: { append?: boolean } = {}): void {
    this.#select(keys, options.append ?? false, 'api');
  }

  /** Removes the rows of `keys` from the selection (nothing in `none` mode). */
  deselectRows(keys: readonly unknown[]): void {
    if (this.#selectionMode !== 'none') {
      this.#applySelection(this.#selection.remove(keys), 'api');
    }
  }

  /** Selects every row that passes the filter, including rows of collapsed groups (`multiple` mode only). */
  selectAll(): void {
    this.#selectAll(true, 'api');
  }

  /** Deselects every row that passes the filter (`multiple` mode only); other keys stay selected. */
  deselectAll(): void {
    this.#selectAll(false, 'api');
  }

  /** Removes every key from the selection (also keys not in `items`). */
  clearSelection(): void {
    if (this.#selectionMode !== 'none') {
      this.#applySelection(this.#selection.replace([]), 'api');
    }
  }

  /** Whether the row of `key` is selected. */
  isRowSelected(key: unknown): boolean {
    return this.#selection.has(key);
  }

  /** Items of the selected keys that are in `items`, in selection order. */
  getSelectedItems(): any[] {
    if (!this.#selection.size) {
      return [];
    }

    const present = new Set(this.#items);
    return this.#selection.keys.filter(key => present.has(key));
  }

  /**
   * Scrolls to the cell of the row `rowKey` and `column` (default: the first
   * visible column) and moves the DOM focus to it. Returns `false` when the
   * row is not in the grid (filtered out or in a collapsed group — groups are
   * not expanded) or `column` is not a visible, ungrouped column. Before the
   * first render it only sets the active cell (the focus moves when it is
   * rendered) and fires no event.
   */
  focusCell(rowKey: unknown, column?: GridColumnDef): boolean {
    this.#ensureRows();

    const row = this.#rowIndexOfKey(rowKey);

    if (row < 0) {
      return false;
    }

    const navColumns = this.#currentNavColumns();
    const col = column ? navColumns.indexOf(column) : navColumns.indexOf(this._visibleColumns[0]);

    if (column && col < 0) {
      return false;
    }

    this.#setActive({ row, col: Math.max(col, 0) }, 'api', { focus: true, reveal: true });
    return true;
  }

  /** Moves the focus to the active cell of the grid (the one keyboard navigation starts from). */
  override focus(options?: FocusOptions): void {
    const cell = this.#activeCellElement();

    if (cell) {
      cell.focus(options);
    } else {
      super.focus(options);
    }
  }

  /**
   * Chamado por `<u-grid-column>` quando uma propriedade muda: `value` =
   * muda o valor das células (`path`, `valueGetter`, `dataType`); `display`
   * = só a exibição (formato, largura, fixação, visibilidade…).
   * @internal
   */
  _columnChanged(column: GridColumnDef, change: GridColumnChange): void {

    const grouped = this._groupColumns.includes(column);

    if (!grouped && !this._regularColumns.includes(column)) {
      return;
    }

    if (change === 'groupIndex') {
      // `groupIndex` é inicial (spec 15); a reação a mudanças fica por
      // compatibilidade, com aviso.
      this.#deprecated('changing groupIndex after the column is rendered', 'groupColumn()/ungroupColumn()');

      // Troca de definição: sem `u-grid-group-change` (como as demais opções).
      const groupIndex = column.groupIndex;

      if (groupIndex === null || groupIndex === undefined) {
        if (grouped) {
          this.#moveColumnTo(false, column, this._regularColumns.length, null);
        }
      } else {
        this.#moveColumnTo(true, column, groupIndex, null);
      }
    }

    if (change === 'value') {
      this.#summaryDirty = true;
      // Mesmo resumo, valores novos: recalcula.
      this.#totalsDirty = true;
      this.#groupsDirty ||= this.#groupSpecs.length > 0;
      this.#dataTypes.delete(column);
      this.#allConvert.delete(column);
      this.#rankCache.delete(column);
      this.#filtering.invalidate();
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
    this.#filtering.invalidate();
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
    this.#filterRow.prune(defined);
    this.#headerFilterPopover.closeIfRemoved(defined);
    this.#setColumnState(regular, group);
  }

  /** `source` nulo: mudança vinda da definição da coluna, sem evento. */
  #moveColumnTo(toGroup: boolean, column: GridColumnDef, targetIndex: number, source: GridChangeSource | null): void {
    const previous = this.getGrouping();
    const regular = [...this._regularColumns];
    const group = [...this._groupColumns];
    const from = regular.includes(column) ? regular : group.includes(column) ? group : null;

    if (!from) {
      return;
    }

    const target = toGroup ? group : regular;
    const targetColumn = target[targetIndex];

    if (targetColumn === column) {
      return;
    }

    from.splice(from.indexOf(column), 1);

    const insertAt = targetColumn ? target.indexOf(targetColumn) : target.length;
    target.splice(insertAt, 0, column);

    this.#setColumnState(regular, group);

    if (source && !sameItems(previous, this._groupColumns)) {
      this.dispatchEvent(new CustomEvent('u-grid-group-change', this.#eventInit<GridGroupEventDetail>({
        grouping: this.getGrouping(),
        previous,
        source,
      })));
    }
  }

  #setColumnState(regular: GridColumnDef[], group: GridColumnDef[]): void {
    this.#dataTypes.clear();
    this.#summaryDirty = true;
    this.#allConvert.clear();

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

  /** @internal */
  _isColumnVisible(column: GridColumnDef): boolean {
    return this.#userVisible.get(column) ?? column.visible !== false;
  }

  /** @internal */
  _fixedOf(column: GridColumnDef): GridColumnFixed {
    return this.#userFixed.has(column)
      ? this.#userFixed.get(column)!
      : normalizeFixed(column.fixed);
  }

  /** @internal */
  _isRegularColumn(column: GridColumnDef): boolean {
    return this._regularColumns.includes(column);
  }

  /**
   * Reordenar só vale dentro do mesmo bloco (fixas no início, livres, fixas no fim).
   * @internal
   */
  _sameBlock(a: GridColumnDef, b: GridColumnDef): boolean {
    return this._fixedOf(a) === this._fixedOf(b);
  }

  #hasFixedColumns(): boolean {
    return this._visibleColumns.some(column => this._fixedOf(column) !== null);
  }

  /**
   * Reordenação feita pelo usuário (arrasto): move e avisa.
   * @internal
   */
  _userMoveColumn(column: GridColumnDef, targetIndex: number): void {
    const previousIndex = this._regularColumns.indexOf(column);

    this.#moveColumnTo(false, column, targetIndex, 'user');

    const index = this._regularColumns.indexOf(column);

    if (previousIndex >= 0 && index !== previousIndex) {
      this.dispatchEvent(new CustomEvent('u-grid-column-reorder', this.#eventInit<GridColumnReorderEventDetail>({
        column,
        index,
        previousIndex,
        fromIndex: previousIndex,
        toIndex: index,
      })));
    }
  }

  /**
   * Agrupamento feito pelo usuário (arrasto para o painel de grupos).
   * @internal
   */
  _userGroupColumn(column: GridColumnDef, targetIndex: number): void {
    // `groupable: false` só barra o usuário (reordenar o que já está agrupado continua).
    if (!this._groupColumns.includes(column) && !isColumnGroupable(column)) {
      return;
    }

    this.#moveColumnTo(true, column, targetIndex, 'user');
  }

  /**
   * Mostra/oculta pelo seletor. Recusa ocultar a última coluna visível.
   * @internal
   */
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

  /**
   * Fixa/solta pelo seletor e avisa.
   * @internal
   */
  _userSetFixed(column: GridColumnDef, fixed: GridColumnFixed): void {
    const previousFixed = this._fixedOf(column);

    if (!this._isRegularColumn(column) || previousFixed === fixed) {
      return;
    }

    this.#userFixed.set(column, fixed);
    this.#layoutDirty = true;
    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('u-grid-column-fixed-change', this.#eventInit<GridColumnFixedChangeEventDetail>({ column, fixed, previousFixed })));
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

  /** @internal */
  _boundsOf(column: GridColumnDef): WidthBounds {
    const min = Math.max(0, column.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH);
    const max = column.maxWidth ?? Infinity;
    const width = this.#widthOf(column) ?? this.#renderedWidths.get(column) ?? min;

    return { width: Math.round(width), min, max };
  }

  /** @internal */
  _resizeNeighbor(column: GridColumnDef): GridColumnDef | undefined {
    const next = this._visibleColumns[this._visibleColumns.indexOf(column) + 1];
    return next && this.#isResizable(next) ? next : undefined;
  }

  #isResizable(column: GridColumnDef): boolean {
    return this.columnResizing && column.resizable !== false;
  }

  /** @internal */
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

  /** @internal */
  _setUserWidths(widths: ReadonlyMap<GridColumnDef, number>): void {
    for (const [column, width] of widths) {
      this.#userWidths.set(column, width);
    }

    this.#layoutDirty = true;
    this.requestUpdate();
  }

  /** @internal */
  _isRtl(): boolean {
    return isRtl(this);
  }

  /** @internal */
  _setResizing(active: boolean): void {
    this._containerRef.value?.classList.toggle('resizing', active);
  }

  /** @internal */
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

    const colIndex = index + 1 + (this.#showSelectionColumn ? 1 : 0);
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
      cells = row ? [...row.querySelectorAll<HTMLElement>('td[role=gridcell]:not(.selection-cell)')] : [];
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
    let start = this.#stickyStart();

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

  /** Largura presa no início antes das colunas fixas: recuos de grupo e caixas de seleção. */
  #stickyStart(): number {
    return this._groupColumns.length * GROUP_COLUMN_WIDTH + (this.#showSelectionColumn ? SELECTION_COLUMN_WIDTH : 0);
  }

  // -------------------------------------------------------------- row model

  /** Padrão de um nível: `*AllGroups(nível)` → `*AllGroups()` → `autoExpandGroups`. */
  #defaultExpanded(level: number): boolean {
    return this.#levelExpansion[level] ?? this.#allExpansion ?? this.autoExpandGroups;
  }

  readonly #isExpanded = (key: string, level: number): boolean =>
    this.#expansion.get(key)?.expanded ?? this.#defaultExpanded(level);

  #resetExpansion(): void {
    this.#expansion.clear();
    this.#levelExpansion = [];
    this.#allExpansion = undefined;
    this.#rowsDirty = true;
  }

  /** Resolve a coluna de um resumo: `path` (1ª coluna com ele) ou a própria coluna, se definida. */
  #resolveColumn(columnRef: GridColumnRef | undefined): GridColumnDef | undefined {
    const columns = this.columns;

    if (typeof columnRef === 'string') {
      return columns.find(column => column.path === columnRef);
    }

    return columnRef && columns.includes(columnRef) ? columnRef : undefined;
  }

  #resolveSummaries<T extends GridSummaryItem>(items: readonly T[] | undefined, language: string | undefined): ResolvedSummary<T>[] {
    return (items ?? []).filter(item => !!item).map(item => {
      const column = this.#resolveColumn(item.column);
      const dataType = column ? this.#dataTypeOf(column) : undefined;

      return {
        item,
        spec: {
          column,
          type: item.type,
          dataType,
          compare: item.type === 'min' || item.type === 'max' ? createComparer(language, dataType) : undefined,
        },
      };
    });
  }

  get #hasGroupFooters(): boolean {
    return this.#groupSpecs.some(({ item }) => item.display === 'footer');
  }

  /**
   * items → filtrar → ordenar → agrupar → achatar; cada etapa só refaz o que
   * sujou. A ordenação é calculada sobre todos os `items` (índices, com os
   * postos em cache) e o filtro é uma máscara alinhada a `items`: mudar o
   * filtro não reordena, e o resultado é o mesmo de filtrar antes (a
   * ordenação é estável).
   */
  #ensureRows(): void {
    const language = this.#effectiveLanguage;
    const languageChanged = language !== this.#modelLanguage;
    this.#modelLanguage = language;

    if (languageChanged) {
      this.#rankCache.clear();
      this.#filtering.invalidate();
    }

    if (this.#summaryDirty || (languageChanged && (this.#totalSpecs.length || this.#groupSpecs.length))) {
      const hadFooters = this.#hasGroupFooters;
      const totalSpecs = this.#resolveSummaries(this.#summary?.total, language);
      const groupSpecs = this.#resolveSummaries(this.#summary?.group, language);

      // Agrupar/reordenar colunas suja a resolução, mas raramente muda os
      // resumos: só recalcula (1 mi de linhas) o que mudou de fato.
      if (languageChanged || !sameSummaries(totalSpecs, this.#totalSpecs)) {
        this.#totalSpecs = totalSpecs;
        this.#totalsDirty = true;
      }

      if (languageChanged || !sameSummaries(groupSpecs, this.#groupSpecs)) {
        this.#groupSpecs = groupSpecs;
        this.#groupsDirty = true;
      }

      this.#summaryDirty = false;
      this.#rowsDirty ||= hadFooters !== this.#hasGroupFooters;
    }

    if (this.#sortDirty || (languageChanged && this.#sorting.length)) {
      this.#sortOrder = undefined;
      this.#sortDirty = false;
      this.#viewDirty = true;
    }

    const searchColumnsKey = String(this._searchColumns().map(columnIdOf));

    if (searchColumnsKey !== this.#searchColumnsKey) {
      this.#searchColumnsKey = searchColumnsKey;
      this.#filtering.searchColumnsChanged();
    }

    const mask = this.#filtering.maskFor(this.#items);

    if (mask !== this.#appliedMask) {
      this.#appliedMask = mask;
      this.#viewDirty = true;
      // Totais e resumos de grupo valem sobre as linhas FILTRADAS.
      this.#totalsDirty = true;
    }

    if (this.#viewDirty) {
      if (this.#sortOrder === undefined) {
        const rowSorting = this.#sorting.filter(spec => !this.#isGrouped(spec.column));
        this.#sortOrder = sortOrder(this.#items, rowSorting, language, this.#rankCache);
      }

      this.#sortedItems = applyMask(this.#items, this.#sortOrder, mask);

      if (!mask && this.#sortOrder) {
        this.#sortOrder = undefined;
      }

      this.#viewDirty = false;
      this.#groupsDirty = true;
    }

    if (this.#totalsDirty) {
      // Sobre as linhas que o grid mostra (a ordem não muda o resultado).
      this.#totals = summarize(this.#sortedItems, this.#totalSpecs.map(({ spec }) => spec));
      this.#totalsDirty = false;
    }

    if (this.#announceFilter && !this.#filtering.pending) {
      this.#announceFilter = false;
      this.#announcement = formatMessage(this.#translation.filteredAnnouncement, { count: String(this.#sortedItems.length) });
    }

    if (this.#groupsDirty || (languageChanged && this._groupColumns.length)) {
      const orders = this._groupColumns.map(column => this.#orderOf(column));
      this.#groups = buildGroups(
        this.#sortedItems,
        this._groupColumns,
        // A faixa (`groupValueGetter`) compara pelo próprio valor, sem o `dataType` da coluna.
        column => createComparer(language, column.groupValueGetter ? undefined : column.dataType),
        orders,
        this.#groupSpecs.map(({ spec }) => spec),
      );
      this.#groupsDirty = false;
      this.#rowsDirty = true;
    }

    if (this.#rowsDirty) {
      this.#rows = flattenRows(this.#sortedItems, this.#groups, this.#isExpanded, rowKeyOf, this.#hasGroupFooters);
      this.#rowsDirty = false;
      // Alturas medidas (`wrap`) são por índice: outras linhas, outras alturas.
      this.#virtualizer.measure();
    }
  }

  // ----------------------------------------------------------------- filtro

  /**
   * Único ponto que muda o filtro por gesto ou método: dispara
   * `u-grid-filter-change` depois (atribuir as propriedades não dispara).
   */
  #changeFilter(filterValue: GridFilterExpression | null, searchText: string, source: GridChangeSource): boolean {
    const previousFilterValue = this.#filtering.filterValue;
    const previousSearchText = this.#filtering.searchText;

    if (!this.#filtering.set(filterValue, searchText)) {
      return false;
    }

    if (source === 'user') {
      this.#announceFilter = true;
    }

    this.dispatchEvent(new CustomEvent('u-grid-filter-change', this.#eventInit<GridFilterEventDetail>({
      filterValue: this.#filtering.filterValue,
      previousFilterValue,
      searchText: this.#filtering.searchText,
      previousSearchText,
      source,
    })));

    return true;
  }

  /**
   * Contexto do avaliador: colunas conhecidas, tipo efetivo e texto exibido.
   * Colunas sintéticas (`path` sem coluna) não entram no cache de tipos.
   * @internal
   */
  _filterContext(): FilterContext {
    const columns = [...this._regularColumns, ...this._groupColumns];
    const known = new Set(columns);
    const contexts = new Map<GridColumnDef, FormatContext>();
    const { trueText, falseText } = this.#translation;
    const language = this.language;
    const dataTypeOf = (column: GridColumnDef) => known.has(column)
      ? this.#dataTypeOf(column)
      : resolveDataType(this.#items, column);

    const contextOf = (column: GridColumnDef): FormatContext => {
      let context = contexts.get(column);

      if (!context) {
        context = { language, dataType: dataTypeOf(column), trueText, falseText };
        contexts.set(column, context);
      }

      return context;
    };

    return {
      language,
      columns,
      dataTypeOf,
      textOf: (item, column) => formatCell(item, column, contextOf(column)),
      alphabetOf: column => displayAlphabet(column, contextOf(column), foldText),
      allConvert: column => {
        let all = this.#allConvert.get(column);

        if (all === undefined) {
          all = allValuesConvert(this.#items, column, dataTypeOf(column));

          if (known.has(column)) {
            this.#allConvert.set(column, all);
          }
        }

        return all;
      },
    };
  }

  /**
   * Colunas em que a busca procura: as visíveis (e agrupadas) filtráveis.
   * @internal
   */
  _searchColumns(): GridColumnDef[] {
    return [...this._groupColumns, ...this._visibleColumns].filter(isColumnFilterable);
  }

  /** @internal */
  _columnDataType(column: GridColumnDef): GridColumnDataType | undefined {
    return this.#dataTypeOf(column);
  }

  /** @internal */
  _isFilterable(column: GridColumnDef): boolean {
    return isColumnFilterable(column);
  }

  /**
   * Gesto na linha de filtro ou no filtro do cabeçalho: troca (ou tira, com
   * `null`) a condição da coluna, sem mexer no resto da expressão.
   * @internal
   */
  _userFilterColumn(column: GridColumnDef, kind: ColumnFilterKind | 'all', condition: GridFilterCondition | null): void {
    this.#changeFilter(replaceColumnCondition(this.#filtering.filterValue, column, kind, condition), this.#filtering.searchText, 'user');
  }

  /** @internal */
  _userSearch(text: string): void {
    this.#changeFilter(this.#filtering.filterValue, text, 'user');
  }

  /**
   * Valores distintos da coluna para o filtro do cabeçalho, sobre as linhas
   * que passam pelos OUTROS filtros (a própria condição do cabeçalho fica de
   * fora, para dar para marcar de volta o que foi desmarcado).
   * @internal
   */
  _distinctValues(column: GridColumnDef): DistinctValues {
    const others = combineFilters(
      replaceColumnCondition(this.#filtering.filterValue, column, 'header', null),
      searchExpression(this.#filtering.searchText, this._searchColumns()),
    );
    let items: readonly unknown[] = this.#items;

    try {
      items = filterItems(items, compileFilter(others, this._filterContext()));
    } catch {
      // Expressão inválida (já avisada): valores de todas as linhas.
    }

    return distinctValues(items, column, {
      language: this.language,
      dataType: this.#dataTypeOf(column),
      textOf: (item, target) => formatCell(item, target, this.#formatContext(target)),
    });
  }

  /** Busca ativa: `RegExp` do destaque (recriada só quando o texto muda). */
  #highlightMatcher(): RegExp | null {
    const text = this.#filtering.searchText;

    if (text !== this.#searchMatcherText) {
      this.#searchMatcherText = text;
      this.#searchMatcher = text.trim() ? createTextMatcher(text) : null;
    }

    return this.#searchMatcher;
  }

  // -------------------------------------------------------------- ordenação

  #orderOf(column: GridColumnDef): GridSortOrder | undefined {
    return this.#sorting.find(spec => spec.column === column)?.order;
  }

  /**
   * Único ponto que muda a ordenação: dispara `u-grid-sorting` (cancelável)
   * ANTES e `u-grid-sort-change` depois. Devolve `false` se não mudou.
   */
  #changeSorting(next: GridSort[], source: GridChangeSource): boolean {
    if (sameSorting(next, this.#sorting)) {
      return false;
    }

    const previous = this.getSorting();
    const copy = () => next.map(({ column, order }) => ({ column, order }));
    const sorting = new CustomEvent<GridSortEventDetail>('u-grid-sorting', {
      detail: { sorting: copy(), previous, source },
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
      detail: { sorting: this.getSorting(), previous, source },
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
      : formatMessage(translation.sortClearedAnnouncement, params);
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

    if (this.#changeSorting(next, 'user')) {
      this.#announceSorting(column);
    }
  };

  /** Clique/Enter/Espaço no chip de uma coluna agrupada: alterna a direção dos grupos. */
  readonly #onGroupChipActivate = (column: GridColumnDef, event: MouseEvent | KeyboardEvent): void => {
    if (this.#consumeDrag(event) || !this.#canSortByUser(column)) {
      return;
    }

    const next = nextSorting(this.#sorting, column, toggleOrder(this.#orderOf(column) ?? 'asc'), true, this.#isGrouped);

    if (this.#changeSorting(next, 'user')) {
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
    const { column } = row;

    // Faixa (`groupValueGetter`): o valor devolvido, sem `format`/`displayValue` da coluna.
    if (column.groupValueGetter) {
      const value = row.value;

      if (value === null || value === undefined) {
        return column.emptyText ?? '';
      }

      // Número sem separador de milhar (como nas células: 1990 não vira "1,990").
      if (typeof value === 'number') {
        return getNumberFormat(this.language).format(value);
      }

      return value instanceof Date
        ? getDateTimeFormat(this.language, DEFAULT_DATE).format(value)
        : String(value);
    }

    return formatCellValue(row.value, row.firstItem, column, this.#formatContext(column));
  }

  // ---------------------------------------------------------------- resumos

  get #summaryFormatContext(): SummaryFormatContext {
    const { trueText, falseText } = this.#translation;

    return { language: this.language, trueText, falseText };
  }

  #summaryTypeName(item: GridSummaryItem): string | undefined {
    if (item.label) {
      return item.label;
    }

    const translation = this.#translation;

    switch (item.type) {
      case 'sum':
        return translation.summarySum;
      case 'min':
        return translation.summaryMin;
      case 'max':
        return translation.summaryMax;
      case 'avg':
        return translation.summaryAvg;
      case 'count':
        return translation.summaryCount;
      default:
        return undefined;
    }
  }

  /** Texto da célula (`"Sum: 1,234"`) e rótulo completo (`"Sum of Population: 1,234"`). */
  #summaryText({ item, spec }: ResolvedSummary, value: unknown): SummaryText {
    const translation = this.#translation;
    const valueText = formatSummaryValue(value, spec, item.format, this.#summaryFormatContext);
    const type = this.#summaryTypeName(item);
    const column = spec.column?.label ?? '';
    const text = type ? formatMessage(translation.summaryText, { type, value: valueText }) : valueText;

    if (!column) {
      return { text, label: text };
    }

    return {
      text,
      label: type
        ? formatMessage(translation.summaryColumnText, { type, column, value: valueText })
        : `${column}${translation.groupLabelSeparator}${valueText}`,
    };
  }

  /** Resumos agrupados pela coluna onde aparecem. */
  #textsByColumn(summaries: readonly ResolvedSummary[], values: readonly unknown[], include: (summary: ResolvedSummary, index: number) => boolean): Map<GridColumnDef, SummaryText[]> {
    const texts = new Map<GridColumnDef, SummaryText[]>();

    summaries.forEach((summary, index) => {
      const { column } = summary.spec;

      if (!column || !include(summary, index)) {
        return;
      }

      let list = texts.get(column);

      if (!list) {
        list = [];
        texts.set(column, list);
      }

      list.push(this.#summaryText(summary, values[index]));
    });

    return texts;
  }

  /** Separador de lista do idioma (sem "e"/"and"), calculado uma vez por idioma. */
  get #listSeparatorText(): string {
    const language = this.language;

    if (this.#listSeparator?.language !== language) {
      this.#listSeparator = { language, separator: listSeparatorOf(language) };
    }

    return this.#listSeparator.separator;
  }

  #formatList(parts: string[]): string {
    return parts.join(this.#listSeparatorText);
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
    this.#setGroupExpanded(row.groupKey, row.level, row.path, !row.expanded, 'user');
  };

  // ------------------------------------------------- seleção e foco (interno)

  #select(keys: readonly unknown[], append: boolean, source: GridChangeSource): void {
    const mode = this.#selectionMode;

    if (mode === 'none') {
      return;
    }

    const list = [...keys];

    this.#applySelection(
      mode === 'single'
        ? this.#selection.replace(list.slice(-1))
        : append ? this.#selection.add(list) : this.#selection.replace(list),
      source,
    );
  }

  /** Marca/desmarca todas as linhas que passam no filtro (as de grupos recolhidos também). */
  #selectAll(select: boolean, source: GridChangeSource): boolean {
    if (this.#selectionMode !== 'multiple') {
      return false;
    }

    this.#ensureRows();

    const keys = this.#sortedItems;
    return this.#applySelection(select ? this.#selection.add(keys) : this.#selection.remove(keys), source);
  }

  #applySelection(change: SelectionChange | undefined, source: GridChangeSource): boolean {
    if (!change) {
      return false;
    }

    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('u-grid-selection-change', this.#eventInit<GridSelectionChangeEventDetail>({
      ...change,
      source,
    })));

    return true;
  }

  /** Clique na caixa ou Espaço: alterna a linha (em `single`, substitui). */
  #toggleRow(row: DataRow): void {
    const key = row.item;
    const selected = this.#selection.has(key);

    this.#selectionAnchor = key;

    if (this.#selectionMode === 'single') {
      this.#applySelection(selected ? this.#selection.remove([key]) : this.#selection.replace([key]), 'user');
    } else {
      this.#applySelection(selected ? this.#selection.remove([key]) : this.#selection.add([key]), 'user');
    }
  }

  /** Shift+clique/Shift+setas: da âncora até `rowIndex` (só linhas de dados). */
  #extendSelection(rowIndex: number, append: boolean): void {
    const target = this.#rowAt(rowIndex);

    if (!isDataRow(target)) {
      return;
    }

    if (this.#selectionMode !== 'multiple') {
      this.#toggleRow(target);
      return;
    }

    let anchor = this.#rowIndexOfKey(this.#selectionAnchor);

    if (anchor < 0) {
      anchor = rowIndex;
      this.#selectionAnchor = target.item;
    }

    const keys = rangeBetween(anchor, rowIndex)
      .map(index => this.#rows.at(index))
      .filter(isDataRow)
      .map(row => row.item);

    const changed = this.#applySelection(append ? this.#selection.add(keys) : this.#selection.replace(keys), 'user');

    if (changed && keys.length > 1) {
      this.#announceSelectionCount();
    }
  }

  /** Caixa "selecionar tudo": desmarca se todas as filtradas estão marcadas; senão marca todas. */
  #toggleAll(): void {
    const all = this.#sortedItems.length > 0 && this.#selectedInViewCount() === this.#sortedItems.length;

    if (this.#selectAll(!all, 'user')) {
      this.#announceSelectionCount();
    }
  }

  #announceSelectionCount(): void {
    this.#announce(formatMessage(this.#translation.rowsSelectedAnnouncement, { count: String(this.#selection.size) }));
  }

  #announce(text: string): void {
    this.#announcement = text;
    this.requestUpdate();
  }

  /** Quantas das linhas filtradas estão selecionadas (recalcula só quando a seleção ou os itens mudam). */
  #selectedInViewCount(): number {
    const cache = this.#selectedInView;

    if (cache.version !== this.#selection.version || cache.items !== this.#sortedItems) {
      cache.version = this.#selection.version;
      cache.items = this.#sortedItems;
      cache.count = countSelected(this.#selection, this.#sortedItems);
    }

    return cache.count;
  }

  readonly #onBodyClick = (event: MouseEvent): void => {
    if (this.#selectionMode === 'none') {
      return;
    }

    const path = event.composedPath();
    const tr = path.find((node): node is HTMLTableRowElement => node instanceof HTMLTableRowElement);
    const index = Number(tr?.getAttribute('data-index') ?? NaN);
    const row = this.#rowAt(index);

    if (!isDataRow(row)) {
      return;
    }

    const onCheckbox = path.some(node => node instanceof HTMLElement && node.classList.contains('selection-cell'));
    const ctrl = event.ctrlKey || event.metaKey;

    if (onCheckbox) {
      if (event.shiftKey) {
        this.#extendSelection(index, true);
      } else {
        this.#toggleRow(row);
      }

      return;
    }

    // Com caixas, o clique na linha só move o foco (como o DevExtreme no modo `always`).
    if (this.#showSelectionColumn) {
      return;
    }

    if (event.shiftKey && this.#selectionMode === 'multiple') {
      this.#extendSelection(index, ctrl);
    } else if (ctrl) {
      this.#toggleRow(row);
    } else {
      this.#selectionAnchor = row.item;
      this.#select([row.item], false, 'user');
    }
  };

  /** Índice da linha de dados da chave (sem `keyExpr`, o próprio item); `-1` se não está nas linhas. */
  #rowIndexOfKey(key: unknown): number {
    if (key === undefined) {
      return -1;
    }

    const active = this.#rowAt(this.#activeRowIndex);

    if (isDataRow(active) && active.item === key) {
      return this.#activeRowIndex;
    }

    return this.#rows.indexOfItem(key);
  }

  /** Linha `index` (ou `undefined` fora da lista). */
  #rowAt(index: number): Row | undefined {
    return index >= 0 && index < this.#rows.length ? this.#rows.at(index) : undefined;
  }

  /** Rodapé de totais: navegável como a última linha (índice = número de linhas do corpo). */
  get #hasTotals(): boolean {
    return this.#totalSpecs.length > 0;
  }

  /** Identidade estável da linha `index` (sobrevive a ordenar, agrupar e trocar `items`). */
  #refAt(index: number): ActiveRef | null {
    if (index === this.#rows.length && this.#hasTotals) {
      return { totals: true };
    }

    const row = this.#rowAt(index);

    if (!row) {
      return null;
    }

    return isDataRow(row) ? { item: row.item } : { rowKey: row.key };
  }

  #isRefAt(index: number, target: ActiveRef): boolean {
    if ('totals' in target) {
      return index === this.#rows.length;
    }

    const row = this.#rowAt(index);

    if (!row) {
      return false;
    }

    return 'item' in target ? isDataRow(row) && row.item === target.item : row.key === target.rowKey;
  }

  #currentNavColumns(): NavColumn[] {
    return this.#showSelectionColumn ? [SELECTION_COLUMN, ...this._visibleColumns] : [...this._visibleColumns];
  }

  #publicFocus(): PublicFocus {
    const column = this.#activeColumn;
    const row = this.#rowAt(this.#activeRowIndex);

    if (!row) {
      const cellType = this.#activeRowIndex === HEADER_ROW ? 'header' : 'summary';
      return { rowKey: null, column: column && column !== SELECTION_COLUMN ? column : null, cellType };
    }

    if (row.isGroup) {
      return { rowKey: null, column: null, cellType: 'group' };
    }

    if (row.isFooter) {
      return { rowKey: null, column: column && column !== SELECTION_COLUMN ? column : null, cellType: 'summary' };
    }

    return column === SELECTION_COLUMN || !column
      ? { rowKey: row.item, column: null, cellType: column ? 'selection' : 'data' }
      : { rowKey: row.item, column, cellType: 'data' };
  }

  #revealAttempts = 0;

  /** Move a célula ativa. `source` nulo = setter (sem evento). */
  #setActive(
    { row, col }: CellPosition,
    source: GridChangeSource | null,
    { focus = false, reveal = false }: { focus?: boolean; reveal?: boolean } = {},
  ): void {
    const navColumns = this.#currentNavColumns();
    const index = row === HEADER_ROW || this.#refAt(row) ? row : this.#activeRowIndex;

    this.#activeRowIndex = index;
    this.#activeRef = this.#refAt(index);
    this.#activeCol = Math.min(Math.max(col, 0), Math.max(navColumns.length - 1, 0));
    this.#activeColumn = navColumns[this.#activeCol];
    this.#activeResolved = true;
    this.#focusPending ||= focus;
    this.#revealPending ||= reveal || focus;
    this.#revealAttempts = 0;
    this.#reportFocus(source);
    this.requestUpdate();
  }

  /** Avisa a mudança da célula ativa (`source` nulo: só registra). */
  #reportFocus(source: GridChangeSource | null): void {
    const next = this.#publicFocus();
    const previous = this.#reportedFocus;

    this.#reportedFocus = next;

    if (
      !source
      || !previous
      || (previous.rowKey === next.rowKey && previous.column === next.column && previous.cellType === next.cellType)
    ) {
      return;
    }

    this.dispatchEvent(new CustomEvent('u-grid-focus-change', this.#eventInit<GridFocusChangeEventDetail>({
      rowKey: next.rowKey,
      column: next.column,
      cellType: next.cellType,
      previousRowKey: previous.rowKey,
      previousColumn: previous.column,
      source,
    })));
  }

  /**
   * Acerta a célula ativa às linhas e colunas deste render: a linha é
   * achada pela chave (sobrevive a ordenar, agrupar e trocar `items`); se
   * saiu, a ativa fica no mesmo índice (limitado). A coluna segue a
   * definição (sobrevive a reordenar).
   */
  #resolveActive(navColumns: NavColumn[]): void {
    const rows = this.#rows;
    let index = this.#activeRowIndex;

    const active = this.#activeRef;

    if (active && !this.#isRefAt(index, active)) {
      const found = 'totals' in active
        ? this.#hasTotals ? rows.length : -1
        : 'item' in active ? rows.indexOfItem(active.item) : rows.indexOfKey(active.rowKey);
      index = found >= 0 ? found : index;
    }

    const lastRow = rows.length - (this.#hasTotals ? 0 : 1);

    if (index > lastRow) {
      index = lastRow;
    }

    if (index === HEADER_ROW && !this.showColumnHeaders && rows.length) {
      index = 0;
    }

    if (index < HEADER_ROW) {
      index = HEADER_ROW;
    }

    let col = this.#activeColumn === undefined ? -1 : navColumns.indexOf(this.#activeColumn);

    if (col < 0) {
      col = Math.min(this.#activeCol, Math.max(navColumns.length - 1, 0));
    }

    this.#activeRowIndex = index;
    this.#activeRef = this.#refAt(index);
    this.#activeCol = col;
    this.#activeColumn = navColumns[col];
    this.#navColumns = navColumns;

    if (!this.#activeResolved) {
      this.#activeResolved = true;
      this.#reportedFocus = this.#publicFocus();
    }
  }

  /** `col` negativo: qualquer coluna (linha de grupo, célula única). */
  #isActive(row: number, col: number): boolean {
    return row === this.#activeRowIndex && (col < 0 || col === this.#activeCol);
  }

  #activeCellElement(): HTMLElement | null {
    return this.#tableRef.value?.querySelector<HTMLElement>(':scope > thead [tabindex="0"], :scope > tbody [tabindex="0"], :scope > tfoot [tabindex="0"]') ?? null;
  }

  /** Depois do render: foco do DOM e rolagem até a célula ativa. */
  #afterActiveRender(): void {
    const cell = this.#activeCellElement();

    if (!cell) {
      this.#focusPending = false;
      this.#revealPending = false;
      return;
    }

    if (this.#focusPending) {
      this.#focusPending = false;
      cell.focus({ preventScroll: true });
    }

    if (!this.#revealPending) {
      return;
    }

    if (cell.closest('tr')?.classList.contains('pinned')) {
      // Fora da janela virtual: rola pelo tamanho medido; o render disparado
      // pela rolagem traz a linha e termina o ajuste (horizontal).
      if (++this.#revealAttempts > 3) {
        this.#revealPending = false;
      }

      this.#scrollRowIntoView(this.#activeRowIndex);
      return;
    }

    this.#revealPending = false;

    const scroller = this._scrollContainerRef.value;

    if (scroller) {
      // Cabeçalho/barra presos no topo: a célula não para embaixo deles.
      scroller.style.scrollPaddingBlockStart = cell.tagName === 'TH' ? '0px' : `${this.#stickyTop()}px`;
    }

    cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /** Rola até a linha `index` sem depender de ela estar renderizada (abaixo do que é fixo no topo). */
  #scrollRowIntoView(index: number): void {
    this.#virtualizer.scrollToIndex(index);
  }

  /** Altura do que fica preso no topo da rolagem (cabeçalho das colunas ou barra). */
  #stickyTop(): number {
    const root = this.renderRoot;
    const thead = root.querySelector<HTMLElement>('thead');
    const toolbar = root.querySelector<HTMLElement>('.header');

    // Com a barra, o cabeçalho prende logo abaixo dela (\`.header + table thead\`).
    return (thead?.offsetHeight ?? 0) + (toolbar?.offsetHeight ?? 0);
  }

  /** Linhas do corpo que cabem na área visível. */
  #pageSize(): number {
    const scroller = this._scrollContainerRef.value;

    if (!scroller) {
      return 1;
    }

    return Math.max(1, Math.floor((scroller.clientHeight - this.#stickyTop()) / this.rowHeight));
  }

  /** Célula navegável (td/th com `data-col`) no caminho do evento. */
  #navCellOf(path: EventTarget[]): HTMLElement | undefined {
    const table = this.#tableRef.value;

    for (const node of path) {
      if (node === table) {
        return undefined;
      }

      if (node instanceof HTMLElement && node.hasAttribute('data-col') && (node.tagName === 'TD' || node.tagName === 'TH')) {
        return node;
      }
    }

    return undefined;
  }

  #positionOf(cell: HTMLElement): CellPosition | undefined {
    const tr = cell.parentElement;

    if (!(tr instanceof HTMLTableRowElement)) {
      return undefined;
    }

    const section = tr.parentElement?.tagName;
    const row = section === 'THEAD' ? HEADER_ROW : section === 'TFOOT' ? this.#rows.length : Number(tr.getAttribute('data-index') ?? NaN);

    if (Number.isNaN(row)) {
      return undefined;
    }

    const col = Number(cell.getAttribute('data-col') ?? NaN);

    return { row, col: Number.isNaN(col) ? this.#activeCol : col };
  }

  /** Foco que entra numa célula (clique, Tab, conteúdo da célula): ela vira a ativa. */
  readonly #onGridFocusIn = (event: FocusEvent): void => {
    const path = event.composedPath();
    const cell = this.#navCellOf(path);
    const position = cell && this.#positionOf(cell);

    if (!cell || !position) {
      return;
    }

    const sameRow = position.row === this.#activeRowIndex;

    if (!sameRow || (position.col !== this.#activeCol && !this.#rowAt(position.row)?.isGroup)) {
      this.#setActive(position, 'user');
    } else if (path[0] === cell && cell.closest('tr')?.classList.contains('pinned')) {
      // Tab de volta para a célula ativa que está fora da tela: traz a linha.
      this.#revealPending = true;
      this.#revealAttempts = 0;
      this.requestUpdate();
    }
  };

  readonly #onGridKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.isComposing) {
      return;
    }

    const path = event.composedPath();
    const cell = this.#navCellOf(path);
    const position = cell && this.#positionOf(cell);

    if (!cell || !position) {
      return;
    }

    // Foco dentro do conteúdo da célula (Enter/F2): as teclas são dele; Esc volta à célula.
    if (path[0] !== cell) {
      if (event.key === 'Escape') {
        event.preventDefault();
        cell.focus();
      }

      return;
    }

    const ctrl = event.ctrlKey || event.metaKey;
    const column = this.#navColumns[position.col];
    const row = this.#rowAt(position.row);

    if (!row && this.#onHeaderKeyDown(event, cell, column)) {
      return;
    }

    if (ctrl && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'a') {
      if (this.#selectionMode === 'multiple') {
        event.preventDefault();

        if (this.#selectAll(true, 'user')) {
          this.#announceSelectionCount();
        }
      }

      return;
    }

    const key = navigationKeyOf(event, this._isRtl());

    if (key) {
      if (!event.altKey) {
        this.#navigate(event, position, key, row);
      }

      return;
    }

    if (!row) {
      return;
    }

    if (row.isGroup) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.#toggleGroup(row);
      }

      return;
    }

    if (!isDataRow(row)) {
      return;
    }

    if (event.key === ' ' && this.#selectionMode !== 'none') {
      event.preventDefault();

      if (event.shiftKey) {
        this.#extendSelection(position.row, ctrl);
      } else {
        this.#toggleRow(row);
      }
    } else if ((event.key === 'Enter' || event.key === 'F2') && column !== SELECTION_COLUMN) {
      if (focusFirstWithin(cell)) {
        event.preventDefault();
      }
    }
  };

  /** Teclas próprias do cabeçalho; `true` = tratada. */
  #onHeaderKeyDown(event: KeyboardEvent, cell: HTMLElement, column: NavColumn | undefined): boolean {
    if (column === SELECTION_COLUMN) {
      if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
        event.preventDefault();
        this.#toggleAll();
        return true;
      }

      return false;
    }

    if (!column) {
      return false;
    }

    const ctrl = event.ctrlKey || event.metaKey;

    if (event.altKey && event.shiftKey && !ctrl && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      const forward = (event.key === 'ArrowRight') !== this._isRtl();
      this.#keyboardMoveColumn(column, forward ? 1 : -1);
      return true;
    }

    if (ctrl && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'g') {
      event.preventDefault();
      this._userGroupColumn(column, this._groupColumns.length);
      this.#announce(formatMessage(this.#translation.groupedAnnouncement, { column: column.label ?? '' }));
      this.#focusPending = true;
      return true;
    }

    if (event.key === 'F2') {
      // Conteúdo interativo do cabeçalho (fora da ordem de Tab): funil, depois a alça.
      const target = cell.querySelector<HTMLElement>('.header-filter-button') ?? cell.querySelector<HTMLElement>('.resize-handle');

      if (target) {
        event.preventDefault();
        target.focus();
      }

      return true;
    }

    // Alt+↓ abre o filtro do cabeçalho (Esc fecha e devolve o foco ao funil; Esc de novo, à célula).
    if (event.altKey && !event.shiftKey && !ctrl && event.key === 'ArrowDown') {
      const funnel = cell.querySelector<HTMLElement>('.header-filter-button');

      if (funnel) {
        event.preventDefault();
        funnel.click();
      }

      return true;
    }

    return false;
  }

  #navigate(event: KeyboardEvent, position: CellPosition, key: NavigationKey, row: Row | undefined): void {
    event.preventDefault();

    // Linha de grupo: → expande, ← recolhe ou vai ao grupo de cima.
    if (row?.isGroup && (key === 'left' || key === 'right') && !event.shiftKey) {
      if (key === 'right' ? !row.expanded : row.expanded) {
        this.#toggleGroup(row);
      } else if (key === 'left') {
        const parent = this.#parentGroupIndex(position.row);

        if (parent >= 0) {
          this.#setActive({ row: parent, col: this.#activeCol }, 'user', { focus: true });
        }
      }

      return;
    }

    const next = nextCell({ row: position.row, col: row?.isGroup ? this.#activeCol : position.col }, key, {
      rowCount: this.#rows.length + (this.#hasTotals ? 1 : 0),
      colCount: this.#navColumns.length,
      hasHeader: this.showColumnHeaders,
      pageSize: this.#pageSize(),
      isGroupRow: index => !!this.#rowAt(index)?.isGroup,
    });

    this.#setActive(next, 'user', { focus: true });

    const vertical = key === 'up' || key === 'down' || key === 'pageUp' || key === 'pageDown';

    if (event.shiftKey && vertical && next.row >= 0 && this.#selectionMode === 'multiple') {
      this.#extendSelection(next.row, event.ctrlKey || event.metaKey);
    }
  }

  #parentGroupIndex(index: number): number {
    const row = this.#rowAt(index);

    if (!row?.isGroup || row.level === 0) {
      return -1;
    }

    for (let i = index - 1; i >= 0; i--) {
      const candidate = this.#rows.at(i);

      if (candidate.isGroup && candidate.level < row.level) {
        return i;
      }
    }

    return -1;
  }

  /** Alt+Shift+←/→ no cabeçalho: troca a coluna com a vizinha visível do mesmo bloco. */
  #keyboardMoveColumn(column: GridColumnDef, direction: 1 | -1): void {
    const visible = this._visibleColumns;
    const neighbor = visible[visible.indexOf(column) + direction];

    if (!neighbor || !this._sameBlock(column, neighbor)) {
      return;
    }

    const neighborIndex = this._regularColumns.indexOf(neighbor);
    this._userMoveColumn(column, direction > 0 ? neighborIndex + 1 : neighborIndex);

    // `_visibleColumns` só é refeito no próximo update: posição pela ordem nova das comuns.
    const visibleAfter = this._regularColumns.filter(c => this._isColumnVisible(c));

    this.#announce(formatMessage(this.#translation.columnMovedAnnouncement, {
      column: column.label ?? '',
      position: String(visibleAfter.indexOf(column) + 1),
      count: String(visibleAfter.length),
    }));
    this.#focusPending = true;
    this.#revealPending = true;
  }

  /** Teclado no chip do painel de grupos (barra com roving tabindex). */
  #onChipKeyDown(column: GridColumnDef, index: number, event: KeyboardEvent): void {
    const ctrl = event.ctrlKey || event.metaKey;
    const count = this._groupColumns.length;
    const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
    const forward = (event.key === 'ArrowRight') !== this._isRtl();

    if (horizontal && event.altKey && event.shiftKey && !ctrl) {
      event.preventDefault();
      const target = index + (forward ? 1 : -1);

      if (target >= 0 && target < count) {
        this._userGroupColumn(column, forward ? target + 1 : target);
        this.#announce(formatMessage(this.#translation.groupedAnnouncement, { column: column.label ?? '' }));
        this.#focusChip(target);
      }

      return;
    }

    if ((ctrl && !event.altKey && event.key.toLowerCase() === 'g') || event.key === 'Delete') {
      event.preventDefault();
      this.#moveColumnTo(false, column, this._regularColumns.length, 'user');
      this.#announce(formatMessage(this.#translation.ungroupedAnnouncement, { column: column.label ?? '' }));
      this.#activeChip = Math.min(index, Math.max(count - 2, 0));
      // O foco vai ao cabeçalho da coluna devolvida (fim das comuns).
      void this.updateComplete.then(() => {
        const col = this.#currentNavColumns().indexOf(column);

        if (col >= 0 && this.showColumnHeaders) {
          this.#setActive({ row: HEADER_ROW, col }, 'user', { focus: true });
        }
      });
      return;
    }

    if (horizontal && !event.altKey && !ctrl) {
      event.preventDefault();
      this.#focusChip(Math.min(Math.max(index + (forward ? 1 : -1), 0), count - 1));
    } else if ((event.key === 'Home' || event.key === 'End') && !ctrl) {
      event.preventDefault();
      this.#focusChip(event.key === 'Home' ? 0 : count - 1);
    } else if (this.groupPanelMenu && (isContextMenuKey(event) || (!this.#canSortByUser(column) && isActivationKey(event)))) {
      event.preventDefault();
      this.#groupMenu.show({ column, returnFocus: event.currentTarget as HTMLElement });
    } else if (isActivationKey(event) && !event.repeat && this.#canSortByUser(column)) {
      event.preventDefault();
      this.#onGroupChipActivate(column, event);
    }
  }

  #focusChip(index: number): void {
    this.#activeChip = index;
    this.#chipFocusPending = true;
    this.requestUpdate();
  }

  // ----------------------------------------------------------------- render

  override render() {

    this.#ensureRows();
    this.#hasWrap = this._visibleColumns.some(column => column.wrap);

    const rows = this.#rows;
    const virtualizer = this.#virtualizer;

    virtualizer.count = rows.length;

    // Antes de medir (1º render, SSR, contêiner sem altura) a janela são as
    // primeiras linhas, em vez de "sem dados".
    const window = virtualizer.renderWindow();

    const navColumns = this.#currentNavColumns();
    this.#resolveActive(navColumns);

    const layout = this.#columnLayout();
    const headerRows = (this.showColumnHeaders ? 1 : 0) + (this.showFilterRow ? 1 : 0);
    const footerRows = this.#totalSpecs.length ? 1 : 0;
    const selectionMode = this.#selectionMode;
    const classes = {
      striped: this.striped,
      'row-lines': this.showRowLines,
      'column-lines': this.showColumnLines,
    };

    // Com todas as larguras definidas a tabela não estica: soma exata (como
    // no modo `widget` da referência). Com alguma automática, ocupa a largura.
    const fit = layout.length > 0 && layout.every(({ column }) =>
      this.#userWidths.has(column) || (column.width !== null && column.width !== undefined));

    // O foco de teclado (`focus()`/`scrollIntoView`) não para sob o que é fixo/sticky.
    const fixedEnd = layout.reduce((sum, { column, width }) => sum + (this._fixedOf(column) === 'end' ? width ?? 0 : 0), 0);
    const fixedStart = layout.reduce((sum, { column, width }) => sum + (this._fixedOf(column) === 'start' ? width ?? 0 : 0), 0);
    const scrollPadding = `scroll-padding-inline: ${this.#stickyStart() + fixedStart}px ${fixedEnd}px;`;

    return html`
      <div
        class="container ${classMap(classes)}"
        ${ref(this._containerRef)}>
        <div class="scroll-container" style=${scrollPadding} ${ref(this._scrollContainerRef)}>
          ${this.#renderToolbar()}
          <table
            class=${fit ? 'fit' : ''}
            role=${this._groupColumns.length ? 'treegrid' : 'grid'}
            aria-rowcount="${rows.length + headerRows + footerRows}"
            aria-colcount="${navColumns.length}"
            aria-multiselectable=${ifDefined(selectionMode === 'multiple' ? 'true' : undefined)}
            ${ref(this.#tableRef)}
            @pointerover=${this.#updateCellHint}
            @keydown=${this.#onGridKeyDown}
            @focusin=${this.#onGridFocusIn}>
            <colgroup>${this.#renderColGroups(layout)}</colgroup>
            ${this.#renderColumnHeaders(layout)}
            <tbody role="rowgroup" style="height: ${virtualizer.getTotalSize()}px;" @click=${this.#onBodyClick}>
              <tr class="spacer" role="presentation" aria-hidden="true" style="height: ${window.offset}px;"></tr>
              ${this.#renderBody(window, headerRows, layout)}
              <tr role="presentation"></tr>
            </tbody>
            ${footerRows ? this.#renderTotalFooter(layout, rows.length + headerRows + 1) : nothing}
          </table>
        </div>
        ${this.#chooser.open ? this.#renderColumnChooser() : nothing}
        ${this.headerFilter ? renderHeaderFilter(this.#headerFilterPopover, this.#translation) : nothing}
        ${this.#filterRow.menuColumn
          ? renderFilterMenu(this.#filterRow, this.#filterRow.menuColumn, this.#dataTypeOf(this.#filterRow.menuColumn), this.#translation)
          : nothing}
      </div>
      ${this.#groupMenu.open ? this.#renderGroupPanelMenu() : nothing}
      <div class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">${this.#announcement}</div>
      <slot hidden @slotchange=${this.#readDeclarativeColumns}></slot>
    `;
  }

  #renderColGroups(layout: ColumnLayout[]): HTMLTemplateResult {
    return html`
      ${map(this._groupColumns, () => html`
        <col class="group-column"/>`)}
      ${this.#showSelectionColumn ? html`<col class="selection-column"/>` : nothing}
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

  /** Estado da caixa "selecionar tudo" pelas linhas filtradas. */
  #selectAllState(): 'true' | 'false' | 'mixed' {
    const total = this.#sortedItems.length;
    const count = total ? this.#selectedInViewCount() : 0;

    return count === 0 ? 'false' : count === total ? 'true' : 'mixed';
  }

  #renderCheckbox(checked: 'true' | 'false' | 'mixed', label: string) {
    return html`<span
      class="selection-checkbox"
      part="selection-checkbox"
      role="checkbox"
      aria-checked=${checked}
      aria-label=${label}><svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 -960 960 960"
        width="18"
        height="18"
        fill="currentColor"
        aria-hidden="true"><path d=${checked === 'mixed' ? MIXED_PATH : CHECK_PATH}/></svg></span>`;
  }

  #renderColumnHeaders(layout: ColumnLayout[]) {
    if (!this.showColumnHeaders && !this.showFilterRow) {
      return nothing;
    }

    return html`
      <thead role="rowgroup">
        ${this.showColumnHeaders ? this.#renderHeaderRow(layout) : nothing}
        ${this.showFilterRow ? this.#renderFilterRow(layout) : nothing}
      </thead>
    `;
  }

  /** Linha de filtro: um editor por coluna visível filtrável. */
  #renderFilterRow(layout: ColumnLayout[]) {
    const translation = this.#translation;

    return html`
      <tr class="filter-row" part="filter-row" role="row" aria-rowindex=${this.showColumnHeaders ? 2 : 1}>
        ${map(this._groupColumns, (_, index) => html`
          <td
            role="presentation"
            class="group-column sticky-cell"
            style="inset-inline-start: ${index * GROUP_COLUMN_WIDTH}px"></td>`)}
        ${this.#showSelectionColumn
          ? html`<td
            class="selection-cell sticky-cell"
            part="selection-cell"
            role="gridcell"
            aria-colindex="1"
            style="inset-inline-start: ${this._groupColumns.length * GROUP_COLUMN_WIDTH}px"></td>`
          : nothing}
        ${map(layout, (cell, index) => renderFilterCell({
          controller: this.#filterRow,
          column: cell.column,
          dataType: this.#dataTypeOf(cell.column),
          filterable: isColumnFilterable(cell.column),
          translation,
          className: cell.className,
          style: cell.style,
          colIndex: index + 1 + (this.#showSelectionColumn ? 1 : 0),
        }))}
      </tr>`;
  }

  #renderHeaderRow(layout: ColumnLayout[]) {
    const rowSorting = this.#sorting.filter(spec => !this.#isGrouped(spec.column));
    const showIndex = rowSorting.length > 1;
    const filterValue = this.#filtering.filterValue;
    const offset = this.#showSelectionColumn ? 1 : 0;
    const translation = this.#translation;

    return html`
        <tr id="header-columns-row" role="row" aria-rowindex="1">
          ${map(this._groupColumns, (_, index) => html`
            <th
              role="presentation"
              class="group-column sticky-cell"
              style="inset-inline-start: ${index * GROUP_COLUMN_WIDTH}px"></th>`)}
          ${offset
            ? html`
              <th
                class="selection-cell sticky-cell"
                part="selection-cell"
                role="columnheader"
                aria-colindex="1"
                data-col="0"
                tabindex=${this.#isActive(HEADER_ROW, 0) ? 0 : -1}
                style="inset-inline-start: ${this._groupColumns.length * GROUP_COLUMN_WIDTH}px"
                @click=${() => this.#toggleAll()}>${this.#renderCheckbox(this.#selectAllState(), translation.selectAllRows)}</th>`
            : nothing}
          ${map(layout, (cell, index) => {
            const { column } = cell;
            const position = rowSorting.findIndex(spec => spec.column === column);

            return renderHeaderCell({
              column,
              classes: cell.headerClasses,
              styles: cell.headerStyles,
              colIndex: index + 1 + offset,
              tabIndex: this.#isActive(HEADER_ROW, index + offset) ? 0 : -1,
              sortable: this.#canSortByUser(column),
              order: rowSorting[position]?.order,
              sortIndex: showIndex && position >= 0 ? position + 1 : undefined,
              onActivate: this.#onHeaderActivate,
              onPointerDown: this.#onSortPointerDown,
              // Alt+Shift+←/→ move a coluna (no grid); só Alt+←/→ redimensiona.
              onKeyDown: cell.resizable
                ? (event: KeyboardEvent) => {
                  if (!event.shiftKey) {
                    this.#resize.keyDown(event, column, true);
                  }
                }
                : undefined,
              trailing: cell.resizable ? this.#renderResizeHandle(cell) : nothing,
              filterButton: this.headerFilter && isColumnFilterable(column)
                ? renderHeaderFilterButton(this.#headerFilterPopover, column, filterValue, this.#translation)
                : nothing,
              filtered: hasColumnCondition(filterValue, column),
            });
          })}
        </tr>`;
  }

  #renderResizeHandle({ column, bounds, width }: ColumnLayout) {
    // Fora da ordem de Tab (o grid tem um ponto só): F2 no cabeçalho chega aqui, Esc volta.
    return html`<div
      class="resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label=${column.label ?? ''}
      aria-valuenow=${ifDefined(width === undefined ? undefined : Math.round(width))}
      aria-valuemin=${bounds.min}
      aria-valuemax=${ifDefined(Number.isFinite(bounds.max) ? bounds.max : undefined)}
      tabindex="-1"
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

  #renderBody(window: VirtualWindow, headerRows: number, layout: ColumnLayout[]) {

    if (!this.#rows.length) {
      return html`
        <tr role="row" class="no-data-row">
          <td role="gridcell" part="no-data" colspan="${Math.max(this.#totalColumns(layout), 1)}">${this.#translation.noData}</td>
        </tr>
      `;
    }

    // As linhas ficam no fluxo da tabela, uma após a outra, depois de uma
    // linha espaçadora com a altura até a 1ª linha da janela (vale também
    // com alturas diferentes, `wrap`). Só a espaçadora muda de estilo ao
    // rolar — um `transform` por linha recalcularia o estilo de todas, e no
    // `<tbody>` encolheria a caixa da tabela e soltaria o cabeçalho
    // `sticky` (spec 16).
    const { first, end } = window;
    const entries = this.#rows.slice(first, end).map((row, i) => ({ row, index: first + i, pinned: false }));

    // A linha da célula ativa fica no DOM mesmo fora da janela virtual
    // (invisível, fora do fluxo): o foco não se perde ao rolar e o Tab volta
    // a ela. Fica antes/depois da janela, na mesma ordem: ao voltar à tela a
    // parte não é movida (mover tiraria o foco).
    const active = this.#activeRowIndex;

    if (active >= 0 && active < this.#rows.length && (active < first || active >= end)) {
      const pinned = { row: this.#rows.at(active), index: active, pinned: true };

      if (active < first) {
        entries.unshift(pinned);
      } else {
        entries.push(pinned);
      }
    }

    return keyedRows(
      entries,
      entry => entry.row.key,
      entry => this.#renderRow(entry.index, entry.row, headerRows, layout, entry.pinned),
    );
  }

  #totalColumns(layout: ColumnLayout[]): number {
    return this._groupColumns.length + (this.#showSelectionColumn ? 1 : 0) + layout.length;
  }

  #renderRow(index: number, row: Row, headerRows: number, layout: ColumnLayout[], pinned: boolean) {
    const parity = row.isGroup || row.isFooter
      ? ''
      : row.index % 2 === 0 ? 'odd' : 'even';
    const selectable = isDataRow(row) && this.#selectionMode !== 'none';
    const selected = selectable && this.#selection.has(row.item);

    const classes: Record<string, boolean> = {
      'group-row': row.isGroup,
      'group-footer-row': !!row.isFooter,
      'summary-row': !!row.isFooter,
      last: index === this.#rows.length - 1,
      selected,
      pinned,
    };

    if (parity) {
      classes[parity] = true;
    }

    const parts = ['row', row.isGroup ? 'group-row' : row.isFooter ? 'group-footer-row summary-row' : parity];

    if (selected) {
      parts.push('selected');
    }

    return html`
      <tr
        style="height: ${this.rowHeight}px;"
        data-index=${index}
        role="row"
        aria-rowindex="${index + 1 + headerRows}"
        aria-level=${row.isGroup ? row.level + 1 : nothing}
        aria-expanded=${ifDefined(row.isGroup ? (row.expanded ? 'true' : 'false') : undefined)}
        aria-selected=${ifDefined(selectable ? (selected ? 'true' : 'false') : undefined)}
        class="${classMap(classes)}"
        part=${parts.join(' ')}>
        ${row.isGroup
          ? this.#renderGroupRowCells(row, index, layout)
          : row.isFooter
            ? this.#renderGroupFooterCells(row, index, layout)
            : this.#renderDataRowCells(row, index, layout, selected)}
      </tr>
    `;
  }

  /**
   * Linha de grupo: rótulo, contagem e resumos `inline` no texto; resumos
   * `column` em células próprias a partir da 1ª coluna com resumo (o rótulo
   * ocupa as anteriores, como na referência).
   */
  #renderGroupRowCells(row: GroupRow, rowIndex: number, layout: ColumnLayout[]) {
    const groupColumns = this._groupColumns.length;
    const offset = this.#showSelectionColumn ? 1 : 0;
    const totalColumns = groupColumns + offset + layout.length;
    // Colunas depois do botão: recuos dos níveis internos, caixas e colunas comuns.
    const base = groupColumns - row.level - 1 + offset;
    const specs = this.#groupSpecs;
    let alignedFrom = layout.length;

    const indexOf = (column: GridColumnDef | undefined): number =>
      column ? layout.findIndex(cell => cell.column === column) : -1;

    for (const { item, spec } of specs) {
      const index = indexOf(spec.column);

      if (item.display === 'column' && index >= 0 && base + index >= 1) {
        alignedFrom = Math.min(alignedFrom, index);
      }
    }

    const isAligned = ({ spec }: ResolvedSummary, display?: string): boolean => {
      const index = indexOf(spec.column);
      return display === 'column' && index >= alignedFrom;
    };

    const parts: string[] = [];

    if (this.showGroupCount) {
      parts.push(getNumberFormat(this.language, { maximumFractionDigits: 0 }).format(row.itemCount));
    }

    specs.forEach((summary, index) => {
      const display = summary.item.display ?? 'inline';

      if (display !== 'footer' && !isAligned(summary, display)) {
        parts.push(this.#summaryText(summary, row.summaries[index]).label);
      }
    });

    const info = parts.length ? formatMessage(this.#translation.groupInfoText, { info: this.#formatList(parts) }) : '';
    const alignedTexts = this.#textsByColumn(specs, row.summaries, summary => isAligned(summary, (summary.item as GridGroupSummaryItem).display));
    const aligned = alignedFrom < layout.length
      ? renderSummaryCells(layout, alignedTexts, alignedFrom, this.#listSeparatorText, offset)
      : nothing;
    // A linha de grupo é um ponto só da navegação: os resumos alinhados entram no rótulo dela.
    const alignedLabels = [...alignedTexts.values()].flat().map(text => text.label);
    const valueText = this.#groupValueText(row);
    const ariaLabel = alignedLabels.length
      ? [`${groupRowLabel(row, this.#translation.groupLabelSeparator, valueText)}${info ? ` ${info}` : ''}`, ...alignedLabels].join(this.#listSeparatorText)
      : undefined;

    return renderGroupRowCells({
      row,
      totalColumns,
      separator: this.#translation.groupLabelSeparator,
      valueText,
      info,
      ariaLabel,
      labelSpan: base + alignedFrom,
      trailing: aligned,
      tabIndex: this.#isActive(rowIndex, -1) ? 0 : -1,
      onToggle: this.#toggleGroup,
    });
  }

  #renderGroupFooterCells(row: GroupFooterRow, rowIndex: number, layout: ColumnLayout[]) {
    const texts = this.#textsByColumn(this.#groupSpecs, row.summaries, ({ item }) => (item as GridGroupSummaryItem).display === 'footer');
    const offset = this.#showSelectionColumn ? 1 : 0;

    return html`
      ${renderIndentCells(this._groupColumns.length, GROUP_COLUMN_WIDTH)}
      ${this.#renderEmptySelectionCell(rowIndex)}
      ${renderSummaryCells(layout, texts, 0, this.#listSeparatorText, offset, col => this.#isActive(rowIndex, col) ? 0 : -1)}
    `;
  }

  /** Célula da coluna de caixas nas linhas de resumo (vazia, mas navegável). */
  #renderEmptySelectionCell(rowIndex: number) {
    return this.#showSelectionColumn
      ? html`<td
        class="selection-cell sticky-cell"
        part="selection-cell"
        role="gridcell"
        aria-colindex="1"
        data-col="0"
        tabindex=${this.#isActive(rowIndex, 0) ? 0 : -1}
        style="inset-inline-start: ${this._groupColumns.length * GROUP_COLUMN_WIDTH}px"></td>`
      : nothing;
  }

  #renderTotalFooter(layout: ColumnLayout[], ariaRowIndex: number) {
    const rowIndex = this.#rows.length;

    return renderTotalFooter({
      layout,
      texts: this.#textsByColumn(this.#totalSpecs, this.#totals, () => true),
      groupColumns: this._groupColumns.length,
      groupColumnWidth: GROUP_COLUMN_WIDTH,
      rowIndex: ariaRowIndex,
      separator: this.#listSeparatorText,
      leading: this.#renderEmptySelectionCell(rowIndex),
      colOffset: this.#showSelectionColumn ? 1 : 0,
      tabIndexOf: col => this.#isActive(rowIndex, col) ? 0 : -1,
    });
  }

  #renderDataRowCells(row: DataRow, rowIndex: number, layout: ColumnLayout[], selected: boolean) {
    const offset = this.#showSelectionColumn ? 1 : 0;
    const matcher = this.#highlightMatcher();

    return html`
      ${map(this._groupColumns, (_, index) => html`
        <td
          role="presentation"
          class="group-column sticky-cell"
          style="inset-inline-start: ${index * GROUP_COLUMN_WIDTH}px"></td>`)}
      ${offset
        ? html`
          <td
            class="selection-cell sticky-cell"
            part="selection-cell"
            role="gridcell"
            aria-colindex="1"
            data-col="0"
            tabindex=${this.#isActive(rowIndex, 0) ? 0 : -1}
            style="inset-inline-start: ${this._groupColumns.length * GROUP_COLUMN_WIDTH}px">${this.#renderCheckbox(selected ? 'true' : 'false', this.#translation.selectRow)}</td>`
        : nothing}
      ${map(layout, (cell, index) => html`
        <td
          part="cell"
          class=${cell.cellClassName}
          style=${cell.style}
          role="gridcell"
          aria-colindex="${index + 1 + offset}"
          data-col=${index + offset}
          tabindex=${this.#isActive(rowIndex, index + offset) ? 0 : -1}>${this.#renderCellContent(row, cell, matcher)}</td>`)}
    `;
  }

  /** Conteúdo da célula, com os trechos da busca destacados (só texto nativo). */
  #renderCellContent(row: DataRow, cell: ColumnLayout, matcher: RegExp | null) {
    const content = renderDataCell(this, row, cell.column, cell.id, cell.format);

    return matcher && typeof content === 'string' && isColumnFilterable(cell.column)
      ? renderHighlighted(content, matcher)
      : content;
  }

  /** Barra acima da tabela: painel de grupos, busca e/ou botão do seletor de colunas. */
  #renderToolbar() {
    if (!this.showGroupPanel && !this.columnChooser && !this.showSearchPanel) {
      return nothing;
    }

    const translation = this.#translation;

    return html`
      <div class="header" role="toolbar">
        ${this.showGroupPanel ? this.#renderGroupPanel() : html`<div class="toolbar-spacer"></div>`}
        ${this.showSearchPanel ? renderSearchPanel(this.#search, translation) : nothing}
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
      <div class="group-container" ${ref(this._groupContainerRef)} @contextmenu=${this.#onGroupPanelContextMenu}>
        ${this._groupColumns.length
          ? html`
            ${map(this._groupColumns, (column, index) => this.#renderGroupChip(column, index))}
            <div class="group-end-dropzone"></div>`
          : html`<div class="drag-here">${this.#translation.dragToGroup}</div>`}
      </div>
    `;
  }

  /**
   * Chip de uma coluna agrupada: arrastável; Enter/Espaço alternam a direção
   * dos grupos (se ordenável) ou abrem o menu do painel; Shift+F10/tecla de
   * menu abrem o menu; Alt+Shift+←/→ muda o nível, Ctrl+G/Delete desagrupa.
   * ←/→ andam entre os chips (um ponto de Tab na barra).
   */
  #renderGroupChip(column: GridColumnDef, index: number) {
    const sortable = this.#canSortByUser(column);
    const menu = this.groupPanelMenu;
    // Só é "botão de menu" quando a ativação abre o menu; no ordenável a ativação ordena.
    const opensMenu = menu && !sortable;
    const order = this.#orderOf(column) ?? 'asc';
    const translation = this.#translation;
    const activeChip = Math.min(this.#activeChip, this._groupColumns.length - 1);

    return html`
      <div
        class="group ${classMap({ sortable })}"
        part="group-chip"
        style="--_order: ${index}"
        role="button"
        tabindex=${index === activeChip ? 0 : -1}
        aria-haspopup=${ifDefined(opensMenu ? 'menu' : undefined)}
        aria-expanded=${ifDefined(opensMenu ? this.#groupMenu.open && this.#groupMenu.column === column ? 'true' : 'false' : undefined)}
        aria-keyshortcuts=${ifDefined(menu && sortable ? 'Shift+F10' : undefined)}
        aria-label=${sortable ? `${column.label ?? ''}, ${order === 'asc' ? translation.sortAscending : translation.sortDescending}` : column.label ?? ''}
        @focus=${() => {
          this.#activeChip = index;
        }}
        @pointerdown=${sortable ? this.#onSortPointerDown : nothing}
        @click=${sortable ? (event: MouseEvent) => this.#onGroupChipActivate(column, event) : nothing}
        @keydown=${(event: KeyboardEvent) => this.#onChipKeyDown(column, index, event)}>
        <span class="group-label">${column.label}</span>${renderSortIndicator(order)}
      </div>`;
  }

  #focusAfterUngroup(chipIndex: number): void {
    const chips = [...this.renderRoot.querySelectorAll<HTMLElement>('.group[tabindex]')];

    if (chips.length) {
      // Roving da barra: o vizinho vira o chip com `tabindex="0"`.
      this.#focusChip(Math.min(chipIndex, chips.length - 1));
    } else {
      this.focus();
    }
  }

  /** Clique direito no painel (num chip: com "Desagrupar" desta coluna). */
  readonly #onGroupPanelContextMenu = (event: MouseEvent): void => {
    if (!this.groupPanelMenu || !this._groupColumns.length) {
      return;
    }

    event.preventDefault();

    const chip = event.composedPath().find(target => target instanceof HTMLElement && target.classList.contains('group')) as HTMLElement | undefined;
    const column = chip ? this._nativeColumnMap.get(chip) ?? null : null;

    this.#groupMenu.show({ column, returnFocus: chip ?? null, x: event.clientX, y: event.clientY });
  };

  #renderGroupPanelMenu() {
    return renderGroupPanelMenu({
      translation: this.#translation,
      column: this.#groupMenu.column,
      onAction: this.#onGroupMenuAction,
      onKeyDown: this.#groupMenu.onKeyDown,
    });
  }

  readonly #onGroupMenuAction = (action: GroupPanelMenuAction): void => {
    const column = this.#groupMenu.column;
    const ungroups = action === 'ungroupColumn' || action === 'ungroupAll';
    const chipIndex = column ? this._groupColumns.indexOf(column) : 0;
    // Desagrupar tira o chip que tinha o foco: o foco vai ao chip vizinho (ou ao 1º cabeçalho).
    this.#groupMenu.hide(!ungroups);

    if (ungroups) {
      void this.updateComplete.then(() => this.#focusAfterUngroup(chipIndex));
    }

    switch (action) {
      case 'ungroupColumn':
        if (column && this._groupColumns.includes(column)) {
          this.#moveColumnTo(false, column, this._regularColumns.length, 'user');
        }

        break;
      case 'ungroupAll':
        this.#ungroupAll('user');
        break;
      case 'expandAllGroups':
        this.#setAllExpanded(true, undefined, 'user');
        break;
      case 'collapseAllGroups':
        this.#setAllExpanded(false, undefined, 'user');
        break;
    }
  };

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
    'u-grid-column-fixed-change': CustomEvent<GridColumnFixedChangeEventDetail>;
    'u-grid-group-change': CustomEvent<GridGroupEventDetail>;
    'u-grid-group-expansion-change': CustomEvent<GridGroupExpansionChangeEventDetail>;
    'u-grid-filter-change': CustomEvent<GridFilterEventDetail>;
    'u-grid-selection-change': CustomEvent<GridSelectionChangeEventDetail>;
    'u-grid-focus-change': CustomEvent<GridFocusChangeEventDetail>;
  }
}
