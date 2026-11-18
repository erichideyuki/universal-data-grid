import { ContextConsumer } from '@lit/context';

import { html, type HTMLTemplateResult, isServer, LitElement, nothing, type PropertyValues } from 'lit';
import { customElement, property, state as internalState } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { map } from 'lit/directives/map.js';
import { createRef, type Ref, ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';

import { booleanAttribute, type LegacyAttributes, numberListAttribute } from './attribute-converters.js';
import type { GridChangeSource } from './change-source.js';
import {
  type GridDataChanges,
  type GridDataSource,
  type GridKeyExpr,
  type GridRowKey,
  type GridLoadOptions,
  type GridLoadResult,
  type GridLoadSummary,
  type GridRemoteOperations,
  type GridScrollMode,
  keyReader,
  keyText,
  NO_REMOTE,
  normalizeRemoteOperations,
  type RemoteFlags,
} from './data/data-source.js';
import { flattenRemote, type LoaderQuery, remoteGroupNodes, RemoteLoader } from './data/remote-loader.js';
import { downloadBlob } from './export/download.js';
import { type ExportColumnSource, type ExportSource, type ExportSummarySource, exportRows } from './export/rows.js';
import type { GridCsvDownloadOptions, GridCsvOptions, GridExportData, GridExportDataRow, GridExportOptions } from './export/types.js';
import { type ClipboardHtmlOptions, clipboardContent, collectRows, writeCsv } from './export/write.js';
import { cycleWithin, focusFirstWithin, focusTargetsWithin } from './features/cell-content-focus.js';
import { type GridClipboardMode, isGridCopy, writeClipboard } from './features/clipboard.js';
import {
  ColumnChooserController,
  columnChooserIcon,
  type ColumnChooserItem,
  renderColumnChooser,
} from './features/column-chooser.js';
import { ColumnDragAndDropAdapter } from './features/column-dnd.js';
import { releaseInteractions } from './features/drag-helper.js';
import { isRtl } from './features/drop-position.js';
import {
  copyData,
  createProvisionalKey,
  EditStore,
  editorKindOf,
  formatEditorDate,
  formatEditorNumber,
  type GridEditChange,
  type GridEditMode,
  type GridEditTrigger,
  type GridValidationError,
  parseEditorDate,
  parseEditorNumber,
  type PendingRow,
  publicChange,
  setValueByPath,
} from './features/editing.js';
import { FilterRowController, renderFilterCell, renderFilterMenu } from './features/filter-row.js';
import { FilteringController } from './features/filtering.js';
import { GroupDragAndDropAdapter } from './features/group-dnd.js';
import {
  type GroupPanelMenuAction,
  GroupPanelMenuController,
  isContextMenuKey,
  type MenuItem,
  renderGroupPanelMenu,
  renderMenuItems,
} from './features/group-panel-menu.js';
import { HeaderFilterController, renderHeaderFilter, renderHeaderFilterButton } from './features/header-filter.js';
import { HOST_LABEL_ATTRIBUTES, HostLabel } from './features/host-label.js';
import {
  type CellPosition,
  HEADER_ROW,
  type NavigationKey,
  navigationKeyOf,
  nextCell,
  nextHeaderCell,
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
import { Debouncer, renderHighlighted, renderSearchPanel, SearchController } from './features/search.js';
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
import { UnparsedValue, validateValue, type ValidationResult } from './features/validation.js';
import {
  type GridColumnDataType,
  type GridColumnDef,
  type GridColumnFixed,
  type GridColumnRenderingMode,
  type GridDetailRenderer,
  type GridNoDataRenderer,
  type GridColumnRef,
  type GridGroupPath,
  type GridGroupSummaryItem,
  type GridSort,
  type GridSortOrder,
  type GridSummary,
  type GridSummaryItem,
  type GridSummaryValue,
  isColumnExportable,
  isColumnGroupable,
  type GridFilterCondition,
  type GridFilterExpression,
  isColumnFilterable,
  isColumnSortable,
  isColumnEditable,
  type GridEditorRenderContext,
  type GridValidationContext,
  isBand,
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
import { prefixOffsets, columnWindow, type ColumnWindow } from './render/column-window.js';
import { rendererContent } from './render/content.js';
import { renderBuiltInEditor } from './render/editors.js';
import { renderIndentCells, renderSummaryCells, renderTotalFooter, type SummaryColumnLayout, type SummaryText } from './render/footer.js';
import { groupRowLabel, renderGroupRowCells } from './render/group-row.js';
import { isActivationKey, renderBandHeaderCell, renderHeaderCell, renderSortIndicator } from './render/header.js';
import { keyedRows } from './render/keyed-rows.js';
import { RowVirtualizer, type VirtualWindow } from './render/virtualizer.js';
import { type AddedRow, RowsWithAdded } from './row-model/added-rows.js';
import {
  ancestorsOf,
  buildColumnTree,
  buildHeaderRows,
  type ColumnTree,
  headerCellAt,
  type HeaderCellLayout,
  type HeaderSlot,
  moveAmongSiblings,
  normalizeLeafOrder,
  orderedSiblings,
  rootOf,
} from './row-model/columns.js';
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
import { type BlockDetails, flattenRows, pageBounds, RowList, RowPage, type Rows } from './row-model/flatten.js';
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
  toDate,
} from './row-model/format.js';
import { buildGroups, groupKeyOf } from './row-model/group.js';
import { LruCache } from './row-model/lru.js';
import { type RankCache, sortOrder } from './row-model/sort.js';
import { type SummaryFormatContext, formatSummaryValue, summarize, type SummarySpec } from './row-model/summary.js';
import { type DataRow, type DetailRow, type GroupFooterRow, type GroupNode, type GroupRow, isLazyItems, type LazyItems, type Row } from './row-model/types.js';
import { cellValueReader, getCellValue, getValueByPath } from './row-model/value.js';
import {
  GRID_STATE_VERSION,
  type GridColumnState,
  type GridGroupExpansionState,
  type GridState,
  type GridStateChangeEventDetail,
  type GridStateChangeSource,
  type GridStateGroupPath,
  type GridStateStorage,
  groupValueToState,
  parseGridState,
} from './state/grid-state.js';
import { readWebStorage, resolveStorage, type StorageConfig, writeWebStorage } from './state/storage.js';
import { VersionedMap, VersionedSet } from './state/versioned.js';

import './grid-column.js';

export type {
  GridCellRenderContext,
  GridCellRenderer,
  GridDetailRenderContext,
  GridDetailRenderer,
  GridGroupRenderContext,
  GridGroupRenderer,
  GridHeaderRenderContext,
  GridHeaderRenderer,
  GridNoDataRenderContext,
  GridNoDataRenderer,
  GridRenderContextBase,
  GridRenderResult,
  GridColumnAlignment,
  GridColumnBooleanDisplay,
  GridColumnComparator,
  GridColumnDataType,
  GridColumnDef,
  GridColumnFixed,
  GridColumnRenderingMode,
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
  GridCustomRule,
  GridEditorRenderContext,
  GridEditorRenderer,
  GridEmailRule,
  GridPatternRule,
  GridRangeRule,
  GridRequiredRule,
  GridStringLengthRule,
  GridValidationContext,
  GridValidationRule,
  GridValidationRuleBase,
  GridValueSetter,
} from './grid-column-def.js';
export type { GridEditChange, GridEditMode, GridEditTrigger, GridValidationError } from './features/editing.js';
export type { GridSortMode, GridSortingMode } from './features/sorting.js';
export type { GridSelectionMode } from './features/selection.js';
export type {
  GridDataChanges,
  GridDataSource,
  GridKeyExpr,
  GridLoadGroup,
  GridLoadGroupResult,
  GridLoadOptions,
  GridLoadResult,
  GridLoadSort,
  GridLoadSummary,
  GridRemoteOperations,
  GridRowKey,
  GridScrollMode,
} from './data/data-source.js';
export type { GridClipboardMode } from './features/clipboard.js';
export type {
  GridCsvDownloadOptions,
  GridCsvOptions,
  GridExportColumn,
  GridExportData,
  GridExportDataRow,
  GridExportGroupRow,
  GridExportOptions,
  GridExportRow,
  GridExportSummaryRow,
} from './export/types.js';
export type {
  GridColumnState,
  GridGroupExpansionState,
  GridRowExpansionState,
  GridState,
  GridStateChangeEventDetail,
  GridStateChangeSource,
  GridStateGroupPath,
  GridStateStorage,
} from './state/grid-state.js';
export { DataGridColumn } from './grid-column.js';

/** @deprecated Use `DataGridColumn`. */
export type UmDataGridColumn = DataGridColumn;

export type { GridChangeSource } from './change-source.js';

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

/** `detail` of `u-grid-row-expansion-change`. */
export interface GridRowExpansionChangeEventDetail {
  /** Key of the master row (without `keyExpr`, the item itself). */
  rowKey: unknown;
  /** New state. */
  expanded: boolean;
  /** `user` (toggle button, keyboard) or `api` (`expandRow`/`collapseRow`). */
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

/** `detail` of `u-grid-copying`. */
export interface GridCopyEventDetail<TItem = any> {
  /** Copied rows: the selected rows in the current order, or the row of the focused cell. */
  readonly items: readonly TItem[];
  /** Copied columns: the visible exportable columns, or the focused column. */
  readonly columns: readonly GridColumnDef<TItem>[];
  /** Tab separated text the grid writes as `text/plain` (read only: cancel to write your own). */
  readonly text: string;
  /**
   * Escaped `<table>` the grid writes as `text/html` (empty above 10,000
   * rows). It carries `lang` (the grid's effective `language`) and, in a
   * right-to-left grid, `dir="rtl"`. Cells protected against formulas keep
   * the `'` prefix and get `style='mso-number-format:"\@"'`.
   */
  readonly html: string;
  /**
   * The clipboard of the native `copy` event. After `preventDefault()` the
   * grid writes nothing and lets the native copy go on: call `setData` here
   * to write your own content (synchronously, in the listener).
   */
  readonly clipboardData: DataTransfer;
}

/** `detail` of `u-grid-loading` (cancelable: `preventDefault()` skips the call and keeps the rows shown). */
export interface GridLoadingEventDetail {
  /** What the grid is about to ask the data source (frozen). */
  options: GridLoadOptions;
}

/** `detail` of `u-grid-load`. */
export interface GridLoadEventDetail {
  /** What the grid asked (frozen). */
  options: GridLoadOptions;
  /** What the data source returned. */
  result: GridLoadResult;
}

/** `detail` of `u-grid-load-error`. */
export interface GridLoadErrorEventDetail {
  /** What the grid asked (frozen). */
  options: GridLoadOptions;
  /** What the data source rejected with. */
  error: unknown;
}

/** `detail` of `u-grid-page-change`. */
export interface GridPageChangeEventDetail {
  /** Page after the change (0-based). */
  pageIndex: number;
  /** Page before the change. */
  previousPageIndex: number;
  /** Rows per page after the change. */
  pageSize: number;
  /** Rows per page before the change. */
  previousPageSize: number;
  /** `user` (pager, PageUp/PageDown, or a filter gesture that moved the page) or `api`. */
  source: GridChangeSource;
}

/**
 * Kind of the active cell: column header, data cell, selection checkbox
 * cell, group row, summary row (group footer, totals), detail toggle cell or
 * detail row (master-detail), row buttons column (editing). May gain
 * members in minor versions.
 */
export type GridCellType = 'header' | 'data' | 'selection' | 'group' | 'summary' | 'detail-toggle' | 'detail' | 'command';

/** `detail` of `u-grid-focus-change`. */
export interface GridFocusChangeEventDetail {
  /**
   * Key of the data row of the active cell (the item without `keyExpr`; in a
   * detail row, the key of its master row); `null` in headers, group and
   * summary rows.
   */
  rowKey: unknown;
  /** Column of the active cell (in a band header, the band, with `cellType: 'header'`); `null` in the selection, detail toggle and row buttons (`cellType: 'command'`) columns, in detail rows and in group rows. */
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
/** `detail` of `u-grid-edit-starting` (cancelable: `preventDefault()` keeps the cell or row closed). */
export interface GridEditStartingEventDetail<TItem = any> {
  /** Row key (a new row has an opaque provisional key). */
  readonly rowKey: unknown;
  /** The original row item (empty object for a new row). */
  readonly item: TItem;
  /** Column of the editor; `null` when a whole row opens without a column (`editRow`). */
  readonly column: GridColumnDef<TItem> | null;
  /** `user` (click, Enter/F2, Tab, Edit button) or `api` (`editCell`, `editRow`, `addRow`). */
  readonly source: GridChangeSource;
}

/** `detail` of `u-grid-row-adding` (cancelable: no row is added). */
export interface GridRowAddingEventDetail<TItem = any> {
  /** The new row (owned by the grid, already with the `addRow` argument): set its initial values here. Reassigning `detail.data` is ignored. */
  readonly data: Partial<TItem>;
  /** `user` (Add row button) or `api` (`addRow`). */
  readonly source: GridChangeSource;
}

/** `detail` of `u-grid-row-removing` (cancelable: the row stays; fired before the confirmation dialog). */
export interface GridRowRemovingEventDetail<TItem = any> {
  /** Row key. */
  readonly rowKey: unknown;
  /** The row item. */
  readonly item: TItem;
  /** `user` (Delete button) or `api` (`removeRow`). */
  readonly source: GridChangeSource;
}

/**
 * `detail` of `u-grid-row-validating`, fired for each added or edited row
 * before saving. Cancelable: `preventDefault()` (or `setError`) keeps the
 * row unsaved and marked invalid.
 */
export interface GridRowValidatingEventDetail<TItem = any> {
  /** Row key. */
  readonly rowKey: unknown;
  /** The original row item (empty object for a new row). */
  readonly item: TItem;
  /** The pending change of the row (a copy). */
  readonly change: GridEditChange<TItem>;
  /** Rules broken by the values of the row (empty when the rules passed). */
  readonly errors: readonly GridValidationError<TItem>[];
  /** Marks the row invalid with a message, on a column (its cell) or on the row. Implies `preventDefault()`; may be called several times. */
  setError(message: string, column?: GridColumnDef<TItem>): void;
  /** `user` (Enter, Save buttons) or `api` (`saveChanges`). */
  readonly source: GridChangeSource;
}

/** `detail` of `u-grid-saving` (cancelable: nothing is saved and the changes stay pending). */
export interface GridSavingEventDetail<TItem = any> {
  /** The changes to save (copies). */
  readonly changes: readonly GridEditChange<TItem>[];
  /**
   * Makes the grid wait for `promise` (save on the server here). Rejected:
   * the changes stay pending and `u-grid-save-error` fires. Resolved with
   * `GridDataChanges` (e.g. new rows with the keys the server created): the
   * grid applies those instead of the ones it computed. Only during the
   * event dispatch (`InvalidStateError` afterwards); several calls wait for
   * all, and the first promise that resolves with an object wins.
   */
  waitUntil(promise: Promise<void | GridDataChanges<TItem>>): void;
  /** `user` or `api`. */
  readonly source: GridChangeSource;
}

/** `detail` of `u-grid-save`. */
export interface GridSaveEventDetail<TItem = any> {
  /** The saved changes. */
  readonly changes: readonly GridEditChange<TItem>[];
  /** With `items`: the new array the grid now shows (also returned by `grid.items`) — keep it in your state. `null` with `dataSource`. */
  readonly items: TItem[] | null;
  /** `user` or `api`. */
  readonly source: GridChangeSource;
}

/** `detail` of `u-grid-save-error`. */
export interface GridSaveErrorEventDetail<TItem = any> {
  /** The changes that were not saved (still pending). */
  readonly changes: readonly GridEditChange<TItem>[];
  /** What the `waitUntil` promise rejected with. */
  readonly error: unknown;
  /** `user` or `api`. */
  readonly source: GridChangeSource;
}

/** `detail` of `u-grid-edit-cancel`. */
export interface GridEditCancelEventDetail<TItem = any> {
  /** The discarded changes. */
  readonly changes: readonly GridEditChange<TItem>[];
  /** `user` (Esc, Cancel, Discard changes) or `api` (`discardChanges`, `items` replaced without the rows). */
  readonly source: GridChangeSource;
}
export type { GridColumnResizeEventDetail, GridResizeMode } from './features/resize.js';
export { setGridLanguage, setGridTranslation, gridLanguageContext, type GridI18n, type GridI18nInput } from './grid-i18n.js';

/** O que o Ctrl+C escreve, antes do `u-grid-copying`. */
interface CopyContent {
  detail: Omit<GridCopyEventDetail, 'clipboardData'>;
  announcement: string;
}

/** Largura (px) de cada coluna de recuo de grupo; igual ao `--_group-column-width`. */
const GROUP_COLUMN_WIDTH = 32;

/** Largura (px) da coluna de caixas de seleção; igual ao `--_selection-column-width`. */
const SELECTION_COLUMN_WIDTH = 48;

/** Largura (px) da coluna de expansão do master-detail; igual ao `--_detail-toggle-width`. */
const DETAIL_TOGGLE_WIDTH = 40;

/** Coluna de caixas de seleção entre as navegáveis (não é `GridColumnDef`). */
const SELECTION_COLUMN = 'selection' as const;

/** Coluna de expansão do master-detail entre as navegáveis. */
const DETAIL_TOGGLE_COLUMN = 'detail-toggle' as const;

/** Editor aberto (frente 09): uma célula ou, no modo linha, a linha inteira. */
interface OpenEditor {
  rowKey: unknown;
  /** Coluna do editor (no modo linha, a focada). */
  column: GridColumnDef | null;
  wholeRow: boolean;
  /** Valores digitados ainda não confirmados, por coluna. */
  readonly drafts: Map<GridColumnDef, unknown>;
  /** Texto cru dos editores embutidos (o que o usuário digitou). */
  readonly texts: Map<GridColumnDef, string>;
  /** A linha pendente antes de abrir (Esc volta a ela; `null` = não havia). */
  snapshot: EditSnapshot | null;
  /** Depois do render: levar o foco ao editor. */
  focus: boolean;
  /** "Adicionar linha" que abriu a linha nova (Esc devolve o foco a ele). */
  returnFocus: HTMLElement | null;
  /** Identidade desta abertura (dependência do `editorRenderer`). */
  readonly session: object;
  /** Muda a cada tecla: uma confirmação esperando validação antiga é descartada. */
  seq: number;
}

interface EditSnapshot {
  type: PendingRow['type'];
  removedFrom: PendingRow['removedFrom'];
  data: Record<string, unknown>;
  modified: Set<GridColumnDef>;
  unparsed: Map<GridColumnDef, UnparsedValue>;
  errors: Map<GridColumnDef, string>;
  rowError: string | undefined;
}

/** Onde uma linha nova aparece: antes da linha que estava no topo da tela. */
interface AddedAnchor {
  seq: number;
  /** Chave da linha de dados do topo. */
  anchorKey: unknown;
  /** Chave da linha de grupo do topo. */
  anchorRowKey: string | undefined;
  /** Índice quando a âncora sumiu. */
  fallback: number;
}

/** Estado de edição de uma linha renderizada. */
interface RowEditState {
  pending: PendingRow | undefined;
  rowKey: unknown;
  /** `aria-readonly` nas células não editáveis (há o que editar no grid). */
  readonlyMarks: boolean;
}

/** Conteúdo interativo dentro da célula: o clique nele não abre o editor. */
const TABBABLE_IN_CELL = 'a[href], button, input, select, textarea, [contenteditable], [tabindex]';

/** Ids únicos (no documento) das mensagens de editores do light DOM. */
let lightMessageCount = 0;

/** Depois disto salvando, "Salvando…" aparece e é anunciado. */
const SLOW_SAVE_DELAY = 1000;

const isPromiseLike = <T>(value: T | Promise<T>): value is Promise<T> =>
  !!value && typeof (value as Promise<T>).then === 'function';

const snapshotOf = (pending: PendingRow): EditSnapshot => ({
  type: pending.type,
  removedFrom: pending.removedFrom,
  data: copyData(pending.data),
  modified: new Set(pending.modified),
  unparsed: new Map(pending.unparsed),
  errors: new Map(pending.errors),
  rowError: pending.rowError,
});

/** Volta a linha pendente ao estado guardado (`null` = não havia: sai). */
const restoreSnapshot = (store: EditStore, pending: PendingRow, snapshot: EditSnapshot | null): void => {
  if (!snapshot) {
    store.delete(pending.rowKey);
    return;
  }

  pending.type = snapshot.type;
  pending.removedFrom = snapshot.removedFrom;
  pending.data = copyData(snapshot.data);
  pending.modified.clear();
  snapshot.modified.forEach(column => pending.modified.add(column));
  pending.unparsed.clear();
  snapshot.unparsed.forEach((value, column) => pending.unparsed.set(column, value));
  pending.errors.clear();
  snapshot.errors.forEach((message, column) => pending.errors.set(column, message));
  pending.errorRules.clear();
  pending.rowError = snapshot.rowError;
  store.touch(pending);
};

/** Tira `path` de `data` (e os objetos que ficaram vazios). */
const deletePath = (data: Record<string, unknown>, path: string): void => {
  const keys = path.split('.');
  const parents: Record<string, unknown>[] = [];
  let target: Record<string, unknown> | undefined = data;

  for (const key of keys.slice(0, -1)) {
    parents.push(target);
    const next: unknown = target[key];

    if (!next || typeof next !== 'object') {
      return;
    }

    target = next as Record<string, unknown>;
  }

  delete target[keys[keys.length - 1]];

  for (let index = parents.length - 1; index >= 0; index--) {
    const child = parents[index][keys[index]] as Record<string, unknown>;

    if (Object.keys(child).length) {
      break;
    }

    delete parents[index][keys[index]];
  }
};

/** Lote, Esc: só a célula volta ao que era ao abrir o editor. */
const restoreCell = (store: EditStore, pending: PendingRow, column: GridColumnDef, snapshot: EditSnapshot | null): void => {
  if (column.valueSetter || !column.path) {
    restoreSnapshot(store, pending, snapshot ?? { ...snapshotOf(pending), data: {}, modified: new Set(), unparsed: new Map(), errors: new Map() });
    store.prune(pending);
    return;
  }

  if (snapshot?.modified.has(column)) {
    setValueByPath(pending.data, column.path, getValueByPath(snapshot.data, column.path));
  } else {
    deletePath(pending.data, column.path);
    pending.modified.delete(column);
  }

  const unparsed = snapshot?.unparsed.get(column);
  const error = snapshot?.errors.get(column);

  if (unparsed) {
    pending.unparsed.set(column, unparsed);
  } else {
    pending.unparsed.delete(column);
  }

  if (error) {
    pending.errors.set(column, error);
  } else {
    pending.errors.delete(column);
  }

  store.touch(pending);
  store.prune(pending);
};

/** Mesmo valor para a edição (datas pelo instante). */
const sameEditValue = (a: unknown, b: unknown): boolean =>
  Object.is(a, b)
  || (a instanceof Date && b instanceof Date && a.getTime() === b.getTime())
  || ((a === null || a === undefined || a === '') && (b === null || b === undefined || b === ''));

/** Coluna dos botões da linha (editar, excluir), a última das navegáveis (frente 09). */
const COMMAND_COLUMN = 'command' as const;

type NavColumn = GridColumnDef | typeof SELECTION_COLUMN | typeof DETAIL_TOGGLE_COLUMN | typeof COMMAND_COLUMN;

/** Coluna de dados (ou `null` nas colunas do grid: caixas, expansão). */
const dataColumnOf = (column: NavColumn | undefined): GridColumnDef | null =>
  typeof column === 'object' ? column : null;

const NO_POSITIONS = new Int32Array(0);

// Ícone Material Symbols (Apache 2.0): add.
const ADD_PATH = 'M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z';

// Ícone Material Symbols (Apache 2.0): chevron_right.
const CHEVRON_PATH = 'M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z';

/** Célula ativa como o hospedeiro a vê (eventos). */
interface PublicFocus {
  rowKey: unknown;
  column: GridColumnDef | null;
  cellType: GridCellType;
}

/**
 * `detail` of `u-grid-column-visibility-change`: one event per column whose
 * own visibility changed (a band first, then each column it shows). A band
 * that disappears because none of its columns is visible fires nothing.
 */
export interface GridColumnVisibilityChangeEventDetail {
  /** The column (or band) shown or hidden. */
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

/** `detail` of `u-grid-column-reorder`. Positions among the column's siblings (same `band`, or the top level) that are not grouped; hidden ones count. */
export interface GridColumnReorderEventDetail {
  /** The moved column (a leaf column or a band). */
  column: GridColumnDef;
  /** Band that contains the column; `null` at the top level. */
  band: GridColumnDef | null;
  /** New position among the column's siblings (same band, or top level) that are not grouped; hidden ones count. */
  index: number;
  /** Position before the move, among the same siblings. */
  previousIndex: number;
  /** @deprecated Use `previousIndex`. */
  fromIndex: number;
  /** @deprecated Use `index`. */
  toIndex: number;
}

/** Espera depois do último render antes de pedir os blocos (rolagem rápida pede só onde parou). */
const FLUSH_DELAY = 30;

/** Carga mais curta que isto não é anunciada (não fala a cada bloco rápido). */
const LOADING_ANNOUNCE_DELAY = 300;

/** Contexto da consulta remota: colunas de grupo e posição de cada resumo do grid na resposta (`-1` = não remoto). */
interface RemoteContext {
  groupColumns: GridColumnDef[];
  totalSummaryMap: number[];
  groupSummaryMap: number[];
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
/**
 * Região `aria-live`: um texto igual ao anterior não muda o DOM e não é lido
 * de novo (ex.: a mesma contagem após outro filtro). Alterna um espaço
 * inquebrável no fim para forçar a releitura (spec 17).
 */
const withRepeatMark = (text: string, previous: string): string =>
  text && previous.replace(/\u00A0$/, '') === text && !previous.endsWith('\u00A0') ? `${text}\u00A0` : text;

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
  /** Índice entre as navegáveis (0-based; `aria-colindex` - 1), também com colunas fora do DOM. */
  col: number;
  /** Largura (px) da espaçadora antes desta coluna: colunas fora do DOM (virtualização, frente 13). */
  gapBefore: number;
}

/** Virtualização de colunas: índices (nas visíveis) que entram no DOM e espaçadora antes de cada um. */
interface ColumnPlan {
  kept: Set<number>;
  gaps: Map<number, number>;
}

/** Ordenação do cabeçalho de um render (prioridades só com mais de uma coluna). */
interface HeaderSorting {
  rowSorting: GridSort[];
  showIndex: boolean;
}

/** Chave de uma célula do cabeçalho (virtualização: segue a coluna, não a posição). */
const headerKeyOf = (header: HeaderCellLayout<NavColumn>): string | number =>
  header.column === null ? `gap-${header.start}` : typeof header.column === 'object' ? columnIdOf(header.column) : header.column;

/** Prefixo comum de duas cadeias de bandas. */
const commonPrefix = <T>(a: readonly T[], b: readonly T[]): T[] => {
  const result: T[] = [];

  for (let index = 0; index < Math.min(a.length, b.length) && a[index] === b[index]; index++) {
    result.push(a[index]);
  }

  return result;
};

/** `columnRenderingMode="auto"`: virtual acima deste número de colunas folha definidas. */
const VIRTUAL_COLUMNS_THRESHOLD = 50;

/** Largura de coluna sem `width` na virtualização de colunas. */
const DEFAULT_VIRTUAL_COLUMN_WIDTH = 150;

/** Antes de medir (SSR, 1º render): largura suposta da área visível. */
const DEFAULT_VIEWPORT_WIDTH = 1920;

/**
 * Folga da janela horizontal de cada lado (px): uma coluna a mais para o
 * passo da roda (120 px). Folga maior põe mais células em toda linha e
 * encarece cada render de rolagem (medido no perfil fraco, spec 16).
 */
const COLUMN_OVERSCAN = 160;

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

// Ícones Material Symbols (Apache 2.0): primeira/anterior/próxima/última página.
const FIRST_PAGE_PATH = 'M240-240v-480h80v480h-80Zm440 0L440-480l240-240 56 56-184 184 184 184-56 56Z';
const PREVIOUS_PAGE_PATH = 'M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z';
const NEXT_PAGE_PATH = 'M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z';
const LAST_PAGE_PATH = 'm280-240-56-56 184-184-184-184 56-56 240 240-240 240Zm360 0v-480h80v480h-80Z';

// Ícones Material Symbols (Apache 2.0): check e remove (estado misto).
const CHECK_PATH = 'M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z';
const MIXED_PATH = 'M200-440v-80h560v80H200Z';

/** Ações do menu do cabeçalho das colunas (spec 17, A1). */
type ColumnHeaderMenuAction = 'groupColumn' | 'moveLeft' | 'moveRight' | 'autoSizeColumn' | 'increaseColumnWidth' | 'decreaseColumnWidth';

/** Id da coluna no estado (frente 11): `name`, senão `path`. */
const columnNameOf = (column: GridColumnDef): string | undefined =>
  (typeof column.name === 'string' && column.name) || (typeof column.path === 'string' && column.path) || undefined;

/** Chave de linha que cabe no estado (JSON): texto ou número finito. */
const isStateKey = (key: unknown): key is GridRowKey =>
  typeof key === 'string' || (typeof key === 'number' && Number.isFinite(key));

/** Cópia da expressão de filtro só com valores JSON (datas em ISO). */
const jsonFilterCopy = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(jsonFilterCopy)
    : value instanceof Date ? (Number.isNaN(value.getTime()) ? null : value.toISOString()) : value;

/** Eventos de mudança cujo `source` diz a origem de uma mudança do estado (os de coluna são só do usuário). */
const STATE_EVENTS = new Set([
  'u-grid-sort-change',
  'u-grid-group-change',
  'u-grid-group-expansion-change',
  'u-grid-filter-change',
  'u-grid-column-resize',
  'u-grid-column-visibility-change',
  'u-grid-column-fixed-change',
  'u-grid-column-reorder',
  'u-grid-selection-change',
  'u-grid-page-change',
  'u-grid-row-expansion-change',
]);

/** Padrão de `stateChangeDelay` (ms). */
const STATE_CHANGE_DELAY = 500;

/** Valores do hospedeiro no 1º connect: o "inicial" de `setState`/`resetState`. */
interface InitialHostState {
  filterValue: GridFilterExpression | null;
  searchText: string;
  pageIndex: number;
  pageSize: number;
  selectedKeys: readonly unknown[];
}

/** Linha de dados ou esqueleto (não grupo, rodapé de grupo nem detalhe). */
const isDataRowLike = (row: Row): row is DataRow => !row.isGroup && !row.isFooter && !row.isDetail;

/** Linha de dados carregada (não grupo, rodapé de grupo, detalhe nem esqueleto). */
const isDataRow = (row: Row | undefined): row is DataRow => !!row && !row.isGroup && !row.isFooter && !row.isDetail && !row.skeleton;

/** Índice da linha de detalhe da chave ou, recolhido, da linha mestre (`keyOf` ausente = a chave é o item). */
const detailOrMaster = (rows: Rows, key: unknown, keyOf?: (item: unknown) => unknown): number => {
  const detail = rows.indexOfDetailKey(key, keyOf);
  return detail >= 0 ? detail : rows.indexOfDataKey(key, keyOf);
};

/** Linha de detalhe (master-detail). */
const isDetailRow = (row: Row | undefined): row is DetailRow => !!row && !!row.isDetail;

/** Identidade estável da linha ativa: item (dados), detalhe do item, chave (grupo, rodapé de grupo) ou o rodapé de totais. */
type ActiveRef = { key: unknown } | { detailOf: unknown } | { rowKey: string } | { totals: true };

/**
 * Data grid with row virtualization, grouping, sorting, filtering (filter
 * row, header filter, search panel), column resizing, fixing, hiding and
 * reordering, i18n and SSR.
 *
 * Name the grid with `aria-label` or `aria-labelledby` on `<u-grid>`: they
 * name the inner `role="grid"`/`"treegrid"` table. `aria-labelledby` ids are
 * resolved in the grid's root (document or enclosing shadow root); their
 * text is copied and kept in sync.
 *
 * @summary Data grid web component.
 *
 * @slot - `<u-grid-column>` elements (declarative columns).
 *
 * @fires {CustomEvent<GridSortEventDetail>} u-grid-sorting - Before the sorting changes (user or API). Cancelable.
 * @fires {CustomEvent<GridSortEventDetail>} u-grid-sort-change - After the sorting changed (user or API).
 * @fires {CustomEvent<GridGroupEventDetail>} u-grid-group-change - After the grouping changed (user — drag, Ctrl+G, group panel or column header menu — or API).
 * @fires {CustomEvent<GridGroupExpansionChangeEventDetail>} u-grid-group-expansion-change - After groups were expanded or collapsed (user or API).
 * @fires {CustomEvent<GridFilterEventDetail>} u-grid-filter-change - After the user filtered (filter row, header filter, search panel) or `clearFilter()` ran.
 * Setting `filterValue`/`searchText` does not fire it.
 * @fires {CustomEvent<GridColumnResizeEventDetail>} u-grid-column-resize - The user finished resizing a column (pointer release, keyboard, double-click auto-size or the column header menu).
 * @fires {CustomEvent<GridColumnVisibilityChangeEventDetail>} u-grid-column-visibility-change - The user showed or hid a column (or a band) in the column chooser (one event per own change).
 * @fires {CustomEvent<GridColumnFixedChangeEventDetail>} u-grid-column-fixed-change - The user fixed or unfixed a column (or a top-level band) in the column chooser.
 * @fires {CustomEvent<GridColumnReorderEventDetail>} u-grid-column-reorder - The user moved a column or a band (drag and drop, Alt+Shift+←/→ on the header or the column header menu).
 * @fires {CustomEvent<GridSelectionChangeEventDetail>} u-grid-selection-change - The selection changed: user gesture, selection method, `multiple` → `single` (not the `selectedKeys` setter).
 * @fires {CustomEvent<GridLoadingEventDetail>} u-grid-loading - Before each call to `dataSource.load` (`dataSource` only). Cancelable: the call is skipped and the rows shown stay.
 * @fires {CustomEvent<GridLoadEventDetail>} u-grid-load - A `dataSource.load` call resolved (not fired for aborted calls).
 * @fires {CustomEvent<GridLoadErrorEventDetail>} u-grid-load-error - A `dataSource.load` call rejected (not fired for aborted calls); the grid shows the error bar with "Retry".
 * @fires {CustomEvent<GridPageChangeEventDetail>} u-grid-page-change - The page or page size changed: pager, PageUp/PageDown, a filter gesture (back to the first page)
 * or a clamp after the rows shrank (`source` of the change that caused it). Not the `pageIndex`/`pageSize` setters.
 * @fires {CustomEvent<GridCopyEventDetail>} u-grid-copying - Before Ctrl/Cmd+C writes the selected rows (or the focused cell) to the clipboard. Cancelable.
 * @fires {CustomEvent<GridRowExpansionChangeEventDetail>} u-grid-row-expansion-change - A detail row was expanded or collapsed (toggle, keyboard, `expandRow`/`collapseRow`; not `autoExpandRows`).
 * @fires {CustomEvent<GridStateChangeEventDetail>} u-grid-state-change - `state-change-delay` ms after the last change of the user state (`getState`): user gesture,
 * method, property or `setState` — once per burst, only if the state really changed — and after a restore from `stateStorage` (`sources: ['storage']`, not saved back).
 * @fires {CustomEvent<GridFocusChangeEventDetail>} u-grid-focus-change - The active cell changed: keyboard, click, `focusCell` (not the `focusedRowKey` setter nor a relocation).
 * @fires {CustomEvent<GridEditStartingEventDetail>} u-grid-edit-starting - Before a cell editor (or a row, `editMode="row"`) opens (user or API). Cancelable.
 * @fires {CustomEvent<GridRowAddingEventDetail>} u-grid-row-adding - Before a new row is added (Add row button or `addRow`): set its initial values in `detail.data`. Cancelable.
 * @fires {CustomEvent<GridRowRemovingEventDetail>} u-grid-row-removing - Before a row is deleted or marked for removal (Delete button, before the confirmation, or `removeRow`). Cancelable.
 * @fires {CustomEvent<GridRowValidatingEventDetail>} u-grid-row-validating - Before saving, for each added or edited row. Cancelable: `preventDefault()`/`setError` marks the row invalid.
 * @fires {CustomEvent<GridSavingEventDetail>} u-grid-saving - Before saving the pending changes: save on the server with `waitUntil(promise)`. Cancelable: the changes stay pending.
 * @fires {CustomEvent<GridSaveEventDetail>} u-grid-save - The changes were saved and applied (`items` copy or `dataSource.applyChanges`).
 * @fires {CustomEvent<GridSaveErrorEventDetail>} u-grid-save-error - The `waitUntil` promise rejected; the changes stay pending.
 * @fires {CustomEvent<GridEditCancelEventDetail>} u-grid-edit-cancel - Pending changes were discarded (Esc, Cancel, Discard changes, `discardChanges`).
 *
 * @cssprop --u-grid-background-color - Grid background.
 * @cssprop --u-grid-color - Text color of the grid. Default: on-surface token (`rgb(29, 27, 32)`).
 * @cssprop --u-grid-striped-background-color - Background of even rows when `striped`.
 * @cssprop --u-grid-header-background-color - Header and sticky cells background.
 * @cssprop --u-grid-toolbar-height - Minimum height of the bar above the table (group panel, search, chooser button); it grows when its content wraps. Default `56px`.
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
 * @cssprop --u-grid-selected-row-indicator-color - Bar at the start of selected rows (selection is not shown by color alone). Default: primary color.
 * @cssprop --u-grid-selected-row-indicator-width - Thickness of that bar; `0` hides it. Default `3px`.
 * @cssprop --u-grid-sorted-header-color - Text color of sorted column headers.
 * @cssprop --u-grid-sort-indicator-size - Size of the sort arrow. Default `1.125em`.
 * @cssprop --u-grid-drop-indicator-color - Drag-and-drop drop indicator color.
 * @cssprop --u-grid-drop-indicator-width - Drop indicator thickness. Default `3px`.
 * @cssprop --u-grid-resize-handle-width - Width of the column resize hit area, also reserved at the end of header cells when `column-resizing` is on. Default `24px` (WCAG 2.5.8).
 * @cssprop --u-grid-resize-handle-color - Color of the resize bar shown on hover/focus. Default: `--u-grid-group-toggle-color`.
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
 * @cssprop --u-grid-load-panel-background-color - Background of the load panel.
 * @cssprop --u-grid-skeleton-row-color - Color of the placeholders in rows still loading.
 * @cssprop --u-grid-pager-height - Minimum height of the pager. Default `56px`.
 * @cssprop --u-grid-modified-cell-background-color - Background of edited, unsaved cells (`editMode="batch"`). Default: primary color at 10%.
 * @cssprop --u-grid-modified-cell-indicator-color - Corner mark of edited, unsaved cells (not shown by color alone). Default: primary color.
 * @cssprop --u-grid-invalid-cell-color - Border and message accent of cells with a validation error. Default: error token (`rgb(179, 38, 30)`).
 * @cssprop --u-grid-added-row-background-color - Background of new, unsaved rows. Default: primary color at 6%.
 * @cssprop --u-grid-removed-row-opacity - Opacity of rows marked for removal (their text is also struck through). Default `0.7`.
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
 * @csspart header-cell - Column header cells (`<th>`), bands included.
 * @csspart band-header-cell - Band header cells (multi-level headers); they also match `header-cell`.
 * @csspart sort-indicator - The sort arrow (and priority number) in headers and group chips.
 * @csspart group-chip - Group chips in the group panel.
 * @csspart column-chooser - The column chooser popover.
 * @csspart summary-row - Rows with summaries: the totals footer and group footers.
 * @csspart total-row - The totals footer row.
 * @csspart group-footer-row - Group footer rows (summaries with `display: 'footer'`).
 * @csspart summary-cell - Cells with summaries (footers and `display: 'column'` in group rows).
 * @csspart group-count - Count and inline summaries in a group row (`"(3, Sum of Population: 1,234)"`).
 * @csspart group-panel-menu - The group panel context menu.
 * @csspart column-header-menu - The column header context menu.
 * @csspart column-header-menu-button - The "⋮" button that opens the column header menu.
 * @csspart filter-row - The filter row (`<tr>`) below the column headers.
 * @csspart filter-cell - Cells of the filter row.
 * @csspart filter-editor - Editors (inputs and selects) of the filter row.
 * @csspart filter-operation-button - The operation button of a filter row cell.
 * @csspart search-input - The search panel input.
 * @csspart header-filter-button - The funnel button in a column header (`header-filter`).
 * @csspart header-filter - The header filter popover.
 * @csspart detail-toggle-cell - Cells and header of the master-detail toggle column.
 * @csspart detail-toggle-button - The expand/collapse button of a master row.
 * @csspart detail-row - Detail rows (with `row`).
 * @csspart detail-cell - The full-width cell of a detail row.
 * @csspart expanded - Master rows whose detail is expanded (with `row`).
 * @csspart pager - The pager (`<nav>`) below the table (`paging`).
 * @csspart pager-button - Pager buttons (first, previous, page numbers, next, last).
 * @csspart page-size-select - The page size `<select>` of the pager.
 * @csspart page-info - The "Page x of y (n items)" text of the pager.
 * @csspart load-panel - The load panel shown while a data source loads.
 * @csspart skeleton-row - Rows of a remote source not loaded yet (with `row`).
 * @csspart error-row - The bar shown when the data source failed.
 * @csspart retry-button - The "Retry" button of the error bar.
 * @csspart search-highlight - Search matches (`<mark>`) in native cells (not in `renderer` cells).
 * @csspart modified - Edited, unsaved data cells (with `cell`).
 * @csspart invalid - Data cells with a validation error (with `cell`).
 * @csspart added - New, unsaved rows (with `row`).
 * @csspart removed - Rows marked for removal (with `row`, `editMode="batch"`).
 * @csspart cell-editor - The built-in cell editors (`<input>`).
 * @csspart validation-message - The validation error shown below an invalid cell.
 * @csspart command-cell - Cells and header of the row buttons column (edit, delete).
 * @csspart command-button - The row buttons (edit, save, cancel, delete, restore).
 * @csspart add-row-button - The toolbar "Add row" button.
 * @csspart save-button - The toolbar "Save changes" button (`editMode="batch"`).
 * @csspart discard-button - The toolbar "Discard changes" button (`editMode="batch"`).
 * @csspart remove-dialog - The delete confirmation dialog.
 */
@customElement('u-grid')
export class DataGrid extends LitElement {
  static override styles = [styles];

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, ...Object.keys(LEGACY_ATTRIBUTES), ...HOST_LABEL_ATTRIBUTES];
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

  // ------------------------------------------------------------- templates

  /**
   * Builds the empty state (property only) shown when there are no rows to
   * show; `ctx.filtered` tells a filter/search hid every item. Without it,
   * the translated "No data" text.
   */
  @property({ attribute: false }) noDataRenderer: GridNoDataRenderer | null = null;

  /**
   * Builds the detail of a row (master-detail; property only). With it, a
   * toggle column appears at the start and each expanded row is followed by
   * a full-width detail row (variable height). Returning `null` renders an
   * empty detail row.
   */
  @property({ attribute: false }) detailRenderer: GridDetailRenderer | null = null;

  /**
   * Detail rows start expanded. INITIAL default: afterwards expansion is grid
   * state (`expandRow`, `collapseRow`); changing it resets that state (no
   * event).
   */
  @property({ type: Boolean, converter: booleanAttribute(false), attribute: 'auto-expand-rows' }) autoExpandRows = false;

  /**
   * Chaves de linha cuja expansão difere do padrão (`autoExpandRows`). Retém
   * a chave até voltar ao padrão (como `selectedKeys`).
   */
  readonly #rowExpansion = new VersionedSet<unknown>();
  /** Altura medida do detalhe por item (objetos: fraca; primitivos: limitada). */
  readonly #detailSizes = new WeakMap<object, number>();
  readonly #primitiveDetailSizes = new LruCache<unknown, number>(256);
  /** Altura suposta de um detalhe ainda não medido: a última medida. */
  #detailEstimate = 0;
  /** Observa as linhas de detalhe renderizadas (o conteúdo cresce depois: grid aninhado, imagens). */
  #detailObserver: ResizeObserver | undefined;
  readonly #observedDetails = new Set<Element>();

  // ------------------------------------------------- chave e fonte de dados

  #keyExpr: GridKeyExpr | null = null;
  /** Chave de linha: `keyExpr` ou o próprio item. */
  #keyOf: (item: unknown) => unknown = item => item;
  /** Chave pelo `keyExpr` (sem as linhas novas da edição). */
  #baseKeyOf: (item: unknown) => unknown = item => item;
  /** Chave vazia ou repetida nas linhas renderizadas já foi avisada. */
  #warnedKeys = false;

  /**
   * Row key: a property `path` (dots allowed, attribute `key-expr`) or a
   * function returning the key of an item. Selection (`selectedKeys`), focus
   * (`focusedRowKey`, `focusCell`) and events use it; without it the key is
   * the item object itself. With a key, replacing `items` with new objects
   * keeps the selection, the focus and the group expansion. Changing it
   * converts the selection to the new keys (keys whose row is gone are
   * dropped, firing `u-grid-selection-change` with `source: 'api'`).
   * @default null
   */
  @property({ attribute: 'key-expr' })
  get keyExpr(): GridKeyExpr | null {
    return this.#keyExpr;
  }

  set keyExpr(value: GridKeyExpr | null | undefined) {
    const next = value || null;

    if (next === this.#keyExpr) {
      return;
    }

    const previousKeyOf = this.#keyOf;
    const hadRendered = this.hasUpdated;

    this.#keyExpr = next;
    this.#baseKeyOf = keyReader(next);
    this.#syncKeyOf();
    this.#warnedKeys = false;
    this.#rowsDirty = true;

    if (this.#activeRef && 'key' in this.#activeRef) {
      const item = this.#loadedItemByKey(this.#activeRef.key, previousKeyOf);
      this.#activeRef = item === undefined ? null : { key: this.#keyOf(item) };
    }

    if (this.#selection.size) {
      this.#convertSelection(previousKeyOf, hadRendered);
    }

    this.requestUpdate();
  }

  /** Texto da chave da linha renderizada (`keyed`), único por linha. */
  readonly #rowKeyText = (item: unknown): string =>
    this.#keyExpr ? keyText(this.#keyOf(item)) : rowKeyOf(item);

  #dataSource: GridDataSource | null = null;

  /**
   * Data source (property only): the grid calls `load(options, signal)` and
   * shows what it returns — with `remoteOperations`, the server filters,
   * sorts, groups, summarizes and pages. The grid never builds URLs or
   * queries: validate the options on the server. Alternative to `items`.
   * @default null
   */
  @property({ attribute: false })
  get dataSource(): GridDataSource | null {
    return this.#dataSource;
  }

  set dataSource(value: GridDataSource | null | undefined) {
    const next = value && typeof value.load === 'function' ? value : null;

    if (value && !next) {
      console.error('<u-grid>: "dataSource" needs a load(options, signal) method; ignored.');
    }

    if (next === this.#dataSource) {
      return;
    }

    if (this.#edits.size || this.#editor) {
      // Outra fonte: as mudanças pendentes eram da anterior.
      this.#discard('api');
    }

    this.#dataSource = next;
    this.#loader.dispose();
    this.#queryKey = undefined;
    this.#loadedGeneration = undefined;
    this.#remoteGeneration = undefined;

    if (next && this.#hostItems.length) {
      console.error('<u-grid>: set either "items" or "dataSource", not both; "dataSource" is used.');
    }

    this.#setItems(next ? [] : this.#hostItems);
    this.requestUpdate();
  }

  /**
   * What the server does with `dataSource` (attribute `remote-operations`:
   * all or nothing). `false` (default): one call loads every row and the
   * grid filters, sorts, groups, summarizes and pages. `true`: everything on
   * the server. An object picks operations; remote `paging` or `grouping`
   * also turn on remote `filtering`, `sorting` and `summary` (paging also
   * grouping), with a console warning. Remote operations use the column
   * `path` (not `valueGetter`, `comparator` nor `groupValueGetter`).
   */
  @property({ type: Boolean, converter: booleanAttribute(false), attribute: 'remote-operations' })
  remoteOperations: boolean | GridRemoteOperations = false;

  #remote: RemoteFlags = NO_REMOTE;
  #remoteSource: boolean | GridRemoteOperations | undefined;
  readonly #loader = new RemoteLoader({
    request: (options, signal) => this.#request(options, signal),
    changed: () => this.requestUpdate(),
  });

  /** Consulta pendente (calculada no render, pedida depois dele). */
  #pendingQuery: { query: LoaderQuery; hintRow: number } | undefined;
  #queryKey: string | undefined;
  /** `refresh()` força uma consulta nova mesmo igual. */
  #refreshCount = 0;
  /** Geração cujos dados estão em `#items` (carga única). */
  #loadedGeneration: unknown;
  /** Geração e versão das linhas remotas montadas. */
  #remoteGeneration: unknown;
  #remoteVersion = -1;
  #flushTimer: ReturnType<typeof setTimeout> | undefined;
  #loadingTimer: ReturnType<typeof setTimeout> | undefined;
  #loadingAnnounced = false;
  readonly #warnedColumns = new Set<string>();

  /** Fonte remota com linhas sob demanda (paginação ou agrupamento no servidor). */
  get #lazy(): boolean {
    return !!this.#dataSource && (this.#remote.paging || this.#remote.grouping);
  }

  // ------------------------------------------------------------- paginação

  /** Splits the rows into pages (group rows count) and shows the pager below the table. */
  @property({ type: Boolean, converter: booleanAttribute(false) }) paging = false;

  /** Rows per page; also the block size asked to a remote source in virtual and infinite scrolling. Default `20`. */
  @property({ type: Number, attribute: 'page-size' }) pageSize = 20;

  #pageIndex = 0;

  /**
   * Current page (0-based; with `paging`). The pager writes it; out-of-range
   * values are clamped. Setting it does not fire `u-grid-page-change`.
   * @default 0
   */
  @property({ type: Number, attribute: 'page-index' })
  get pageIndex(): number {
    return this.#pageIndex;
  }

  set pageIndex(value: number) {
    const old = this.#pageIndex;
    this.#pageIndex = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
    this.requestUpdate('pageIndex', old);
  }

  /**
   * Page sizes offered by the pager (attribute: a list, `"10, 20, 50"`);
   * empty hides the selector. Default `[10, 20, 50, 100]`.
   */
  @property({ type: Array, attribute: 'page-size-options', converter: numberListAttribute([10, 20, 50, 100]) })
  pageSizeOptions: readonly number[] = [10, 20, 50, 100];

  /**
   * `virtual` (default): every row is in the scroll range and a remote
   * source loads the visible blocks. `infinite`: the next block loads when
   * the end is reached (remote paging only; with `paging` the pager wins).
   */
  @property({ attribute: 'scroll-mode' }) scrollMode: GridScrollMode = 'virtual';

  /**
   * Origem da última mudança que pode encolher as linhas (dados, filtro,
   * agrupamento, expansão): a página limitada por ela dispara
   * `u-grid-page-change` com essa origem. Sem causa (setters de página), o
   * limite é silencioso. Consumida a cada render.
   */
  #pageCause: GridChangeSource | undefined;
  /** Linhas inteiras (sem a página); `#rows` é a página com `paging`. */
  #allRows: Rows = new RowList(rowKeyOf);
  /** Linhas de dados conhecidas (local: filtradas; remoto: total do servidor; `-1` desconhecido). */
  #totalCount = 0;

  /** `items` do hospedeiro (o getter devolve este; com `dataSource` os dados vêm de lá). */
  #hostItems: readonly any[] = [];

  /**
   * Row items (property only). The grid never mutates this array or its
   * items. Use either `items` or `dataSource` (both = console error, the
   * data source wins).
   */
  @property({ attribute: false })
  get items(): any[] {
    return this.#hostItems as any[];
  }

  set items(items: readonly any[] | null | undefined) {
    this.#hostItems = items ?? [];

    if (this.#dataSource && this.#hostItems.length) {
      console.error('<u-grid>: set either "items" or "dataSource", not both; "dataSource" is used.');
    }

    if (!this.#dataSource) {
      this.#reconcileEdits(this.#hostItems);
      this.#setItems(this.#hostItems);
    }
  }

  /** Troca as linhas do pipeline local (`items` ou o que a fonte carregou de uma vez). */
  #setItems(items: readonly any[]): void {
    this.#pageCause ??= 'api';
    this.#items = items;
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
  #rows: Rows = new RowList(rowKeyOf);
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
  readonly #expansion = new VersionedMap<string, { expanded: boolean; level: number; path: GridGroupPath }>();
  /** Muda quando os padrões de expansão (`#levelExpansion`, `#allExpansion`) mudam. */
  #expansionDefaultsVersion = 0;
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
  /** Árvore das definições (bandas, frente 13); folhas em `leaves`. */
  #columnTree: ColumnTree<GridColumnDef> = buildColumnTree<GridColumnDef>([]);

  /** @internal */
  readonly _nativeColumnMap = new WeakMap<HTMLElement, GridColumnDef>();

  /**
   * Ordem atual (do usuário) das colunas comuns e de grupo — estado do grid.
   * As comuns ficam sempre em blocos: fixas no início, livres, fixas no fim.
   */
  /** @internal */
  @internalState() _groupColumns: GridColumnDef[] = [];
  /** @internal */
  @internalState() _regularColumns: GridColumnDef[] = [];

  /**
   * Colunas comuns visíveis, na ordem de exibição (recalculado a cada update).
   * @internal
   */
  _visibleColumns: GridColumnDef[] = [];

  // Estado do usuário por coluna — nunca escrito nos objetos do hospedeiro.
  readonly #userWidths = new VersionedMap<GridColumnDef, number>();
  readonly #userVisible = new VersionedMap<GridColumnDef, boolean>();
  readonly #userFixed = new VersionedMap<GridColumnDef, GridColumnFixed>();
  /** Larguras de conteúdo medidas pelo `column-auto-width`. */
  readonly #autoWidths = new Map<GridColumnDef, number>();
  /** Largura renderizada (px) de cada coluna visível, medida após o layout. */
  readonly #renderedWidths = new Map<GridColumnDef, number>();
  /** Virtualização de colunas (frente 13): somas das larguras das roláveis, janela e rolagem. */
  #freeOffsets: number[] | undefined;
  #fixedArea = 0;
  #columnWindow: ColumnWindow = { first: 0, last: -1 };
  #scrollStart = 0;
  #viewportWidth = 0;
  /** Espaçadora depois da última coluna renderizada. */
  #trailingGap = 0;
  /** Níveis do cabeçalho (0 sem cabeçalho) e células por (nível, coluna navegável). */
  #headerLevels = 1;
  #headerGrid: HeaderCellLayout<NavColumn>[][] = [];
  #headerGridKey: { visible: GridColumnDef[]; tree: ColumnTree<GridColumnDef>; leading: string } | undefined;
  readonly #hostOptions = new Map<GridColumnDef, HostColumnOptions>();
  #layoutDirty = true;
  #autoWidthDirty = true;
  #warnedRenderingMode = false;

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
   * menu key on a group chip): ungroup, move the chip left/right (grouping
   * level), ungroup all, expand/collapse all groups. Default `true`;
   * `group-panel-menu="false"` disables it.
   */
  @property({ type: Boolean, converter: booleanAttribute(true), attribute: 'group-panel-menu' }) groupPanelMenu = true;

  /**
   * Context menu of the column headers (right-click, the "⋮" button, Shift+F10
   * or the context menu key on a header): group by the column, move it
   * left/right, auto-size or widen/narrow it. It is the single-pointer
   * alternative to dragging (WCAG 2.5.7): with `column-header-menu="false"`
   * the host must provide one. Only actions that apply to the column are
   * listed; without any, the browser menu is kept. Default `true`.
   */
  @property({ type: Boolean, converter: booleanAttribute(true), attribute: 'column-header-menu' }) columnHeaderMenu = true;
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

  /**
   * How columns are rendered: `virtual` keeps only the columns in view (plus
   * the fixed columns and the focused one) in the DOM, for very wide grids;
   * `standard` renders all; `auto` (default) is `virtual` with more than 50
   * leaf columns defined (visible, hidden or grouped). Under `virtual` a
   * column without `width` takes its auto-size width or `max(minWidth, 150)` px.
   */
  @property({ attribute: 'column-rendering-mode' }) columnRenderingMode: GridColumnRenderingMode = 'auto';

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

  /**
   * Ctrl/Cmd+C on a cell of the grid: `copy` (default) copies the selected
   * rows (or, without a selection, the focused cell) as tab separated text
   * and an HTML table; `none` leaves the clipboard alone. Text selected with
   * the mouse is copied natively.
   */
  @property({ attribute: 'clipboard-mode' }) clipboardMode: GridClipboardMode = 'copy';

  // ------------------------------------------------------------- edição

  /**
   * How rows are edited: `cell` (default; a committed cell is saved at once),
   * `row` (Edit/Save/Cancel buttons per row) or `batch` (changes stay pending
   * until "Save changes" or `saveChanges()`).
   */
  @property({ attribute: 'edit-mode' }) editMode: GridEditMode = 'cell';

  /**
   * Lets the user edit cells (columns with `editable`, by default those with
   * `path`). A function (property only) decides per row. The grid never
   * mutates the items: changes are delivered in `u-grid-saving`. With
   * `dataSource`, editing needs `keyExpr`.
   * @default false
   */
  @property({ type: Boolean, converter: booleanAttribute(false), attribute: 'allow-editing' })
  allowEditing: boolean | ((item: any) => boolean) = false;

  /** Shows the "Add row" button and allows `addRow()`. */
  @property({ type: Boolean, converter: booleanAttribute(false), attribute: 'allow-adding' }) allowAdding = false;

  /**
   * Shows the Delete button of each row and allows `removeRow()`. A function
   * (property only) decides per row.
   * @default false
   */
  @property({ type: Boolean, converter: booleanAttribute(false), attribute: 'allow-removing' })
  allowRemoving: boolean | ((item: any) => boolean) = false;

  /** Pointer gesture that opens a cell editor: `click` (default) or `dblclick`. Enter and F2 always open it. */
  @property({ attribute: 'edit-trigger' }) editTrigger: GridEditTrigger = 'click';

  /** Asks before deleting a row with the Delete button (not in `batch` mode, where removal is pending, nor with `removeRow()`). */
  @property({ type: Boolean, converter: booleanAttribute(true), attribute: 'confirm-remove' }) confirmRemove = true;

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

  /** Coluna de expansão do master-detail (antes da de caixas). */
  get #showDetailColumn(): boolean {
    return !!this.detailRenderer;
  }

  /** Colunas navegáveis do grid antes das colunas comuns (expansão, caixas). */
  get #leadingColumns(): number {
    return (this.#showDetailColumn ? 1 : 0) + (this.#showSelectionColumn ? 1 : 0);
  }

  /** Índice navegável (0-based) da coluna de caixas. */
  get #selectionCol(): number {
    return this.#showDetailColumn ? 1 : 0;
  }

  /** Deslocamento `sticky` da coluna de caixas. */
  get #selectionInset(): number {
    return this._groupColumns.length * GROUP_COLUMN_WIDTH + (this.#showDetailColumn ? DETAIL_TOGGLE_WIDTH : 0);
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
  /**
   * O foco do DOM estava dentro do grid antes do render (spec 17): se o render
   * remover o elemento focado (linha filtrada, chip desagrupado, coluna
   * ocultada), o foco vai à célula ativa realocada em vez de cair no `<body>`.
   */
  #hadFocusBeforeRender = false;
  /** Anúncio da largura depois de Alt+←/→ no cabeçalho (espera a sequência de teclas; solto no disconnect). */
  readonly #resizeAnnouncer = new Debouncer<'resize'>(this);
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

  /**
   * `aria-label`/`aria-labelledby` do hospedeiro nomeiam a tabela (o texto
   * dos alvos é copiado e observado: IDREF não atravessa o shadow root).
   */
  readonly #hostLabel = new HostLabel(this, () => this.requestUpdate());

  readonly #warnedDeprecations = new Set<string>();

  #deprecated(name: string, replacement: string): void {
    if (this.#warnedDeprecations.has(name)) {
      return;
    }

    this.#warnedDeprecations.add(name);
    console.warn(`<u-grid>: "${name}" is deprecated, use "${replacement}" instead.`);
  }

  override attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    if ((HOST_LABEL_ATTRIBUTES as readonly string[]).includes(name)) {
      this.#hostLabel.update();
    }

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

  /**
   * Idioma dos textos da interface (o da tradução usada; sem tradução, o
   * padrão). Vai no `lang` dos elementos com texto da i18n, para o leitor de
   * tela usar a voz certa quando difere da página (WCAG 3.1.2, spec 17).
   */
  get #textLanguage(): string {
    const language = this.#effectiveLanguage;
    const translation = resolveGridTranslation(language);

    return language && translation !== resolveGridTranslation(DEFAULT_GRID_LANGUAGE) ? language : DEFAULT_GRID_LANGUAGE;
  }

  /** Envolve conteúdo só com texto da i18n num `lang` próprio (`display: contents`). */
  #inTextLanguage(content: unknown): unknown {
    return content === nothing ? nothing : html`<div class="lang-scope" lang=${this.#textLanguage}>${content}</div>`;
  }

  // ------------------------------------------------- estado e persistência

  #stateStorage: 'local' | 'session' | GridStateStorage | null = null;
  #stateStorageKey = '';

  /**
   * Saves and restores the user state (see `getState`): `local` / `session`
   * (`localStorage` / `sessionStorage`, attribute `state-storage`, needs
   * `state-storage-key`) or an object with `load()` and `save()` (property
   * only). Read when the grid connects (and again when this or the key
   * changes), before the first render of data; while an asynchronous `load()`
   * runs the grid shows the load panel and no rows. Saved
   * `state-change-delay` ms after each change, and on disconnect or
   * `pagehide` when a save is pending. A `setState()` before connecting skips
   * the read. Unreadable or invalid saved states are ignored with a console
   * warning.
   * @default null
   */
  @property({ attribute: 'state-storage' })
  get stateStorage(): 'local' | 'session' | GridStateStorage | null {
    return this.#stateStorage;
  }

  set stateStorage(value: 'local' | 'session' | GridStateStorage | null | undefined) {
    const old = this.#stateStorage;
    this.#stateStorage = value ?? null;
    this.#storageChanged();
    this.requestUpdate('stateStorage', old);
  }

  /**
   * Key of the state in `localStorage` / `sessionStorage` (required by `state-storage="local|session"`).
   * @default ''
   */
  @property({ attribute: 'state-storage-key' })
  get stateStorageKey(): string {
    return this.#stateStorageKey;
  }

  set stateStorageKey(value: string | null | undefined) {
    const old = this.#stateStorageKey;
    this.#stateStorageKey = value ?? '';
    this.#storageChanged();
    this.requestUpdate('stateStorageKey', old);
  }

  /** Delay (ms) after the last change of the state before `u-grid-state-change` fires and the state is saved. Default `500`. */
  @property({ type: Number, attribute: 'state-change-delay' }) stateChangeDelay = 500;

  /** Estados a aplicar quando houver colunas (pedidos antes delas: `setState` cedo, storage). */
  #statesToApply: { state: GridState; partial: boolean; fromStorage: boolean }[] = [];
  /** Esperando o storage (assíncrono ou hidratação): render sem linhas, conteúdo oculto. */
  #stateWaiting = false;
  /** Já houve render com dados: daqui em diante nunca mais espera o storage. */
  #renderedData = false;
  /** De onde o estado foi lido por último (não relê ao reconectar). */
  #loadedFrom: unknown;
  /** Muda a cada leitura e a cada `setState`: leitura assíncrona velha não vale. */
  #loadGeneration = 0;
  /** `setState`/`resetState` antes do 1º connect: dispensa a leitura do storage. */
  #explicitState = false;
  #initial: InitialHostState | undefined;
  /** Identidades/versões de cada parte do estado no último render. */
  #stateSignature: unknown[] | undefined;
  /** Origens vistas nos eventos desde o último render. */
  readonly #recordedSources = new Set<GridStateChangeSource>();
  /** Origens da rajada em curso. */
  readonly #burstSources = new Set<GridStateChangeSource>();
  #stateTimer: ReturnType<typeof setTimeout> | undefined;
  /** JSON do último estado avisado/restaurado (rajada que volta ao mesmo estado não avisa). */
  #lastStateJson: string | undefined;
  #pageHideListening = false;
  readonly #warnedState = new Set<string>();
  /** O hospedeiro usa o estado (`getState`/`setState`/`resetState`). */
  #stateInUse = false;

  /**
   * The user state (a new object, JSON serializable): column order, width,
   * visibility, fixing, grouping and sorting, the filter and the search text,
   * group expansion, the page, and — with `keyExpr` and string/number keys —
   * the selection and the expanded detail rows. Never row data. Columns are
   * identified by `name` (or `path`); columns without either are left out.
   */
  getState(): GridState {
    this.#stateInUse = true;
    return this.#collectState();
  }

  /**
   * O estado atual. Os avisos de coluna sem id só saem quando o hospedeiro
   * usa o estado (storage, `getState`/`setState`): o acompanhamento interno
   * roda em todo grid.
   */
  #collectState(): GridState {
    const state: GridState = { version: GRID_STATE_VERSION };
    const sortIndex = new Map(this.#sorting.map((spec, index) => [spec.column, index]));
    const columns: GridColumnState[] = [];

    for (const [name, column] of this.#namedColumns([...this._regularColumns, ...this._groupColumns])) {
      const sort = sortIndex.get(column);
      const groupIndex = this._groupColumns.indexOf(column);

      columns.push({
        name,
        width: this.#userWidths.get(column) ?? null,
        visible: this._isColumnVisible(column),
        fixed: this._fixedOf(column),
        groupIndex: groupIndex >= 0 ? groupIndex : null,
        sortOrder: sort === undefined ? null : this.#sorting[sort].order,
        sortIndex: sort ?? null,
      });
    }

    state.columns = columns;
    state.filterValue = jsonFilterCopy(this.#filtering.filterValue) as GridFilterExpression | null;
    state.searchText = this.#filtering.searchText;
    state.groupExpansion = this.#groupExpansionState();

    // Sem `keyExpr` a chave é o próprio item: dado de linha, fica fora.
    if (this.#keyExpr) {
      state.selectedKeys = this.#selection.keys.filter(isStateKey);

      const keys = [...this.#rowExpansion].filter(isStateKey);
      state.rowExpansion = this.autoExpandRows ? { expanded: [], collapsed: keys } : { expanded: keys, collapsed: [] };
    }

    state.pageIndex = this.#pageIndex;
    state.pageSize = this.#effectivePageSize;

    return state;
  }

  /**
   * Applies a state (from `getState`, your storage or built by hand). It is
   * validated first: an invalid state is ignored with a console warning; an
   * older version is migrated, an unknown one ignored. Without `partial`,
   * every top-level key missing from `state` goes back to the initial value
   * (the column definitions and the properties the host set before the grid
   * connected); with `partial: true` only the keys present change. A
   * `columns` list sets the whole layout: columns missing from it go back to
   * their definition, at the end in definition order; unknown names are
   * ignored. Fires none of the per-feature events (like the setters), only
   * `u-grid-state-change`. Never moves the focus nor announces anything: when
   * a user gesture triggers it, announce the result yourself.
   * @param state The state to apply.
   * @param options `partial: true` changes only the keys present in `state`.
   */
  setState(state: GridState, options?: { partial?: boolean } | null): void {
    this.#stateInUse = true;
    const parsed = parseGridState(state);

    if ('error' in parsed) {
      console.warn(`<u-grid>: setState ignored: ${parsed.error}.`);
      return;
    }

    this.#explicitStateChange();
    this.#requestState(parsed.state, options?.partial === true, false);
  }

  /** Puts the state back to the initial one (`setState` with an empty state, without `partial`). */
  resetState(): void {
    this.#stateInUse = true;
    this.#explicitStateChange();
    this.#requestState({ version: GRID_STATE_VERSION }, false, false);
  }

  /**
   * Estado aplicado com um editor aberto (frente 09): o layout pode esconder
   * a coluna ou a linha dele. O que foi digitado fica pendente (validado,
   * sem salvar — como o foco saindo do editor) e o editor fecha; o foco fica
   * na célula. As mudanças pendentes não são estado: sobrevivem como à
   * ordenação e ao filtro.
   */
  #settleEditorForState(): void {
    if (!this.#editor) {
      return;
    }

    void this.#commitEditor();
    this.#closeEditor();
    this.#focusPending ||= this.#hadFocusInGrid();
  }

  /** `setState`/`resetState`: vence uma leitura em curso (e, antes de conectar, a leitura). */
  #explicitStateChange(): void {
    this.#captureInitial();
    this.#loadGeneration++;

    if (!this.isConnected && !this.hasUpdated) {
      this.#explicitState = true;
    }

    if (this.#stateWaiting) {
      this.#stateWaiting = false;
      this.requestUpdate();
    }
  }

  #captureInitial(): void {
    this.#initial ??= {
      filterValue: this.#filtering.filterValue,
      searchText: this.#filtering.searchText,
      pageIndex: this.#pageIndex,
      pageSize: this.pageSize,
      selectedKeys: this.#selection.keys,
    };
  }

  #warnState(message: string): void {
    if (!this.#warnedState.has(message)) {
      this.#warnedState.add(message);
      console.warn(`<u-grid>: ${message}`);
    }
  }

  /** Colunas com id no estado, uma por id (a 1ª vence); avisa as sem id e as repetidas. */
  #namedColumns(columns: readonly GridColumnDef[]): Map<string, GridColumnDef> {
    const named = new Map<string, GridColumnDef>();

    for (const column of columns) {
      const name = columnNameOf(column);

      const warn = this.#stateInUse || !!this.#stateStorage;

      if (!name) {
        if (warn) {
          this.#warnState(`a column without "name" or "path" (${JSON.stringify(column.label ?? '')}) is left out of the state.`);
        }
      } else if (named.has(name)) {
        if (warn) {
          this.#warnState(`column name "${name}" is repeated; only the first column with it is in the state.`);
        }
      } else {
        named.set(name, column);
      }
    }

    return named;
  }

  #groupExpansionState(): GridGroupExpansionState {
    const columns = this._groupColumns;
    const expanded: GridStateGroupPath[] = [];
    const collapsed: GridStateGroupPath[] = [];

    for (const [key, entry] of this.#expansion) {
      // Entradas de outro agrupamento (o mapa as guarda) não valem agora.
      if (entry.path.length > columns.length || groupKeyOf(entry.path, columns) !== key) {
        continue;
      }

      const path = entry.path.map(groupValueToState);

      if (path.every(value => value !== undefined)) {
        (entry.expanded ? expanded : collapsed).push(path);
      }
    }

    return {
      all: this.#allExpansion ?? null,
      levels: Array.from(this.#levelExpansion, level => level ?? null),
      expanded,
      collapsed,
    };
  }

  /** Aplica já (havendo colunas) ou guarda para o próximo `willUpdate`. */
  #requestState(state: GridState, partial: boolean, fromStorage: boolean): void {
    if (this.columns.length) {
      this.#applyState(state, partial, fromStorage);
    } else {
      this.#statesToApply.push({ state, partial, fromStorage });
      this.requestUpdate();
    }
  }

  #applyPendingStates(): void {
    if (!this.#statesToApply.length || !this.columns.length) {
      return;
    }

    const pending = this.#statesToApply;
    this.#statesToApply = [];
    pending.forEach(({ state, partial, fromStorage }) => this.#applyState(state, partial, fromStorage));
  }

  /** Aplica um estado JÁ VALIDADO. Sem eventos por recurso, sem foco, sem anúncio. */
  #applyState(state: GridState, partial: boolean, fromStorage: boolean): void {
    this.#settleEditorForState();
    this.#captureInitial();
    const initial = this.#initial!;
    const reset = !partial;

    if (state.columns) {
      this.#restoreColumns(state.columns);
    } else if (reset) {
      this.#resetColumns();
    }

    if (state.filterValue !== undefined || state.searchText !== undefined || reset) {
      const filterValue = state.filterValue !== undefined ? state.filterValue : reset ? initial.filterValue : this.#filtering.filterValue;
      const searchText = state.searchText ?? (reset ? initial.searchText : this.#filtering.searchText);

      // Debounce pendente da busca/linha de filtro reaplicaria o texto velho.
      this.#filterRow.discardDrafts();
      this.#search.discardDraft();
      this.#filtering.set(filterValue, searchText);
    }

    // A contagem que um gesto anterior esperava não é anunciada (o estado não é gesto),
    // nem a largura de um Alt+←/→ em curso.
    this.#announceFilter = false;
    this.#resizeAnnouncer.cancel('resize');

    if (state.groupExpansion || reset) {
      this.#restoreGroupExpansion(state.groupExpansion);
    }

    if (state.selectedKeys || reset) {
      const keys = state.selectedKeys ?? initial.selectedKeys;
      this.#selection.replace(this.#selectionMode === 'single' ? keys.slice(-1) : keys);
    }

    if (state.rowExpansion || reset) {
      this.#rowExpansion.clear();

      for (const key of (this.autoExpandRows ? state.rowExpansion?.collapsed : state.rowExpansion?.expanded) ?? []) {
        this.#rowExpansion.add(key);
      }

      this.#rowsDirty = true;
    }

    const pageSize = state.pageSize ?? (reset ? initial.pageSize : undefined);

    // Só tamanhos oferecidos pelo pager (ou o do hospedeiro): o storage não escolhe 100 mil.
    if (pageSize !== undefined && (pageSize === initial.pageSize || this.pageSizeOptions.includes(pageSize))) {
      this.pageSize = pageSize;
    }

    const pageIndex = state.pageIndex ?? (reset ? initial.pageIndex : undefined);

    if (pageIndex !== undefined) {
      this.pageIndex = pageIndex;
    }

    this.#closeHiddenPopovers();
    this.#rowsDirty = true;
    this.#layoutDirty = true;
    this.requestUpdate();

    if (fromStorage) {
      // Restaurado: avisa ("pronto") na rajada, sem gravar de volta.
      this.#burstSources.add('storage');
      this.#stateSignature = undefined;
      this.#scheduleStateChange();
    }
  }

  /** Colunas como na definição (grid novo): sem ordem, larguras, visibilidade, fixação nem ordenação do usuário. */
  #resetColumns(): void {
    this.#userWidths.clear();
    this.#userVisible.clear();
    this.#userFixed.clear();
    this.#autoWidths.clear();
    this._regularColumns = [];
    this._groupColumns = [];
    this.#sorting = [];
    this.#sortDirty = true;
    this.#layoutDirty = true;
    this.#syncColumns();
  }

  #restoreColumns(list: readonly GridColumnState[]): void {
    const definitions = this.columns;
    const named = this.#namedColumns(definitions);
    const entries = new Map<GridColumnDef, GridColumnState>();

    for (const entry of list) {
      const column = named.get(entry.name);

      // Coluna que não existe mais: ignorada.
      if (column && !entries.has(column)) {
        entries.set(column, entry);
      }
    }

    // As da lista na ordem dela; as outras voltam à definição, no fim.
    const ordered = [...entries.keys(), ...definitions.filter(column => !entries.has(column))];

    const pick = <K extends keyof GridColumnState>(column: GridColumnDef, key: K, fallback: GridColumnState[K]): GridColumnState[K] => {
      const entry = entries.get(column);
      return entry?.[key] !== undefined ? entry[key] : fallback;
    };

    const groupIndexOf = (column: GridColumnDef): number | null => {
      const index = pick(column, 'groupIndex', column.groupIndex ?? null);
      return typeof index === 'number' && Number.isInteger(index) && index >= 0 ? index : null;
    };

    this.#userWidths.clear();
    this.#userVisible.clear();
    this.#userFixed.clear();
    this.#autoWidths.clear();

    for (const [column, entry] of entries) {
      if (typeof entry.width === 'number') {
        this.#userWidths.set(column, Math.round(entry.width));
      }

      if (entry.visible !== undefined && entry.visible !== (column.visible !== false)) {
        this.#userVisible.set(column, entry.visible);
      }

      if (entry.fixed !== undefined && entry.fixed !== normalizeFixed(column.fixed)) {
        this.#userFixed.set(column, entry.fixed);
      }
    }

    const regular = ordered.filter(column => groupIndexOf(column) === null);
    const group = ordered
      .map((column, position) => ({ column, position, index: groupIndexOf(column) }))
      .filter((entry): entry is { column: GridColumnDef; position: number; index: number } => entry.index !== null)
      .sort((a, b) => a.index - b.index || a.position - b.position)
      .map(entry => entry.column);

    // Nenhuma coluna comum visível: volta a visibilidade à definição.
    if (regular.length && !regular.some(column => this._isColumnVisible(column))) {
      regular.forEach(column => this.#userVisible.delete(column));
    }

    this.#sorting = ordered
      .map((column, position) => ({
        column,
        position,
        order: pick(column, 'sortOrder', column.sortOrder ?? null),
        index: pick(column, 'sortIndex', column.sortIndex ?? null),
      }))
      .filter((entry): entry is typeof entry & { order: GridSortOrder } => entry.order === 'asc' || entry.order === 'desc')
      .sort((a, b) => (a.index ?? Infinity) - (b.index ?? Infinity) || a.position - b.position)
      .map(({ column, order }) => ({ column, order }));
    this.#sortDirty = true;
    this.#autoWidthDirty = true;
    this.#layoutDirty = true;
    this.#setColumnState(regular, group);
  }

  #restoreGroupExpansion(state: GridGroupExpansionState | undefined): void {
    this.#resetExpansion();

    if (!state) {
      return;
    }

    this.#allExpansion = state.all ?? undefined;
    this.#levelExpansion = state.levels.map(level => level ?? undefined);

    const columns = this._groupColumns;

    const add = (path: GridStateGroupPath, expanded: boolean): void => {
      if (path.length > columns.length) {
        return;
      }

      const values = Object.freeze(path.map((value, level) => this.#groupValueFromState(value, columns[level])));
      const key = groupKeyOf(values, columns);
      const level = path.length - 1;

      if (key !== undefined && expanded !== this.#defaultExpanded(level)) {
        this.#expansion.set(key, { expanded, level, path: values });
      }
    };

    state.expanded.forEach(path => add(path, true));
    state.collapsed.forEach(path => add(path, false));
  }

  /** Datas viajam como texto ISO: volta a `Date` nas colunas de data (sem faixa). */
  #groupValueFromState(value: unknown, column: GridColumnDef): unknown {
    if (typeof value !== 'string' || column.groupValueGetter) {
      return value;
    }

    const dataType = this.#dataTypeOf(column);
    return dataType === 'date' || dataType === 'datetime' ? toDate(value) ?? value : value;
  }

  /** Popover/menu de uma coluna que saiu de vista fecha (o foco volta à célula ativa pela guarda da spec 17). */
  #closeHiddenPopovers(): void {
    const visible = new Set(this._regularColumns.filter(column => this._isColumnVisible(column)));
    const focused = this.shadowRoot?.activeElement;

    // `hidePopover()` (manual) não devolve o foco: vai à célula ativa no render seguinte.
    if (focused?.closest('.header-filter, .filter-menu')) {
      const headerColumn = this.#headerFilterPopover.column;
      const menuColumn = this.#filterRow.menuColumn;

      if ((headerColumn && !visible.has(headerColumn)) || (menuColumn && !visible.has(menuColumn))) {
        this.#focusPending = true;
      }
    }

    this.#headerFilterPopover.closeIfRemoved(visible);

    const menuColumn = this.#filterRow.menuColumn;

    if (menuColumn && !visible.has(menuColumn)) {
      this.#filterRow.closeMenu();
    }
  }

  // --------------------------------------------------- leitura e gravação

  get #storageConfig(): StorageConfig | undefined {
    return resolveStorage(this.#stateStorage, this.#stateStorageKey, message => this.#warnState(message));
  }

  /** Esperando o estado: no cliente, a leitura assíncrona/hidratação; no servidor, sempre que há storage. */
  get #waitingForState(): boolean {
    return this.#stateWaiting || (isServer && !this.#renderedData && !this.#explicitState && !!this.#storageConfig);
  }

  /** Mudou `stateStorage`/`stateStorageKey`: relê (já conectado) e acerta o `pagehide`. */
  #storageChanged(): void {
    if (this.isConnected && this.hasUpdated) {
      this.#startStateLoad();
    }

    this.#syncPageHide();
  }

  /** Lê o storage, uma vez por origem. Síncrono: aplica antes do render; assíncrono: espera sem linhas. */
  #startStateLoad(): void {
    const config = this.#storageConfig;

    if (!config) {
      this.#loadedFrom = undefined;
      return;
    }

    const from = config.kind === 'custom' ? config.storage : `${config.kind}:${config.key}`;

    if (from === this.#loadedFrom) {
      return;
    }

    this.#loadedFrom = from;
    const generation = ++this.#loadGeneration;

    if (config.kind !== 'custom') {
      const read = readWebStorage(config.kind, config.key);

      if ('error' in read) {
        this.#warnState(`${read.error}; the initial state is used.`);
      } else {
        this.#restoreLoaded(read.value);
      }

      return;
    }

    let result: unknown;

    try {
      result = config.storage.load();
    } catch (error) {
      this.#warnState(`stateStorage.load() failed (${String(error)}); the initial state is used.`);
      return;
    }

    if (!result || typeof (result as PromiseLike<unknown>).then !== 'function') {
      this.#restoreLoaded(result);
      return;
    }

    // Antes do 1º render de dados: sem linhas até chegar (nada pisca).
    if (!this.#renderedData) {
      this.#stateWaiting = true;
      this.requestUpdate();
    }

    void Promise.resolve(result as PromiseLike<unknown>).then(
      value => {
        if (generation === this.#loadGeneration) {
          this.#restoreLoaded(value);
        }
      },
      (error: unknown) => {
        if (generation === this.#loadGeneration) {
          this.#warnState(`stateStorage.load() rejected (${String(error)}); the initial state is used.`);
        }
      },
    )
      .finally(() => {
        if (generation === this.#loadGeneration && this.#stateWaiting) {
          this.#stateWaiting = false;
          this.requestUpdate();
        }
      });
  }

  /** O que o storage devolveu: `null` = nada guardado; o resto passa pela validação. */
  #restoreLoaded(value: unknown): void {
    if (value === null || value === undefined) {
      return;
    }

    const parsed = parseGridState(value);

    if ('error' in parsed) {
      this.#warnState(`the saved state is ignored: ${parsed.error}.`);
      return;
    }

    this.#requestState(parsed.state, false, true);
  }

  /** Depois de cada render: alguma parte do estado mudou? Agenda o aviso/gravação da rajada. */
  #trackStateChange(): void {
    if (!this.isConnected || this.#waitingForState || this.#statesToApply.length) {
      return;
    }

    const signature = [
      this._regularColumns,
      this._groupColumns,
      this.#sorting,
      this.#userWidths.version,
      this.#userVisible.version,
      this.#userFixed.version,
      this.#filtering.filterValue,
      this.#filtering.searchText,
      this.#expansion.version,
      this.#expansionDefaultsVersion,
      this.#rowExpansion.version,
      this.autoExpandRows,
      this.#pageIndex,
      this.#effectivePageSize,
      this.#selection.version,
      this.#keyExpr,
    ];
    const previous = this.#stateSignature;
    this.#stateSignature = signature;

    if (!previous) {
      this.#recordedSources.clear();
      this.#lastStateJson ??= JSON.stringify(this.#collectState());
      return;
    }

    if (signature.every((part, index) => part === previous[index])) {
      this.#recordedSources.clear();
      return;
    }

    if (this.#recordedSources.size) {
      this.#recordedSources.forEach(source => this.#burstSources.add(source));
    } else {
      this.#burstSources.add('api');
    }

    this.#recordedSources.clear();
    this.#scheduleStateChange();
  }

  #scheduleStateChange(): void {
    // Desconectado nada fica agendado (spec 14); o que estava pendente saiu no disconnect.
    if (!this.isConnected) {
      return;
    }

    const delay = Number(this.stateChangeDelay);

    clearTimeout(this.#stateTimer);
    this.#stateTimer = setTimeout(() => this.#flushStateChange(), Number.isFinite(delay) && delay >= 0 ? delay : STATE_CHANGE_DELAY);
  }

  /** Fim da rajada: avisa (se o estado mudou de fato) e grava (se não foi só a restauração). */
  #flushStateChange(): void {
    clearTimeout(this.#stateTimer);
    this.#stateTimer = undefined;

    const sources = [...this.#burstSources];
    this.#burstSources.clear();

    const state = this.#collectState();
    const json = JSON.stringify(state);
    const restored = sources.includes('storage');

    if (json === this.#lastStateJson && !restored) {
      return;
    }

    this.#lastStateJson = json;
    this.dispatchEvent(new CustomEvent('u-grid-state-change', this.#eventInit<GridStateChangeEventDetail>({ state, sources })));

    if (sources.some(source => source !== 'storage')) {
      this.#saveState(json);
    }
  }

  #saveState(json: string): void {
    const config = this.#storageConfig;

    if (!config) {
      return;
    }

    if (config.kind !== 'custom') {
      const error = writeWebStorage(config.kind, config.key, json);

      if (error) {
        this.#warnState(`${error}; the state was not saved.`);
      }

      return;
    }

    const failed = (error: unknown): void => this.#warnState(`stateStorage.save() failed (${String(error)}).`);

    try {
      // Cópia própria: quem ouviu o evento pode ter mexido no objeto dele.
      const result: unknown = config.storage.save(JSON.parse(json) as GridState);

      if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
        Promise.resolve(result).catch(failed);
      }
    } catch (error) {
      failed(error);
    }
  }

  /** Grava a rajada pendente antes de a página sair (bfcache, aba fechada). */
  readonly #onPageHide = (): void => {
    if (this.#stateTimer !== undefined) {
      this.#flushStateChange();
    }
  };

  #syncPageHide(): void {
    const listen = !isServer && !!this.isConnected && !!this.#storageConfig;

    if (listen === this.#pageHideListening) {
      return;
    }

    this.#pageHideListening = listen;

    if (listen) {
      window.addEventListener('pagehide', this.#onPageHide);
    } else {
      window.removeEventListener('pagehide', this.#onPageHide);
    }
  }

  /** Os eventos de mudança dizem a origem (`source`) da rajada do estado. */
  override dispatchEvent(event: Event): boolean {
    if (STATE_EVENTS.has(event.type)) {
      const source = (event as CustomEvent<{ source?: unknown } | null>).detail?.source;
      this.#recordedSources.add(source === 'api' ? 'api' : 'user');
    }

    return super.dispatchEvent(event);
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
      const table = scroller?.querySelector<HTMLTableElement>('table.grid-table');

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
  readonly #columnMenu = new GroupPanelMenuController(this, 'column-header-menu');
  readonly #filtering = new FilteringController(this);
  readonly #filterRow = new FilterRowController(this);
  readonly #headerFilterPopover = new HeaderFilterController(this);
  readonly #search = new SearchController(this);
  #resizeObserver: ResizeObserver | undefined;
  /** Barra (painel de grupos, busca, seletor) observada para a altura que prende o cabeçalho. */
  #observedToolbar: HTMLElement | null = null;
  readonly #toolbarRef: Ref<HTMLDivElement> = createRef();

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
      filterTimers: this.#filterRow.timers + this.#search.timers + this.#headerFilterPopover.timers + (this.#filtering.pending ? 1 : 0),
      announceTimers: this.#resizeAnnouncer.size,
      headerFilterOpen: this.#headerFilterPopover.open ? 1 : 0,
      selectedKeys: this.#selection.size,
      // Fonte de dados (frente 08): pedidos em voo, blocos em cache (LRU por geração) e o temporizador dos pedidos.
      pendingLoads: this.#loader.pending,
      cachedBlocks: this.#loader.blocksCached,
      loadTimers: (this.#flushTimer === undefined ? 0 : 1) + (this.#loadingTimer === undefined ? 0 : 1),
      rowExpansion: this.#rowExpansion.size,
      primitiveDetailSizes: this.#primitiveDetailSizes.size,
      observedDetails: this.#observedDetails.size,
      hostLabelObservers: this.#hostLabel.observers,
      // Estado (frente 11): temporizador da rajada, `pagehide`, estados à espera de colunas.
      stateTimers: this.#stateTimer === undefined ? 0 : 1,
      pageHideListeners: this.#pageHideListening ? 1 : 0,
      pendingStates: this.#statesToApply.length,
      warnedState: this.#warnedState.size,
      // Edição (frente 09): mudanças pendentes, linhas novas, validações e o temporizador de "Salvando…".
      pendingEdits: this.#edits.size,
      addedRows: this.#added.size,
      validations: this.#validations.size + this.#validationPromises.size,
      editTimers: (this.#savingTimer === undefined ? 0 : 1) + (this.#validatingTimer === undefined ? 0 : 1),
      editLightNodes: this.#lightMessage ? 1 : 0,
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
    // Shadow root declarativo antes do 1º update: hidratação do SSR.
    const hydrating = !this.hasUpdated && !!this.shadowRoot;

    super.connectedCallback();
    this.#readDeclarativeColumns();
    this.#unobserveDocumentLanguage = observeDocumentLanguage(() => this.requestUpdate());
    this.#hostLabel.update();
    this.#dragAndDropDirty = true;
    this.#layoutDirty = true;
    this.#observeScrollContainer();

    // Estado (frente 11): o "inicial" é o que o hospedeiro deu antes de conectar.
    this.#captureInitial();

    if (!this.#explicitState) {
      if (hydrating && this.#storageConfig) {
        // O servidor renderizou "carregando estado": o render da hidratação
        // tem de casar com ele; a leitura vem depois do 1º update.
        this.#stateWaiting = true;
      } else {
        this.#startStateLoad();
      }
    }

    this.#syncPageHide();
  }

  override disconnectedCallback() {
    // Antes do super: ele solta os refs (o contêiner) dos diretivos.
    this.#resize.cancel();
    // A tabela não segura os rótulos da página enquanto o grid está fora dela (antes do super: precisa do ref).
    this.#hostLabel.disconnect();
    this.#syncTableLabel();
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
    this.#observedToolbar = null;
    this.#detailObserver?.disconnect();
    this.#detailObserver = undefined;
    this.#observedDetails.clear();
    // Pedidos em voo e o temporizador da fonte (spec 14): ao reconectar, carrega de novo.
    clearTimeout(this.#flushTimer);
    this.#flushTimer = undefined;
    clearTimeout(this.#loadingTimer);
    this.#loadingTimer = undefined;
    this.#loadingAnnounced = false;
    this.#loader.dispose();
    this.#queryKey = undefined;
    this.#pendingQuery = undefined;

    // Rajada do estado pendente: avisa e grava agora (spec 14: nenhum timer fica).
    if (this.#stateTimer !== undefined) {
      this.#flushStateChange();
    }

    this.#syncPageHide();
    this.#releaseEditing();
  }

  override willUpdate(changed: PropertyValues<this>) {
    // No servidor o Lit não chama o `attributeChangedCallback` do elemento: lê o `aria-label` aqui.
    if (isServer) {
      this.#hostLabel.update();
    }

    // Estado pedido antes de haver colunas (`setState` cedo, storage).
    this.#applyPendingStates();

    // \`:focus-within\` cobre também o conteúdo do renderer (light DOM projetado por slot).
    // (No SSR não há \`matches\` nem foco.)
    this.#hadFocusBeforeRender = !!this.shadowRoot?.activeElement || (typeof this.matches === 'function' && this.matches(':focus-within'));

    // `single` guarda uma chave só. Evento só na troca `multiple` → `single`
    // de um grid já renderizado; na inicialização (setters) corta calado.
    if (changed.has('selectionMode') && this.#selectionMode === 'single' && this.#selection.size > 1) {
      const change = this.#selection.replace(this.#selection.keys.slice(-1));

      if (this.hasUpdated && normalizeSelectionMode(changed.get('selectionMode')) === 'multiple') {
        this.#applySelection(change, 'api');
      }
    }

    if (changed.has('autoExpandRows')) {
      if (changed.get('autoExpandRows') !== undefined) {
        this.#rowExpansion.clear();
      }

      this.#rowsDirty = true;
    }

    if (changed.has('detailRenderer') && !changed.get('detailRenderer') !== !this.detailRenderer) {
      // A coluna de expansão e as linhas de detalhe aparecem/somem.
      this.#rowsDirty = true;
      this.#layoutDirty = true;
    }

    if (changed.has('scrollMode') && this.scrollMode !== 'virtual' && !this.#dataSource && !this.#warnedInfinitePaging) {
      this.#warnedInfinitePaging = true;
      console.warn(this.scrollMode === 'infinite'
        ? '<u-grid>: scroll-mode="infinite" needs a dataSource with remote paging; ignored.'
        : `<u-grid>: unknown scroll-mode "${String(this.scrollMode)}"; "virtual" is used.`);
    }

    if (changed.has('autoExpandGroups')) {
      // Opção do hospedeiro vence o estado do usuário (como nas colunas).
      if (changed.get('autoExpandGroups') !== undefined) {
        this.#resetExpansion();
      }

      this.#rowsDirty = true;
    }

    const menuColumn = this.#groupMenu.column;

    const columnMenuColumn = this.#columnMenu.column;

    if (this.#columnMenu.open && (
      !this.columnHeaderMenu
      || !columnMenuColumn
      || !(this._isBand(columnMenuColumn) ? this._isColumnVisible(columnMenuColumn) : this._visibleColumns.includes(columnMenuColumn)))) {
      this.#columnMenu.hide();
    }

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

    if (changed.has('columnRenderingMode')) {
      const mode = this.columnRenderingMode;

      if (mode !== 'auto' && mode !== 'virtual' && mode !== 'standard' && !this.#warnedRenderingMode) {
        this.#warnedRenderingMode = true;
        console.warn(`<u-grid>: unknown column-rendering-mode "${String(mode)}"; "auto" is used.`);
      }

      this.#layoutDirty = true;
      this.#dragAndDropDirty = true;
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
    this._scrollContainerRef.value?.addEventListener('scroll', this.#onHorizontalScroll, { passive: true });
    this.#observeScrollContainer();

    // Hidratado: agora lê o storage (o 1º render casou com o do servidor).
    if (this.#stateWaiting && this.#loadedFrom === undefined) {
      this.#stateWaiting = false;
      this.#startStateLoad();
      this.requestUpdate();
    }
  }

  override updated(changed: PropertyValues<this>) {
    const virtualizer = this.#virtualizer;
    this.#observeToolbar();
    this.#syncTableLabel();

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

    this.#measureDetails(!this.#hasWrap);

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

    this.#afterEditRender();

    if (this.#chipFocusPending) {
      this.#chipFocusPending = false;
      this.renderRoot.querySelector<HTMLElement>('.group[tabindex="0"]')?.focus();
    }

    if (this.#hadFocusBeforeRender) {
      // O conteúdo de uma célula removida sai num microtask (grid-custom-cell):
      // confere de novo depois dele.
      void this.updateComplete.then(() => {
        // Só pelo activeElement: o \`:focus-within\` fica velho até o "focus fixup" do navegador.
        if (!this.shadowRoot?.activeElement && (!document.activeElement || document.activeElement === document.body)) {
          this.#focusPending = true;
          this.requestUpdate();
        }
      });
    }

    if (this.#hadFocusBeforeRender && !this.shadowRoot?.activeElement && !this.matches(':focus-within')) {
      this.#hadFocusBeforeRender = false;
      this.#focusPending = true;
      this.#afterActiveRender();
    }

    const correction = this.#pageCorrection;

    if (correction) {
      this.#pageCorrection = undefined;

      if (correction.pageIndex !== this.#pageIndex) {
        this.dispatchEvent(new CustomEvent('u-grid-page-change', this.#eventInit<GridPageChangeEventDetail>({
          pageIndex: this.#pageIndex,
          previousPageIndex: correction.pageIndex,
          pageSize: this.#effectivePageSize,
          previousPageSize: correction.pageSize,
          source: correction.source,
        })));
      }
    }

    this.#afterRenderLoad();
    this.#announceStateLoading();
    this.#trackStateChange();

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
   * grouped column it sets the direction of its groups. A band does nothing.
   */
  sortColumn(column: GridColumnDef, order: GridSortOrder | null, options: { append?: boolean } = {}): void {
    if (this._isBand(column)) {
      return;
    }

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
   * innermost level). An already grouped column moves to that level. Only
   * leaf columns group (a band does nothing); a grouped column leaves its
   * band in the header and returns to the end of it when ungrouped.
   */
  groupColumn(column: GridColumnDef, targetIndex?: number): void {
    this.#moveColumnTo(true, column, targetIndex ?? this._groupColumns.length, 'api');
  }

  /** Removes `column` from the grouping; it goes back to the end of its band (or of the regular columns at the top level). */
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
   * Expands the detail of the row `rowKey` (master-detail; without
   * `detailRenderer` it does nothing). A key not in the rows (filtered out,
   * in a collapsed group, not in `items`) keeps the state — and the key —
   * until collapsed; parent groups are not expanded.
   */
  expandRow(rowKey: unknown): void {
    this.#setRowExpanded(rowKey, true, 'api');
  }

  /** Collapses the detail of the row `rowKey` (see `expandRow`). */
  collapseRow(rowKey: unknown): void {
    this.#setRowExpanded(rowKey, false, 'api');
  }

  /** Whether the detail of the row `rowKey` is (or would be) expanded; `false` without `detailRenderer`. */
  isRowExpanded(rowKey: unknown): boolean {
    return !!this.detailRenderer && this.#isRowExpandedKey(rowKey);
  }

  #isRowExpandedKey(key: unknown): boolean {
    return this.autoExpandRows !== this.#rowExpansion.has(key);
  }

  #setRowExpanded(key: unknown, expanded: boolean, source: GridChangeSource): void {
    if (!this.detailRenderer || key === undefined || this.#isRowExpandedKey(key) === expanded) {
      return;
    }

    if (expanded === this.autoExpandRows) {
      this.#rowExpansion.delete(key);
    } else {
      this.#rowExpansion.add(key);
    }

    this.#rowsDirty = true;
    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('u-grid-row-expansion-change', this.#eventInit<GridRowExpansionChangeEventDetail>({
      rowKey: key,
      expanded,
      source,
    })));
  }

  /**
   * Linhas de detalhe de um bloco de itens: posições dos itens cuja expansão
   * difere do padrão. Poucas chaves sem `keyExpr`: `indexOf` por chave
   * (rápido em array de objetos); senão uma passada com `Set` (pela chave).
   * Bloco remoto (frente 08): só as linhas carregadas têm detalhe, listadas
   * uma a uma (`all: false`).
   */
  readonly #detailsOf = (items: readonly unknown[] | LazyItems): BlockDetails | undefined => {
    if (!this.detailRenderer) {
      return undefined;
    }

    const all = this.autoExpandRows;
    const keys = this.#rowExpansion;
    const keyOf = this.#keyOf;

    if (isLazyItems(items)) {
      if (!all && !keys.size) {
        return undefined;
      }

      const loaded = items.loadedPositions(item => all !== keys.has(keyOf(item)));
      return loaded.length ? { all: false, positions: Int32Array.from(loaded) } : undefined;
    }

    if (!keys.size) {
      return all ? { all, positions: NO_POSITIONS } : undefined;
    }

    const positions: number[] = [];

    if (keys.size <= 16 && !this.#keyExpr) {
      for (const key of keys) {
        for (let position = items.indexOf(key); position >= 0; position = items.indexOf(key, position + 1)) {
          positions.push(position);
        }
      }

      positions.sort((a, b) => a - b);
    } else {
      items.forEach((item, position) => {
        if (keys.has(keyOf(item))) {
          positions.push(position);
        }
      });
    }

    return { all, positions: Int32Array.from(positions) };
  };

  /** Altura medida do detalhe: pela chave (`keyExpr`, sobrevive a objetos novos) ou pelo item. */
  #detailSizeOf(item: unknown): number | undefined {
    const key = this.#keyOf(item);

    return key !== null && typeof key === 'object'
      ? this.#detailSizes.get(key)
      : this.#primitiveDetailSizes.get(key);
  }

  #setDetailSize(item: unknown, size: number): void {
    const key = this.#keyOf(item);

    if (key !== null && typeof key === 'object') {
      this.#detailSizes.set(key, size);
    } else {
      this.#primitiveDetailSizes.set(key, size);
    }
  }

  /** Linhas (página) cujas alturas de detalhe o virtualizador conhece. */
  #syncedRows: Rows | undefined;

  /** Alturas das linhas de detalhe para o virtualizador (as medidas ou a estimativa). */
  #syncDetailSizes(): void {
    const rows = this.#rows;

    this.#syncedRows = rows;
    const indices = rows.detailCount ? rows.detailIndices() : NO_POSITIONS;
    const sizes = new Float64Array(indices.length);
    const estimate = this.#detailEstimate || this.rowHeight * 3;

    indices.forEach((index, i) => {
      sizes[i] = this.#detailSizeOf((rows.at(index) as DetailRow).item) ?? estimate;
    });

    this.#virtualizer.count = rows.length;
    this.#virtualizer.setVariableRows(indices, sizes);
  }

  /** Mede as linhas de detalhe renderizadas e observa as que crescem depois. */
  #measureDetails(measure: boolean): void {
    const rows = [...this.renderRoot.querySelectorAll<HTMLElement>('tbody > tr.detail-row:not(.pinned)')];
    const observed = this.#observedDetails;

    if (!rows.length && !observed.size) {
      return;
    }

    if (measure) {
      this.#virtualizer.measureRows(rows, false);
    }

    for (const row of rows) {
      const index = Number(row.getAttribute('data-index'));
      const detail = this.#rowAt(index);

      if (isDetailRow(detail)) {
        const size = this.#virtualizer.sizeOf(index);

        this.#detailEstimate = size;

        this.#setDetailSize(detail.item, size);
      }
    }

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    this.#detailObserver ??= new ResizeObserver(() => {
      if (this.isConnected) {
        this.#measureDetails(true);
      }
    });

    const current = new Set<Element>(rows);

    for (const row of observed) {
      if (!current.has(row)) {
        this.#detailObserver.unobserve(row);
        observed.delete(row);
      }
    }

    for (const row of rows) {
      if (!observed.has(row)) {
        this.#detailObserver.observe(row);
        observed.add(row);
      }
    }
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
      this.#expansion.set(key, { expanded, level, path: groupPath });
    }

    this.#rowsDirty = true;
    this.#pageCause ??= source;
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

    this.#expansionDefaultsVersion++;

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
    this.#pageCause ??= source;
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
   * Moves a column (or a band, with all its columns) to `targetIndex` among
   * its siblings — the columns of the same band, or the top level — that are
   * not grouped (hidden ones count). Without bands that is the index among
   * the regular columns. The column stays in its band and in its block: fixed
   * at the start, free, or fixed at the end. A grouped column is ungrouped.
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

  /** Sets the width (px) of a column, within its `minWidth`/`maxWidth`. A band does nothing. */
  setColumnWidth(column: GridColumnDef, width: number): void {
    if (!this._regularColumns.includes(column) || !Number.isFinite(width)) {
      return;
    }

    const { min, max } = this._boundsOf(column);
    this._setUserWidths(new Map([[column, clampWidth(width, min, max)]]));
  }

  /** Fits the width of a column to its header and rendered cells; for a band, each of its visible columns. */
  autoSizeColumn(column: GridColumnDef): void {
    if (this._isBand(column)) {
      this._visibleColumns
        .filter(leaf => this._bandChainOf(leaf).includes(column))
        .forEach(leaf => this.autoSizeColumn(leaf));
      return;
    }

    const width = this.#measureColumnContent(column);

    if (width !== undefined) {
      this.setColumnWidth(column, width);
    }
  }

  /**
   * Reloads the data: with `dataSource`, discards the loaded blocks and asks
   * again (the rows shown stay until the answer); with `items`, recomputes
   * sorting, filtering, grouping and summaries. Resolves when done (also on
   * error — see `u-grid-load-error`).
   */
  async refresh(): Promise<void> {
    if (!this.#dataSource) {
      this.#sortDirty = true;
      this.#rankCache.clear();
      this.#dataTypes.clear();
      this.#allConvert.clear();
      this.#filtering.invalidate();
      this.#summaryDirty = true;
      this.#totalsDirty = true;
      this.#groupsDirty = true;
      this.requestUpdate();
      await this.updateComplete;
      return;
    }

    this.#refreshCount++;
    this.requestUpdate();
    await this.updateComplete;
    await this.#loader.whenSettled();
    await this.updateComplete;
  }

  /**
   * Applies changes to the loaded rows of `dataSource` without reloading
   * everything: `update` replaces items by key in place (no re-sorting nor
   * re-filtering, as the reference `push`), `remove` takes rows out, `add`
   * appends at the end. With remote paging or grouping, `update` patches the
   * loaded blocks and `add`/`remove` reload the shown rows. Selection, focus
   * and group expansion are kept. `update`/`remove` need `keyExpr`. With
   * `items` it does nothing (warning): set a new `items` array instead —
   * rows keep their state by key.
   */
  applyChanges<TItem = any>(changes: GridDataChanges<TItem>): void {
    if (!this.#dataSource) {
      console.warn('<u-grid>: applyChanges() works with "dataSource"; with "items", set a new array (rows keep their state by keyExpr).');
      return;
    }

    const add = changes?.add ?? [];
    const update = changes?.update ?? [];
    const remove = changes?.remove ?? [];

    if ((update.length || remove.length) && !this.#keyExpr) {
      console.error('<u-grid>: applyChanges() needs "keyExpr" to update or remove rows.');
      return;
    }

    this.#ensureRows();

    if (!this.#lazy) {
      this.#applyLocalChanges(add, new Map(update.map(item => [this.#baseKeyOf(item), item])), new Set(remove));
      return;
    }

    const generation = this.#loader.current;

    if (update.length && generation) {
      const keyOf = this.#keyOf;

      if (generation.updateItems(keyOf, new Map(update.map(item => [keyOf(item), item])))) {
        this.requestUpdate();
      }
    }

    if (add.length || remove.length) {
      this.#refreshCount++;
      this.requestUpdate();
    }
  }

  /**
   * Number of data rows: with `items` or a single-load `dataSource`, the
   * rows that pass the filter; with remote paging or grouping, the server
   * total (`-1` while unknown, e.g. infinite scrolling).
   */
  getTotalCount(): number {
    this.#ensureRows();
    return this.#totalCount;
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

  /** Items of the selected keys that are loaded (all of `items`; with a remote source, the loaded blocks), in selection order. */
  getSelectedItems(): any[] {
    if (!this.#selection.size) {
      return [];
    }

    this.#ensureRows();

    const byKey = new Map<unknown, unknown>();

    for (const item of this.#loadedItems()) {
      const key = this.#keyOf(item);

      if (this.#selection.has(key) && !byKey.has(key)) {
        byKey.set(key, item);
      }
    }

    return this.#selection.keys.filter(key => byKey.has(key)).map(key => byKey.get(key));
  }

  /**
   * Scrolls to the cell of the row `rowKey` and `column` (default: the first
   * visible column) and moves the DOM focus to it. Returns `false` when the
   * row is not in the grid (filtered out or in a collapsed group — groups are
   * not expanded) or `column` is not a visible, ungrouped column (a band
   * returns `false`). Before the
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

  // ------------------------------------------------------------- edição

  /** Mudanças pendentes por chave de linha (o grid nunca muta o item do hospedeiro). */
  readonly #edits = new EditStore();
  /** Editor aberto: uma célula (célula/lote) ou a linha inteira (modo linha). */
  #editor: OpenEditor | null = null;
  /** Linhas novas ainda não salvas: chave provisória → onde aparecem. */
  readonly #added = new Map<unknown, AddedAnchor>();
  #addedSeq = 0;
  /** Item exibido de uma linha nova → chave provisória (o `keyOf` delas). */
  readonly #addedItemKeys = new WeakMap<object, unknown>();
  /** Validações assíncronas em curso, por linha e coluna (corrida: a resposta velha é abortada). */
  readonly #validations = new Map<PendingRow, Map<GridColumnDef, AbortController>>();
  /** Promessas das validações em curso (salvar espera por elas). */
  readonly #validationPromises = new Set<Promise<unknown>>();
  #saving: Promise<boolean> | null = null;
  /** Salvando há mais de 1 s: "Salvando…" visível e anunciado. */
  #savingSlow = false;
  #savingTimer: ReturnType<typeof setTimeout> | undefined;
  /** Confirmação esperando validação assíncrona há mais de 1 s: "Validando…" anunciado. */
  #validatingTimer: ReturnType<typeof setTimeout> | undefined;
  /** Mensagem persistente da barra (erro ao salvar, linhas inválidas). */
  #editStatus = '';
  /** Confirmação de exclusão aberta. */
  #removeDialog: { rowKey: unknown; returnFocus: HTMLElement | null } | null = null;
  readonly #removeDialogRef: Ref<HTMLDialogElement> = createRef();
  /** Linhas com as novas inseridas (reaproveitada enquanto nada muda). */
  #withAdded: { base: Rows; version: number; rows: Rows } | undefined;
  #warnedEditingKey = false;
  /** Mensagem do editor `HTMLElement` (light DOM: o `aria-describedby` dele não alcança o shadow). */
  #lightMessage: HTMLElement | undefined;
  /** O clique que mudou a caixa do editor booleano (alterna e confirma num passo). */
  #checkboxPointer = false;

  /**
   * Opens the editor of a cell (focus goes to it). In `row` mode it opens the
   * whole row with the focus on that cell. Returns `false` when the row is
   * not in the grid, the cell is not editable, a save is running or
   * `u-grid-edit-starting` was canceled.
   */
  editCell(rowKey: unknown, column: GridColumnDef): boolean {
    this.#ensureRows();
    const index = this.#rowIndexOfKey(rowKey);
    return index >= 0 && this.#startEdit(index, column, 'api');
  }

  /** Opens a whole row for editing (`editMode="row"` only; `false` otherwise or as `editCell`). */
  editRow(rowKey: unknown): boolean {
    if (this.editMode !== 'row') {
      return false;
    }

    this.#ensureRows();
    const index = this.#rowIndexOfKey(rowKey);
    return index >= 0 && this.#startEdit(index, null, 'api');
  }

  /**
   * Adds a new row at the top of the visible rows (of the current page with
   * `paging`) and opens its first editable cell. `data` gives initial values
   * (also editable in `u-grid-row-adding`). Returns the opaque provisional key
   * of the row (focus and selection move to the real key when it is saved),
   * or `null` without `allowAdding`, during a save or when canceled.
   */
  addRow<TItem = any>(data: Partial<TItem> = {}): unknown {
    return this.#addRow(data, 'api', null);
  }

  /**
   * Deletes a row: in `cell` and `row` modes it is saved at once
   * (`u-grid-saving`); in `batch` mode it is marked for removal. Never asks
   * for confirmation. Resolves `false` when nothing was removed (row not
   * found, `u-grid-row-removing` or `u-grid-saving` canceled, save failed).
   */
  removeRow(rowKey: unknown): Promise<boolean> {
    return this.#removeRowNow(rowKey, 'api');
  }

  /** Restores a row marked for removal (`editMode="batch"`). */
  restoreRow(rowKey: unknown): void {
    this.#restoreRow(rowKey, 'api');
  }

  /**
   * Commits the open editor, validates and saves every pending change
   * (`u-grid-row-validating`, `u-grid-saving`, `u-grid-save`). Resolves
   * `true` when saved (or nothing was pending).
   */
  saveChanges(): Promise<boolean> {
    return this.#save('api');
  }

  /** Closes the editor and discards every pending change (`u-grid-edit-cancel` when there was any). */
  discardChanges(): void {
    this.#discard('api');
  }

  /** Whether there are pending changes (or an editor with a changed value). */
  hasChanges(): boolean {
    return this.#edits.size > 0 || !!this.#editor?.drafts.size;
  }

  /** The pending changes, in the order they started (copies). The value of an open editor is not included until committed. */
  getChanges(): GridEditChange[] {
    return [...this.#edits.values()].map(publicChange);
  }

  /** Há edição ligada (alguma permissão e, com `dataSource`, `keyExpr`)? */
  get #editingOn(): boolean {
    if (!this.allowEditing && !this.allowAdding && !this.allowRemoving) {
      return false;
    }

    if (this.#dataSource && !this.#keyExpr) {
      if (!this.#warnedEditingKey) {
        this.#warnedEditingKey = true;
        console.error('<u-grid>: editing with "dataSource" needs "keyExpr"; editing is off.');
      }

      return false;
    }

    return true;
  }

  get #editMode(): GridEditMode {
    const mode = this.editMode;
    return mode === 'row' || mode === 'batch' ? mode : 'cell';
  }

  #canEditItem(item: unknown): boolean {
    const allow = this.allowEditing;
    return typeof allow === 'function' ? !!allow(item) : !!allow;
  }

  #canRemoveItem(item: unknown): boolean {
    const allow = this.allowRemoving;
    return typeof allow === 'function' ? !!allow(item) : !!allow;
  }

  /** Coluna dos botões da linha: excluir, ou editar/salvar/cancelar no modo linha. */
  get #showCommandColumn(): boolean {
    return this.#editingOn && (!!this.allowRemoving || (this.#editMode === 'row' && (!!this.allowEditing || this.allowAdding)));
  }

  /** Mudança pendente da linha renderizada. */
  #pendingOf(row: DataRow): PendingRow | undefined {
    return this.#edits.size ? this.#edits.get(this.#keyOf(row.item)) : undefined;
  }

  /** A linha é editável (pela permissão), sem olhar a coluna. */
  #rowEditable(row: DataRow, pending = this.#pendingOf(row)): boolean {
    if (!this.#editingOn || row.skeleton || pending?.type === 'remove') {
      return false;
    }

    return pending?.type === 'add' ? this.allowAdding : this.#canEditItem(row.item);
  }

  #cellEditable(row: DataRow, column: GridColumnDef, pending = this.#pendingOf(row)): boolean {
    return isColumnEditable(column) && this.#rowEditable(row, pending);
  }

  /** Todas as colunas (comuns, ocultas e agrupadas). */
  #allEditColumns(): GridColumnDef[] {
    return [...this._regularColumns, ...this._groupColumns];
  }

  /** Item original da linha (o que `u-grid-edit-starting` e as regras recebem). */
  #originalOf(row: DataRow, pending: PendingRow | undefined): unknown {
    return pending ? pending.item : row.item;
  }

  /** O editor está aberto nesta célula? */
  #isEditingCell(rowKey: unknown, column: GridColumnDef, pending: PendingRow | undefined, row: DataRow): boolean {
    const editor = this.#editor;

    if (!editor || editor.rowKey !== rowKey) {
      return false;
    }

    return editor.wholeRow ? this.#cellEditable(row, column, pending) : editor.column === column;
  }

  // --------------------------------------------- abrir, confirmar, cancelar

  #startEdit(
    rowIndex: number,
    column: GridColumnDef | null,
    source: GridChangeSource,
    { focus = true, returnFocus = null }: { focus?: boolean; returnFocus?: HTMLElement | null } = {},
  ): boolean {
    if (this.#saving) {
      return false;
    }

    const row = this.#rowAt(rowIndex);

    if (!isDataRow(row) || row.skeleton) {
      return false;
    }

    const wholeRow = this.#editMode === 'row';
    const pending = this.#pendingOf(row);
    let target = column;

    if (target && !this.#cellEditable(row, target, pending)) {
      if (!wholeRow) {
        return false;
      }

      target = null;
    }

    if (wholeRow) {
      if (!this.#rowEditable(row, pending)) {
        return false;
      }

      target ??= this._visibleColumns.find(candidate => this.#cellEditable(row, candidate, pending)) ?? null;

      if (!target) {
        return false;
      }
    } else if (!target) {
      return false;
    }

    const rowKey = this.#keyOf(row.item);
    const open = this.#editor;

    if (open && open.rowKey === rowKey && (open.wholeRow || open.column === target)) {
      // Já aberto: só leva o foco à célula pedida.
      open.column = target;
      open.focus = focus;
      this.#setActive({ row: rowIndex, col: this.#currentNavColumns().indexOf(target) }, null, { reveal: true });
      return true;
    }

    if (open) {
      // Trocar de célula: confirma a anterior; inválida (célula/linha) fica onde está.
      if (this.#commitEditor() === false && !open.wholeRow && this.#editMode !== 'batch') {
        open.focus = true;
        this.requestUpdate();
        return false;
      }

      this.#closeEditor();
    }

    if (!this.dispatchEvent(new CustomEvent('u-grid-edit-starting', {
      ...this.#eventInit<GridEditStartingEventDetail>({ rowKey, item: this.#originalOf(row, pending), column: source === 'api' && wholeRow && !column ? null : target, source }),
      cancelable: true,
    }))) {
      return false;
    }

    this.#editStatus = '';
    this.#editor = {
      rowKey,
      column: target,
      wholeRow,
      drafts: new Map(),
      texts: new Map(),
      snapshot: pending ? snapshotOf(pending) : null,
      focus,
      returnFocus,
      session: {},
      seq: 0,
    };

    const col = this.#currentNavColumns().indexOf(target);
    this.#setActive({ row: rowIndex, col: col >= 0 ? col : this.#activeCol }, source, { reveal: true });
    this.requestUpdate();
    return true;
  }

  /**
   * Grava os rascunhos do editor aberto na mudança da linha e valida.
   * `true` válido, `false` inválido, promessa quando há regra assíncrona.
   */
  #commitEditor(): boolean | Promise<boolean> {
    const editor = this.#editor;

    if (!editor?.drafts.size) {
      return editor ? !this.#hasErrors(editor.rowKey, editor.wholeRow ? null : editor.column) : true;
    }

    const pending = this.#pendingForKey(editor.rowKey);

    if (!pending) {
      editor.drafts.clear();
      return true;
    }

    const results: (ValidationResult | Promise<ValidationResult>)[] = [];

    for (const [column, value] of editor.drafts) {
      results.push(this.#writeCell(pending, column, value));
    }

    editor.drafts.clear();
    editor.texts.clear();
    this.#edits.prune(pending);
    this.requestUpdate();

    const async = results.filter((result): result is Promise<ValidationResult> => isPromiseLike(result));

    if (!async.length) {
      return !results.some(Boolean) && !this.#hasErrors(editor.rowKey, editor.wholeRow ? null : editor.column);
    }

    return Promise.all(async).then(() => !this.#hasErrors(editor.rowKey, editor.wholeRow ? null : editor.column));
  }

  /** Linha pendente da chave (cria a de `update` pelo item carregado). */
  #pendingForKey(rowKey: unknown): PendingRow | undefined {
    const found = this.#edits.get(rowKey);

    if (found) {
      return found;
    }

    const index = this.#rowIndexOfKey(rowKey);
    const row = this.#rowAt(index);

    return isDataRow(row) && !row.skeleton ? this.#edits.ensure(rowKey, row.item) : undefined;
  }

  /** Erros na linha (`column` nula = qualquer coluna ou da linha). */
  #hasErrors(rowKey: unknown, column: GridColumnDef | null): boolean {
    const pending = this.#edits.get(rowKey);

    if (!pending) {
      return false;
    }

    return column ? pending.errors.has(column) : pending.errors.size > 0 || !!pending.rowError;
  }

  /** Grava um valor na mudança da linha e valida a célula. */
  #writeCell(pending: PendingRow, column: GridColumnDef, value: unknown): ValidationResult | Promise<ValidationResult> {
    if (value instanceof UnparsedValue) {
      pending.unparsed.set(column, value);
    } else {
      const original = getCellValue(pending.item, column);
      pending.unparsed.delete(column);

      if (!pending.modified.has(column) && sameEditValue(original, value)) {
        this.#edits.touch(pending);
        return this.#validateCell(pending, column, value);
      }

      if (column.valueSetter) {
        column.valueSetter(pending.data as never, value, pending.item);
      } else if (column.path) {
        setValueByPath(pending.data, column.path, value);
      }
    }

    pending.modified.add(column);
    this.#edits.touch(pending);
    return this.#validateCell(pending, column, value);
  }

  /** Valor atual da célula na linha pendente (com o que já foi editado). */
  #pendingValue(pending: PendingRow, column: GridColumnDef): unknown {
    return pending.unparsed.get(column) ?? getCellValue(this.#edits.mergedOf(pending), column);
  }

  #validateCell(pending: PendingRow, column: GridColumnDef, value: unknown): ValidationResult | Promise<ValidationResult> {
    let byColumn = this.#validations.get(pending);
    byColumn?.get(column)?.abort();

    const controller = new AbortController();
    const translation = this.#translation;
    const ctx: GridValidationContext = { value, item: pending.item, data: pending.data, column, rowKey: pending.rowKey };
    const result = validateValue(column.validationRules, ctx, translation, bound => this.#formatBound(bound, column), controller.signal);

    if (!isPromiseLike(result)) {
      byColumn?.delete(column);
      this.#setCellError(pending, column, result);
      return result;
    }

    if (!byColumn) {
      byColumn = new Map();
      this.#validations.set(pending, byColumn);
    }

    byColumn.set(column, controller);
    this.#edits.touch();
    this.requestUpdate();

    // Abortada (valor novo, edição fechada): para de esperar já, mesmo que a promessa do hospedeiro nunca resolva.
    const aborted = new Promise<null>(resolve => {
      controller.signal.addEventListener('abort', () => resolve(null), { once: true });
    });
    const promise = Promise.race([result, aborted]).then(outcome => {
      this.#validationPromises.delete(promise);

      if (controller.signal.aborted) {
        return null;
      }

      byColumn.delete(column);

      if (!byColumn.size) {
        this.#validations.delete(pending);
      }

      this.#setCellError(pending, column, outcome);
      this.#edits.touch();
      this.requestUpdate();

      // A resposta chegou com o foco em outra célula: anuncia com contexto.
      if (outcome && !this.#isActiveCell(pending.rowKey, column)) {
        this.#announce(`${column.label ?? ''}: ${outcome.message}`);
      }

      return outcome;
    });

    this.#validationPromises.add(promise);
    return promise;
  }

  #isValidating(pending: PendingRow, column: GridColumnDef): boolean {
    return !!this.#validations.get(pending)?.has(column);
  }

  #isActiveCell(rowKey: unknown, column: GridColumnDef): boolean {
    const row = this.#rowAt(this.#activeRowIndex);
    return isDataRow(row) && this.#keyOf(row.item) === rowKey && this.#activeColumn === column;
  }

  #setCellError(pending: PendingRow, column: GridColumnDef, result: ValidationResult): void {
    pending.errorRules.delete(column);

    if (result) {
      pending.errors.set(column, result.message);

      if (typeof result.rule === 'object') {
        pending.errorRules.set(column, result.rule);
      }
    } else {
      pending.errors.delete(column);
    }

    pending.rowError = undefined;
  }

  #formatBound(bound: number | Date, column: GridColumnDef): string {
    if (bound instanceof Date) {
      return getDateTimeFormat(this.language, DEFAULT_DATE).format(bound);
    }

    return this.#dataTypeOf(column) === 'date' || this.#dataTypeOf(column) === 'datetime'
      ? getDateTimeFormat(this.language, DEFAULT_DATE).format(new Date(bound))
      : getNumberFormat(this.language).format(bound);
  }

  /** Fecha o editor (sem gravar); limpa a mensagem do editor do light DOM. */
  #closeEditor(): void {
    if (this.#editor) {
      this.#editor = null;
      this.#lightMessage?.remove();
      this.#lightMessage = undefined;
      this.requestUpdate();
    }
  }

  /** Esc: desfaz o que o editor mudou e devolve o foco à célula (linha nova no modo célula/linha: some). */
  #cancelEditor(source: GridChangeSource): void {
    const editor = this.#editor;

    if (!editor) {
      return;
    }

    const pending = this.#edits.get(editor.rowKey);
    const discarded: GridEditChange[] = [];

    if (pending?.type === 'add' && this.#editMode !== 'batch') {
      discarded.push(publicChange(pending));
      this.#dropPending(pending);
      this.#closeEditor();

      if (editor.returnFocus?.isConnected) {
        editor.returnFocus.focus();
      } else {
        this.#focusPending = true;
      }
    } else {
      if (pending && (editor.wholeRow || this.#editMode !== 'batch')) {
        const before = publicChange(pending);
        const changed = JSON.stringify(before.data ?? null) !== JSON.stringify(editor.snapshot?.data ?? {});
        restoreSnapshot(this.#edits, pending, editor.snapshot);
        this.#abortValidations(pending);

        if (changed && pending.type !== 'remove') {
          discarded.push(before);
        }
      } else if (pending && editor.column) {
        // Lote: a célula volta ao que era antes de abrir; o resto da linha fica.
        restoreCell(this.#edits, pending, editor.column, editor.snapshot);
      }

      this.#closeEditor();
      this.#focusPending = true;
    }

    if (discarded.length) {
      this.dispatchEvent(new CustomEvent('u-grid-edit-cancel', this.#eventInit<GridEditCancelEventDetail>({ changes: discarded, source })));
    }

    this.requestUpdate();
  }

  #abortValidations(pending: PendingRow): void {
    const byColumn = this.#validations.get(pending);

    if (byColumn) {
      byColumn.forEach(controller => controller.abort());
      this.#validations.delete(pending);
    }
  }

  /** Tira a linha pendente (linha nova some das linhas). */
  #dropPending(pending: PendingRow): void {
    this.#abortValidations(pending);
    this.#edits.delete(pending.rowKey);

    if (this.#added.delete(pending.rowKey)) {
      this.#syncKeyOf();
    }
  }

  /**
   * Confirma o editor (Enter, Tab, clique fora). Célula: salva já; inválido
   * (célula/linha) fica aberto. `then` roda quando a validação termina com
   * sucesso (mover o foco).
   */
  #commitAndThen(source: GridChangeSource, then: () => void, { keepOpen = false, blur = false } = {}): void {
    const editor = this.#editor;

    if (!editor) {
      then();
      return;
    }

    const seq = editor.seq;

    const finish = (valid: boolean): void => {
      // Fechou, ou digitou de novo enquanto validava: esta confirmação não vale mais.
      if (this.#editor !== editor || editor.seq !== seq) {
        return;
      }

      if (!valid && this.#editMode !== 'batch' && blur) {
        // O foco já saiu: fecha e a célula fica pendente marcada (inválida).
        this.#closeEditor();
        return;
      }

      if (!valid && this.#editMode !== 'batch') {
        // Fica aberto; a mensagem já está visível e é anunciada.
        const pending = this.#edits.get(editor.rowKey);
        const message = pending && editor.column ? pending.errors.get(editor.column) : undefined;

        if (message) {
          this.#announce(message);
        }

        editor.focus = true;
        this.requestUpdate();
        return;
      }

      if (!keepOpen && !editor.wholeRow) {
        this.#closeEditor();
      }

      if (this.#editMode === 'cell' && !editor.wholeRow && this.#edits.size && !this.#hasAnyError()) {
        // Modo célula: salva já; o foco anda quando terminar — só se salvou e
        // o foco ainda está na célula editada (não rouba o foco de quem saiu).
        const column = editor.column;
        void this.#save(source).then(saved => {
          if (saved && column && this.#isActiveCell(editor.rowKey, column) && this.#hadFocusInGrid()) {
            then();
          }
        });
        return;
      }

      then();
    };

    const result = this.#commitEditor();

    if (isPromiseLike(result)) {
      clearTimeout(this.#validatingTimer);
      this.#validatingTimer = setTimeout(() => {
        this.#validatingTimer = undefined;
        this.#announce(this.#translation.validating);
      }, SLOW_SAVE_DELAY);
      void result.then(valid => {
        clearTimeout(this.#validatingTimer);
        this.#validatingTimer = undefined;
        finish(valid);
      });
    } else {
      finish(result);
    }
  }

  #hasAnyError(): boolean {
    for (const pending of this.#edits.values()) {
      if (pending.errors.size || pending.rowError || pending.unparsed.size) {
        return true;
      }
    }

    return false;
  }

  // ------------------------------------------------- inserir e excluir

  #addRow(data: Record<string, unknown>, source: GridChangeSource, returnFocus: HTMLElement | null): unknown {
    if (!this.#editingOn || !this.allowAdding || this.#saving) {
      return null;
    }

    if (this.#editor && this.#commitEditor() === false && this.#editMode !== 'batch') {
      return null;
    }

    this.#closeEditor();

    const initial = copyData(data && typeof data === 'object' ? data : {});

    if (!this.dispatchEvent(new CustomEvent('u-grid-row-adding', {
      ...this.#eventInit<GridRowAddingEventDetail>({ data: initial, source }),
      cancelable: true,
    }))) {
      return null;
    }

    this.#ensureRows();

    const rowKey = createProvisionalKey();
    // No topo das linhas visíveis (a página atual com `paging`).
    const first = this.#firstVisibleRowIndex();
    const anchorRow = this.#rowAt(Math.min(first, this.#rows.length - 1));
    const anchor: AddedAnchor = {
      seq: ++this.#addedSeq,
      anchorKey: isDataRow(anchorRow) && !anchorRow.skeleton ? this.#keyOf(anchorRow.item) : undefined,
      anchorRowKey: anchorRow && !isDataRow(anchorRow) ? anchorRow.key : undefined,
      fallback: Math.min(first, this.#rows.length),
    };

    this.#added.set(rowKey, anchor);
    const pending = this.#edits.add(rowKey, initial);

    for (const column of this.#allEditColumns()) {
      // Valores iniciais contam como digitados (a marca e a validação na hora de salvar).
      if (column.path && getValueByPath(initial, column.path) !== undefined) {
        pending.modified.add(column);
      }
    }

    this.#syncKeyOf();
    this.#withAdded = undefined;
    this.requestUpdate();
    this.#ensureRows();

    // Abre a 1ª célula editável da linha nova (o foco vai ao editor).
    const index = this.#rowIndexOfKey(rowKey);
    const target = this._visibleColumns.find(column => isColumnEditable(column));
    const opened = index >= 0 && !!target && this.#startEdit(index, target, source, { returnFocus });

    if (!opened) {
      this.#announce(this.#translation.rowAddedAnnouncement);

      if (index >= 0) {
        this.#setActive({ row: index, col: this.#activeCol }, source, { focus: !!returnFocus, reveal: true });
      }
    }

    return rowKey;
  }

  /** 1ª linha renderizada visível abaixo do que é fixo no topo (0 sem layout). */
  #firstVisibleRowIndex(): number {
    const scroller = this._scrollContainerRef.value;
    const rows = this.#tableRef.value?.querySelectorAll<HTMLElement>(':scope > tbody > tr[data-index]:not(.pinned)');

    if (!scroller || !rows?.length) {
      return 0;
    }

    const limit = scroller.getBoundingClientRect().top + this.#stickyTop();

    for (const tr of rows) {
      if (tr.getBoundingClientRect().bottom > limit + 1) {
        return Math.min(Number(tr.getAttribute('data-index')), this.#rows.length);
      }
    }

    return 0;
  }

  /** Botão Excluir: evento, confirmação (célula/linha) e remoção. */
  async #requestRemove(rowKey: unknown, returnFocus: HTMLElement | null): Promise<void> {
    const pending = this.#edits.get(rowKey);

    if (pending?.type === 'add') {
      // Linha nova: não há o que perguntar nem salvar.
      await this.#removeRowNow(rowKey, 'user');
      return;
    }

    if (this.confirmRemove && this.#editMode !== 'batch') {
      const item = this.#itemOfKey(rowKey);

      if (item === undefined || !this.#dispatchRemoving(rowKey, item, 'user')) {
        return;
      }

      this.#removeDialog = { rowKey, returnFocus };
      this.requestUpdate();
      return;
    }

    await this.#removeRowNow(rowKey, 'user');
  }

  #dispatchRemoving(rowKey: unknown, item: unknown, source: GridChangeSource): boolean {
    return this.dispatchEvent(new CustomEvent('u-grid-row-removing', {
      ...this.#eventInit<GridRowRemovingEventDetail>({ rowKey, item, source }),
      cancelable: true,
    }));
  }

  #itemOfKey(rowKey: unknown): unknown {
    const pending = this.#edits.get(rowKey);

    if (pending) {
      return pending.item;
    }

    const row = this.#rowAt(this.#rowIndexOfKey(rowKey));
    return isDataRow(row) && !row.skeleton ? row.item : undefined;
  }

  /** Remove (célula/linha: salva já) ou marca (lote). `skipEvent`: o diálogo já disparou `u-grid-row-removing`. */
  async #removeRowNow(rowKey: unknown, source: GridChangeSource, skipEvent = false): Promise<boolean> {
    if (!this.#editingOn || this.#saving) {
      return false;
    }

    this.#ensureRows();

    const existing = this.#edits.get(rowKey);
    const item = this.#itemOfKey(rowKey);

    if (item === undefined || existing?.type === 'remove') {
      return false;
    }

    // Linha nova sempre sai; as outras seguem `allowRemoving` (também a função por linha).
    if (existing?.type !== 'add' && !this.#canRemoveItem(item)) {
      return false;
    }

    if (!skipEvent && !this.#dispatchRemoving(rowKey, existing?.type === 'add' ? existing.item : item, source)) {
      return false;
    }

    const activeKey = this.#publicFocus().rowKey;
    const wasActive = activeKey === rowKey;

    if (this.#editor?.rowKey === rowKey) {
      this.#closeEditor();
    }

    if (existing?.type === 'add') {
      this.#dropPending(existing);
      this.#withAdded = undefined;
      this.#announce(this.#translation.rowRemovedAnnouncement);
      this.#focusAfterRemoval(wasActive);
      this.requestUpdate();
      return true;
    }

    const pending = this.#edits.ensure(rowKey, item);
    const previous = snapshotOf(pending);
    pending.removedFrom = Object.keys(pending.data).length ? 'update' : undefined;
    pending.type = 'remove';
    this.#abortValidations(pending);
    pending.errors.clear();
    this.#edits.touch(pending);
    this.requestUpdate();

    if (this.#editMode === 'batch') {
      this.#announce(this.#translation.rowMarkedForRemovalAnnouncement);
      return true;
    }

    const saved = await this.#save(source, [pending]);

    if (!saved && this.#edits.get(rowKey) === pending) {
      // Não salvou: a linha volta ao que era.
      restoreSnapshot(this.#edits, pending, previous);
      this.requestUpdate();
    } else if (saved) {
      this.#announce(this.#translation.rowRemovedAnnouncement);
      this.#focusAfterRemoval(wasActive);
    }

    return saved;
  }

  /** Foco depois de excluir: mesma coluna na linha que ficou no lugar (ou a anterior; sem linhas, o cabeçalho). */
  #focusAfterRemoval(wasActive: boolean): void {
    if (!wasActive) {
      return;
    }

    void this.updateComplete.then(() => {
      const rows = this.#rows.length;
      const row = rows ? Math.min(this.#activeRowIndex, rows - 1) : HEADER_ROW;
      this.#setActive({ row, col: this.#activeCol }, null, { focus: true, reveal: true });
    });
  }

  #restoreRow(rowKey: unknown, source: GridChangeSource): void {
    const pending = this.#edits.get(rowKey);

    if (pending?.type !== 'remove') {
      return;
    }

    if (pending.removedFrom) {
      pending.type = pending.removedFrom;
      pending.removedFrom = undefined;
      this.#edits.touch(pending);
    } else {
      this.#edits.delete(rowKey);
    }

    if (source === 'user') {
      this.#announce(this.#translation.rowRestoredAnnouncement);
    }

    this.requestUpdate();
  }

  // --------------------------------------------------- salvar e descartar

  /** Salva as mudanças pendentes (todas, ou `only`). Uma vez por vez. */
  #save(source: GridChangeSource, only?: PendingRow[]): Promise<boolean> {
    if (this.#saving) {
      return this.#saving;
    }

    const run = this.#runSave(source, only).finally(() => {
      this.#saving = null;
      clearTimeout(this.#savingTimer);
      this.#savingTimer = undefined;
      this.#savingSlow = false;
      this.requestUpdate();
    });

    this.#saving = run;
    return run;
  }

  async #runSave(source: GridChangeSource, only?: PendingRow[]): Promise<boolean> {
    const editor = this.#editor;

    if (editor) {
      const committed = this.#commitEditor();

      if (isPromiseLike(committed)) {
        await committed;
      }
    }

    // Validações assíncronas em curso: o resultado conta.
    while (this.#validationPromises.size) {
      await Promise.all([...this.#validationPromises]);
    }

    const rows = (only ?? [...this.#edits.values()]).filter(row => this.#edits.get(row.rowKey) === row);

    if (!rows.length) {
      if (editor?.wholeRow) {
        this.#closeEditor();
      }

      return true;
    }

    // Linhas novas: todas as colunas com regras; alteradas: as editadas.
    const checks: Promise<unknown>[] = [];

    for (const pending of rows) {
      if (pending.type === 'remove') {
        continue;
      }

      for (const column of this.#allEditColumns()) {
        const due = pending.type === 'add' ? !!column.validationRules?.length && !pending.modified.has(column) : false;

        if (due) {
          const result = this.#validateCell(pending, column, this.#pendingValue(pending, column));

          if (isPromiseLike(result)) {
            checks.push(result);
          }
        }
      }
    }

    await Promise.all(checks);

    let invalidRows = 0;

    for (const pending of rows) {
      if (pending.type === 'remove') {
        continue;
      }

      const errors: GridValidationError[] = [];

      for (const [column, message] of pending.errors) {
        errors.push({ column, rule: pending.errorRules.get(column) ?? null, message });
      }

      let rowError: string | undefined;
      const detail: GridRowValidatingEventDetail = {
        rowKey: pending.rowKey,
        item: pending.item,
        change: publicChange(pending),
        errors,
        setError: (message: string, column?: GridColumnDef) => {
          event.preventDefault();

          if (column) {
            pending.errors.set(column, String(message));
            pending.errorRules.delete(column);
          } else {
            rowError = String(message);
          }
        },
        source,
      };
      const event = new CustomEvent('u-grid-row-validating', { ...this.#eventInit(detail), cancelable: true });
      const accepted = this.dispatchEvent(event);
      pending.rowError = rowError ?? (!accepted && !errors.length && pending.errors.size === 0 ? this.#translation.validationInvalid : undefined);

      if (!accepted || pending.errors.size || pending.unparsed.size || pending.rowError) {
        invalidRows++;
      }
    }

    this.#edits.touch();

    if (invalidRows) {
      this.#editStatus = formatMessage(this.#translation.invalidRowsMessage, { count: String(invalidRows) });
      this.#announce(`${this.#editStatus} ${this.#firstErrorText(rows)}`.trim());
      this.#focusFirstInvalid(rows);
      this.requestUpdate();
      return false;
    }

    // Desconectado no meio (validação em curso): não salva nem cria temporizador.
    if (!this.isConnected) {
      return false;
    }

    const changes = rows.map(publicChange);
    const waits: Promise<unknown>[] = [];
    let dispatching = true;
    const savingDetail: GridSavingEventDetail = {
      changes,
      waitUntil: (promise: Promise<void | GridDataChanges>) => {
        if (!dispatching) {
          throw new DOMException('waitUntil() can only be called while u-grid-saving is dispatched.', 'InvalidStateError');
        }

        waits.push(Promise.resolve(promise));
      },
      source,
    };

    const go = this.dispatchEvent(new CustomEvent('u-grid-saving', { ...this.#eventInit(savingDetail), cancelable: true }));
    dispatching = false;

    if (!go) {
      return false;
    }

    let replacement: GridDataChanges | undefined;

    if (waits.length && this.isConnected) {
      this.#savingTimer = setTimeout(() => {
        this.#savingTimer = undefined;
        this.#savingSlow = true;
        this.#announce(this.#translation.saving);
      }, SLOW_SAVE_DELAY);
      this.requestUpdate();

      try {
        const results = await Promise.all(waits);
        replacement = results.find((result): result is GridDataChanges => !!result && typeof result === 'object');
      } catch (error) {
        const text = typeof error === 'string' ? error : error instanceof Error && error.message ? error.message : '';
        this.#editStatus = text ? `${this.#translation.saveError} ${text}` : this.#translation.saveError;
        this.#announce(this.#editStatus);
        this.dispatchEvent(new CustomEvent('u-grid-save-error', this.#eventInit<GridSaveErrorEventDetail>({ changes, error, source })));
        this.requestUpdate();
        return false;
      }
    }

    if (!this.isConnected && !this.hasUpdated) {
      return false;
    }

    const items = this.#applySaved(rows, replacement);

    for (const pending of rows) {
      this.#dropPending(pending);
    }

    if (this.#editor && rows.some(row => row.rowKey === this.#editor?.rowKey)) {
      this.#closeEditor();
      this.#focusPending = this.#hadFocusInGrid();
    }

    this.#withAdded = undefined;
    this.#editStatus = '';
    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('u-grid-save', this.#eventInit<GridSaveEventDetail>({ changes, items, source })));

    if (!(rows.length === 1 && rows[0].type === 'remove')) {
      this.#announce(this.#translation.changesSavedAnnouncement);
    }

    return true;
  }

  #hadFocusInGrid(): boolean {
    return !!this.shadowRoot?.activeElement;
  }

  /** Texto do 1º erro (anúncio do salvar barrado): "Coluna: mensagem". */
  #firstErrorText(rows: PendingRow[]): string {
    for (const pending of rows) {
      if (pending.rowError) {
        return pending.rowError;
      }

      const [entry] = pending.errors;

      if (entry) {
        return `${entry[0].label ?? ''}: ${entry[1]}`;
      }

      const [unparsed] = pending.unparsed;

      if (unparsed) {
        return unparsed[0].label ?? '';
      }
    }

    return '';
  }

  /** Foco na 1ª célula inválida (abre o editor no modo célula/linha). */
  #focusFirstInvalid(rows: PendingRow[]): void {
    for (const pending of rows) {
      const column = this._visibleColumns.find(candidate => pending.errors.has(candidate) || pending.unparsed.has(candidate));
      const index = this.#rowIndexOfKey(pending.rowKey);

      if (index < 0) {
        continue;
      }

      if (column && this.#editMode !== 'batch') {
        if (!this.#editor || this.#editor.rowKey !== pending.rowKey) {
          this.#startEdit(index, column, 'user');
        } else {
          this.#editor.column = column;
          this.#editor.focus = true;
          this.#setActive({ row: index, col: this.#currentNavColumns().indexOf(column) }, null, { reveal: true });
        }
      } else {
        // Sem coluna à vista (erro da linha ou de coluna oculta): a 1ª célula, que mostra o erro da linha.
        const col = column ? this.#currentNavColumns().indexOf(column) : this.#leadingColumns;
        this.#setActive({ row: index, col }, 'user', { focus: true, reveal: true });
      }

      return;
    }
  }

  /**
   * Aplica o que foi salvo: `dataSource` por `applyChanges`; `items` numa
   * cópia do array (o do hospedeiro fica intacto). Devolve a cópia (`items`).
   */
  #applySaved(rows: PendingRow[], replacement: GridDataChanges | undefined): unknown[] | null {
    const keyed = !!this.#keyExpr;
    const add: unknown[] = [];
    const updates = new Map<unknown, unknown>();
    const remove: unknown[] = [];
    // Linha nova → item salvo (o foco e a seleção vão para a chave real).
    const addedItems = new Map<unknown, unknown>();
    // Chave → item velho das alteradas (troca no lugar, sem varrer 1 milhão de chaves).
    const originals = new Map<unknown, unknown>();

    if (replacement) {
      add.push(...replacement.add ?? []);
      remove.push(...replacement.remove ?? []);

      for (const item of replacement.update ?? []) {
        updates.set(this.#baseKeyOf(item), item);
      }

      const newRows = rows.filter(row => row.type === 'add');
      (replacement.add ?? []).forEach((item, index) => {
        if (newRows[index]) {
          addedItems.set(newRows[index].rowKey, item);
        }
      });
    } else {
      for (const pending of rows) {
        if (pending.type === 'remove') {
          remove.push(pending.rowKey);
        } else if (pending.type === 'add') {
          const item = copyData(pending.data);
          add.push(item);
          addedItems.set(pending.rowKey, item);
        } else {
          updates.set(pending.rowKey, this.#edits.mergedOf(pending));
          originals.set(pending.rowKey, pending.item);
        }
      }
    }

    // A célula ativa numa linha nova passa para o item salvo.
    const activeKey = this.#activeRef && 'key' in this.#activeRef ? this.#activeRef.key : undefined;
    const savedActive = activeKey === undefined ? undefined : addedItems.get(activeKey);

    for (const pending of rows) {
      if (pending.type === 'add') {
        this.#added.delete(pending.rowKey);
      }
    }

    this.#syncKeyOf();
    this.#withAdded = undefined;

    if (this.#dataSource) {
      this.applyChanges({ add, update: [...updates.values()], remove });
    } else {
      this.#ensureRows();
      this.#applyLocalChanges(add, updates, new Set(remove), originals);
      this.#hostItems = this.#items;

      if (!keyed) {
        this.#migrateObjectKeys(updates, new Set(remove));
      }
    }

    if (savedActive !== undefined) {
      this.#activeRef = { key: this.#keyOf(savedActive) };
    }

    return this.#dataSource ? null : this.#items as unknown[];
  }

  /** Sem `keyExpr` a chave é o objeto: seleção, expansão e foco passam do item velho para o novo. */
  #migrateObjectKeys(updates: ReadonlyMap<unknown, unknown>, removed: ReadonlySet<unknown>): void {
    if (this.#selection.size) {
      const keys = this.#selection.keys
        .filter(key => !removed.has(key))
        .map(key => updates.get(key) ?? key);
      this.#selection.replace(keys);
    }

    for (const [previous, next] of updates) {
      if (this.#rowExpansion.delete(previous)) {
        this.#rowExpansion.add(next);
      }
    }

    if (this.#activeRef && 'key' in this.#activeRef && updates.has(this.#activeRef.key)) {
      this.#activeRef = { key: updates.get(this.#activeRef.key) };
    }
  }

  #discard(source: GridChangeSource): void {
    const changes = this.getChanges();
    const hadEditor = !!this.#editor;

    for (const pending of [...this.#edits.values()]) {
      this.#dropPending(pending);
    }

    this.#edits.clear();
    this.#added.clear();
    this.#syncKeyOf();
    this.#withAdded = undefined;
    this.#editStatus = '';

    if (hadEditor) {
      this.#closeEditor();
      this.#focusPending = this.#hadFocusInGrid();
    }

    this.requestUpdate();

    if (changes.length) {
      this.dispatchEvent(new CustomEvent('u-grid-edit-cancel', this.#eventInit<GridEditCancelEventDetail>({ changes, source })));

      if (source === 'user') {
        this.#announce(formatMessage(this.#translation.changesDiscardedAnnouncement, { count: String(changes.length) }));
      }
    }
  }

  /** `items` trocado: ficam as pendências de chaves presentes; o resto sai (`u-grid-edit-cancel`, api). */
  #reconcileEdits(items: readonly unknown[]): void {
    if (!this.#edits.size) {
      return;
    }

    const byKey = new Map<unknown, unknown>();

    for (const item of items) {
      byKey.set(this.#baseKeyOf(item), item);
    }

    const dropped: GridEditChange[] = [];

    for (const pending of [...this.#edits.values()]) {
      if (pending.type === 'add') {
        continue;
      }

      if (byKey.has(pending.rowKey)) {
        pending.item = byKey.get(pending.rowKey);
        this.#edits.touch(pending);
      } else {
        dropped.push(publicChange(pending));

        if (this.#editor?.rowKey === pending.rowKey) {
          this.#closeEditor();
        }

        this.#dropPending(pending);
      }
    }

    if (dropped.length) {
      this.dispatchEvent(new CustomEvent('u-grid-edit-cancel', this.#eventInit<GridEditCancelEventDetail>({ changes: dropped, source: 'api' })));
    }
  }

  /** `#keyOf` reconhece as linhas novas enquanto houver alguma. */
  #syncKeyOf(): void {
    const base = this.#baseKeyOf;

    if (!this.#added.size) {
      this.#keyOf = base;
      return;
    }

    const keys = this.#addedItemKeys;
    this.#keyOf = item => (item && typeof item === 'object' && keys.get(item)) || base(item);
  }

  /** Linhas com as novas no lugar delas (topo da janela visível quando foram adicionadas). */
  #rowsWithAdded(base: Rows): Rows {
    if (!this.#added.size) {
      this.#withAdded = undefined;
      return base;
    }

    const cached = this.#withAdded;

    if (cached?.base === base && cached.version === this.#edits.version) {
      return cached.rows;
    }

    const keyOf = this.#keyExpr ? this.#baseKeyOf : undefined;
    const added: AddedRow[] = [];

    for (const [rowKey, anchor] of this.#added) {
      const pending = this.#edits.get(rowKey);

      if (!pending) {
        continue;
      }

      const item = this.#edits.mergedOf(pending) as object;
      this.#addedItemKeys.set(item, rowKey);

      let position = anchor.anchorKey !== undefined ? base.indexOfDataKey(anchor.anchorKey, keyOf) : -1;

      if (position < 0 && anchor.anchorRowKey) {
        position = base.indexOfKey(anchor.anchorRowKey);
      }

      added.push({
        position: position >= 0 ? position : Math.min(anchor.fallback, base.length),
        rowKey,
        row: { isGroup: false, key: `n:${anchor.seq}`, item, index: 0 },
      });
    }

    // Mais nova primeiro na mesma posição (como a referência: a nova fica no topo).
    added.sort((a, b) => a.position - b.position || (this.#added.get(b.rowKey)!.seq - this.#added.get(a.rowKey)!.seq));

    const rows = new RowsWithAdded(base, added);
    this.#withAdded = { base, version: this.#edits.version, rows };
    return rows;
  }

  /** Depois do render: diálogo, foco no editor e ARIA do editor `HTMLElement`. */
  #afterEditRender(): void {
    const dialog = this.#removeDialogRef.value;

    if (this.#removeDialog && dialog && !dialog.open && dialog.isConnected) {
      dialog.showModal();
    }

    const editor = this.#editor;

    if (!editor) {
      return;
    }

    if (!this.#editingOn) {
      this.#closeEditor();
      return;
    }

    if (this.#rowIndexOfKey(editor.rowKey) < 0) {
      // A linha saiu (filtro, troca de dados): o que foi digitado fica pendente.
      void this.#commitEditor();
      this.#closeEditor();
      return;
    }

    const cell = this.#editorCell(editor);
    const target = cell && (cell.querySelector<HTMLElement>(':scope > .cell-editor') ?? focusTargetsWithin(cell)[0]);

    if (target instanceof HTMLElement && target.getRootNode() !== this.shadowRoot) {
      this.#describeLightEditor(target, editor);
    }

    if (!editor.focus || !(target instanceof HTMLElement || target instanceof SVGElement)) {
      return;
    }

    editor.focus = false;
    target.focus({ preventScroll: true });

    // Cursor no fim do texto (como a referência).
    if (target instanceof HTMLInputElement && (target.type === 'text' || target.type === 'search')) {
      const end = target.value.length;
      target.setSelectionRange(end, end);
    }
  }

  /** Célula do editor (a da coluna dele; no modo linha, a ativa se for da linha). */
  #editorCell(editor: OpenEditor): HTMLElement | null {
    const index = this.#rowIndexOfKey(editor.rowKey);
    const col = editor.column ? this.#currentNavColumns().indexOf(editor.column) : -1;
    const tr = this.#tableRef.value?.querySelector<HTMLElement>(`:scope > tbody > tr[data-index="${index}"]`);
    return tr?.querySelector<HTMLElement>(`:scope > td.editing[data-col="${col}"]`) ?? tr?.querySelector<HTMLElement>(':scope > td.editing') ?? null;
  }

  /**
   * Editor `HTMLElement` (light DOM): o `aria-describedby` dele não alcança o
   * shadow do grid. O grid põe a mensagem num elemento do light DOM e
   * completa o rótulo e o estado de erro, se faltarem.
   */
  #describeLightEditor(target: HTMLElement, editor: OpenEditor): void {
    const pending = this.#edits.get(editor.rowKey);
    const column = editor.column;
    const error = pending && column ? pending.errors.get(column) : undefined;

    if (column?.label && !target.hasAttribute('aria-label') && !target.hasAttribute('aria-labelledby')) {
      target.setAttribute('aria-label', column.label);
    }

    const ids = (target.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
    const messageId = this.#lightMessage?.id;

    if (!error) {
      if (messageId && ids.includes(messageId)) {
        const rest = ids.filter(id => id !== messageId);

        if (rest.length) {
          target.setAttribute('aria-describedby', rest.join(' '));
        } else {
          target.removeAttribute('aria-describedby');
        }
      }

      target.removeAttribute('aria-invalid');
      return;
    }

    if (!this.#lightMessage) {
      this.#lightMessage = document.createElement('div');
      this.#lightMessage.id = `u-grid-${++lightMessageCount}-edit-message`;
      // Sem slot correspondente: não aparece, mas serve de descrição.
      this.#lightMessage.slot = 'u-grid-internal:edit-message';
      this.append(this.#lightMessage);
    }

    this.#lightMessage.textContent = error;
    target.setAttribute('aria-invalid', 'true');

    // Acrescenta à descrição do hospedeiro (não troca).
    if (!ids.includes(this.#lightMessage.id)) {
      target.setAttribute('aria-describedby', [...ids, this.#lightMessage.id].join(' '));
    }
  }

  /** Libera o que a edição segura (desconectado): validações, temporizador, editor do light DOM. */
  #releaseEditing(): void {
    for (const pending of [...this.#validations.keys()]) {
      this.#abortValidations(pending);
    }

    this.#validationPromises.clear();
    clearTimeout(this.#savingTimer);
    this.#savingTimer = undefined;
    clearTimeout(this.#validatingTimer);
    this.#validatingTimer = undefined;
    this.#lightMessage?.remove();
    this.#lightMessage = undefined;
    this.#removeDialog = null;
  }

  // ---------------------------------------------------------- exportação

  /**
   * The columns and rows the user sees, ready to build any file (Excel, PDF):
   * visible exportable columns in the current order, filter, sorting, groups
   * (collapsed ones included) and summaries. The state is read when called;
   * rows are built in time slices, so a million rows do not freeze the page.
   * With a `dataSource` whose server pages or groups, only the rows already
   * loaded are exported (in screen order, without group rows; totals from the
   * server): ask the server for the full file instead.
   */
  async getExportData(options: GridExportOptions = {}): Promise<GridExportData> {
    const source = this.#exportSource(options);
    const rows = await collectRows(source, options.signal);

    return { columns: source.columns.map(column => column.info), rows };
  }

  /**
   * CSV (RFC 4180) of what the user sees (see `getExportData`): formatted
   * texts, UTF-8 with BOM, `;` as separator in languages with a decimal
   * comma, cells that a spreadsheet would run as formulas prefixed with `'`.
   */
  async exportCsv(options: GridCsvOptions = {}): Promise<Blob> {
    return writeCsv(this.#exportSource(options), options, this.language);
  }

  /** Builds the CSV (`exportCsv`) and downloads it as `fileName` (default `export.csv`). */
  async downloadCsv(options: GridCsvDownloadOptions = {}): Promise<void> {
    downloadBlob(await this.exportCsv(options), options.fileName || 'export.csv');
  }

  /** Instantâneo do que o usuário vê, para os escritores de `src/export/`. */
  #exportSource(options: GridExportOptions): ExportSource {
    options.signal?.throwIfAborted();
    this.#ensureRows();

    const includeGroups = options.includeGroups !== false;
    const includeSummaries = options.includeSummaries !== false;
    const lazy = this.#lazy;
    // Sem linhas de grupo (lista plana ou fonte remota): a coluna agrupada vira coluna.
    const columns = [...includeGroups && !lazy ? [] : this._groupColumns, ...this._visibleColumns]
      .filter(isColumnExportable)
      .map(column => this.#exportColumn(column));
    // Fonte remota com paginação ou grupos no servidor: só as linhas JÁ
    // carregadas, na ordem da tela e sem linhas de grupo (os grupos remotos
    // não têm os itens); os totais são os do servidor (os do rodapé).
    let items: readonly unknown[] = lazy ? this.#loader.current?.loadedInOrder() ?? [] : this.#sortedItems;
    let groups = lazy ? [] : this.#groups;
    let totals = this.#totals;

    if (options.selectedOnly) {
      // Na ordem e no filtro atuais; grupos e resumos recalculados sobre as selecionadas.
      const keyOf = this.#keyOf;
      items = items.filter(item => this.#selection.has(keyOf(item)));
      groups = this._groupColumns.length && !lazy ? this.#buildGroupsOf(items) : [];
      totals = includeSummaries && this.#totalSpecs.length ? summarize(items, this.#totalSpecs.map(({ spec }) => spec)) : [];
    }

    const translation = this.#translation;
    const listSeparator = this.#listSeparatorText;
    const countFormat = getNumberFormat(this.language, { maximumFractionDigits: 0 });

    return {
      columns,
      items,
      groups,
      includeGroups,
      includeSummaries,
      groupSummaries: this.#groupSpecs.map(summary => this.#exportSummary(summary)),
      totalSummaries: this.#totalSpecs.map(summary => this.#exportSummary(summary)),
      totals,
      listSeparator,
      groupValueText: node => this.#groupValueText({ column: node.column, value: node.value, firstItem: node.items[0] }),
      groupLabel: (node, valueText, extra) => {
        const parts = this.showGroupCount ? [countFormat.format(node.items.length), ...extra] : [...extra];
        const info = parts.length ? ` ${formatMessage(translation.groupInfoText, { info: parts.join(listSeparator) })}` : '';

        return `${node.column.label ?? ''}${translation.groupLabelSeparator}${valueText}${info}`;
      },
    };
  }

  #exportColumn(column: GridColumnDef): ExportColumnSource {
    const dataType = this.#dataTypeOf(column);
    const context = this.#formatContext(column);

    return {
      info: {
        column,
        label: column.label ?? '',
        dataType,
        alignment: resolveAlignment(column, dataType),
        width: this.#widthOf(column) ?? this.#renderedWidths.get(column),
      },
      read: cellValueReader(column),
      text: (value, item) => formatCellValue(value, item, column, context),
      builtIn: !column.displayValue && typeof column.format !== 'function',
    };
  }

  #exportSummary(summary: ResolvedSummary): ExportSummarySource {
    return {
      item: summary.item,
      column: summary.spec.column,
      value: raw => this.#summaryValue(summary, raw),
      text: raw => this.#summaryText(summary, raw),
    };
  }

  /**
   * Ctrl/Cmd+C (evento nativo `copy`): linhas selecionadas na ordem atual ou,
   * sem seleção, a célula ativa. Síncrono — `clipboardData` só aceita
   * `setData` durante o evento.
   */
  readonly #onCopy = (event: ClipboardEvent): void => {
    const cell = this.#copyCellOf(event);
    // Seleção toda fora do filtro: copia a célula focada, como sem seleção.
    const copy = cell && ((this.#selection.size ? this.#copySelection() : undefined) ?? this.#copyCell(cell));

    if (!copy) {
      return;
    }

    const clipboardData = event.clipboardData!;
    const detail: GridCopyEventDetail = { ...copy.detail, clipboardData };

    if (!this.dispatchEvent(new CustomEvent('u-grid-copying', { ...this.#eventInit(detail), cancelable: true }))) {
      return;
    }

    event.preventDefault();
    // O conteúdo do grid, não o `detail` (que o ouvinte pode ter mexido sem cancelar).
    writeClipboard(clipboardData, copy.detail);
    this.#announce(copy.announcement);
  };

  /**
   * `beforecopy`: cancelar habilita o comando Copiar no WebKit sem seleção de
   * texto (senão o Cmd+C nem dispara o `copy`); no Chromium não muda nada.
   * Mesmo critério do `copy`, e só quando há o que copiar.
   */
  readonly #onBeforeCopy = (event: Event): void => {
    const cell = this.#copyCellOf(event);

    if (cell && (this.#selection.size || this.#copyCell(cell))) {
      event.preventDefault();
    }
  };

  /**
   * Célula de onde veio o `copy`/`beforecopy` quando a cópia é do grid:
   * célula navegável (não a linha de filtro, campo editável ou texto
   * selecionado pelo usuário) com `clipboardMode` ligado.
   */
  #copyCellOf(event: Event): { position: CellPosition } | undefined {
    const table = this.#tableRef.value;

    if (this.clipboardMode === 'none' || !table || !this.shadowRoot || !isGridCopy(event, table, this.shadowRoot)) {
      return undefined;
    }

    const cell = this.#navCellOf(event.composedPath());
    const position = cell && !cell.closest('tr.filter-row') ? this.#positionOf(cell) : undefined;

    return position ? { position } : undefined;
  }

  #copySelection(): CopyContent | undefined {
    const source = this.#exportSource({ selectedOnly: true, includeGroups: false, includeSummaries: false });

    if (!source.items.length || !source.columns.length) {
      return undefined;
    }

    const rows = [...exportRows(source)] as GridExportDataRow[];

    return {
      detail: {
        items: rows.map(row => row.item),
        columns: source.columns.map(column => column.info.column),
        ...clipboardContent(rows, source.columns, this.#clipboardHtmlOptions()),
      },
      announcement: formatMessage(this.#translation.rowsCopiedAnnouncement, { count: String(rows.length) }),
    };
  }

  /**
   * Nome da tabela (spec 10): os alvos do `aria-labelledby` do hospedeiro
   * em `ariaLabelledByElements` (o navegador calcula o nome e acompanha o
   * texto) e o texto copiado no `aria-label` (reserva). O `aria-label` é
   * garantido aqui também porque, na hidratação, o Lit não grava o valor do
   * cliente sobre o do servidor (`noCommit`), e o servidor não resolve o
   * `aria-labelledby`.
   */
  #syncTableLabel(): void {
    const table = this.#tableRef.value;

    if (!table) {
      return;
    }

    const name = this.#hostLabel.name || null;

    if (table.getAttribute('aria-label') !== name) {
      if (name) {
        table.setAttribute('aria-label', name);
      } else {
        table.removeAttribute('aria-label');
      }
    }

    if ('ariaLabelledByElements' in table) {
      const elements = this.#hostLabel.elements;
      const current = table.ariaLabelledByElements ?? [];

      if (current.length !== elements.length || elements.some((element, index) => current[index] !== element)) {
        table.ariaLabelledByElements = elements.length ? [...elements] : null;
      }
    }
  }

  /** Direção e idioma efetivo do grid na `<table>` copiada (spec 12). */
  #clipboardHtmlOptions(): ClipboardHtmlOptions {
    return { rtl: this._isRtl(), lang: this.language };
  }

  /** A célula de onde veio o Ctrl+C (só célula de dados de coluna exportável). */
  #copyCell({ position }: { position: CellPosition }): CopyContent | undefined {
    const row = this.#rowAt(position.row);
    const column = dataColumnOf(this.#currentNavColumns()[position.col]);

    if (!row || !isDataRow(row) || !column || !isColumnExportable(column)) {
      return undefined;
    }

    const source = this.#exportColumn(column);
    const value = source.read(row.item);
    const cell: GridExportDataRow = { rowType: 'data', level: 0, item: row.item, values: [value], texts: [source.text(value, row.item)] };

    return {
      detail: { items: [row.item], columns: [column], ...clipboardContent([cell], [source], this.#clipboardHtmlOptions()) },
      announcement: this.#translation.cellCopiedAnnouncement,
    };
  }

  /** Moves the focus to the active cell of the grid (the one keyboard navigation starts from). */
  override focus(options?: FocusOptions): void {
    // Esperando o estado a célula está oculta: o foco vai a ela quando o estado chegar.
    if (this.#waitingForState) {
      this.#focusPending = true;
      return;
    }

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

    if (change === 'columns') {
      // Colunas aninhadas entraram/saíram de uma banda declarativa.
      if (!this.#columnsProperty) {
        this.#syncColumns();
      }

      return;
    }

    if (this.#columnTree.childrenOf.has(column) || isBand(column)) {
      // Banda (ou coluna que virou banda): rótulo, fixação e visibilidade são do cabeçalho.
      if (isBand(column) !== this.#columnTree.childrenOf.has(column)) {
        this.#syncColumns();
      }

      this.#layoutDirty = true;
      this.requestUpdate();
      return;
    }

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
    const tree = buildColumnTree<GridColumnDef>(this.columns);
    this.#columnTree = tree;
    this.#visibleBands = undefined;
    // Só as folhas têm células; as bandas são só cabeçalho.
    const definitions = tree.leaves;
    const defined = new Set(tree.parentOf.keys());

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

    // Coluna que virou banda sai das listas de folhas.
    const regular = this._regularColumns.filter(c => defined.has(c) && !tree.childrenOf.has(c));
    const group = this._groupColumns.filter(c => defined.has(c) && !tree.childrenOf.has(c));
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
    this.#layoutDirty = true;
    this.#filterRow.prune(defined);
    this.#headerFilterPopover.closeIfRemoved(defined);
    this.#setColumnState(regular, group);
  }

  /** `source` nulo: mudança vinda da definição da coluna, sem evento. */
  #moveColumnTo(toGroup: boolean, column: GridColumnDef, targetIndex: number, source: GridChangeSource | null): void {
    const previous = this.getGrouping();
    let regular = [...this._regularColumns];
    const group = [...this._groupColumns];
    const tree = this.#columnTree;

    if (tree.childrenOf.has(column)) {
      // Banda: só reordena entre os irmãos (não agrupa).
      if (!toGroup && this._isRegularColumn(column)) {
        this.#setColumnState(moveAmongSiblings(regular, tree, column, targetIndex), group);
      }

      return;
    }

    const from = regular.includes(column) ? regular : group.includes(column) ? group : null;

    if (!from) {
      return;
    }

    if (!toGroup) {
      if (from === group) {
        // Desagrupada: volta ao fim da própria banda (ou ao fim das comuns).
        group.splice(group.indexOf(column), 1);
        const parent = tree.parentOf.get(column) ?? null;
        let insertAt = regular.length;

        if (parent) {
          for (let index = regular.length - 1; index >= 0; index--) {
            if (ancestorsOf(tree, regular[index]).includes(parent)) {
              insertAt = index + 1;
              break;
            }
          }
        }

        regular.splice(insertAt, 0, column);
        regular = normalizeLeafOrder(regular, tree);
      }

      // Índice entre os irmãos (mesma banda ou nível de cima); sem bandas, entre as comuns.
      this.#setColumnState(moveAmongSiblings(regular, tree, column, targetIndex), group);
    } else {
      const targetColumn = group[targetIndex];

      if (targetColumn === column) {
        return;
      }

      from.splice(from.indexOf(column), 1);

      const insertAt = targetColumn ? group.indexOf(targetColumn) : group.length;
      group.splice(insertAt, 0, column);

      this.#setColumnState(regular, group);
    }

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

    this.#visibleBands = undefined;
    const partitioned = this.#partition(normalizeLeafOrder(regular, this.#columnTree));

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
    this.#visibleBands = undefined;

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
    this.#columnTree.bands.forEach(reconcile);

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

  /** A banda tem coluna comum visível pelos estados próprios abaixo dela (ignorando ela e as de cima). */
  #hasOwnVisibleLeaf(band: GridColumnDef): boolean {
    const tree = this.#columnTree;

    return this._regularColumns.some(leaf => {
      if (!this.#ownVisible(leaf)) {
        return false;
      }

      for (let parent = tree.parentOf.get(leaf) ?? null; parent; parent = tree.parentOf.get(parent) ?? null) {
        if (parent === band) {
          return true;
        }

        if (!this.#ownVisible(parent)) {
          return false;
        }
      }

      return false;
    });
  }

  /** Visibilidade PRÓPRIA (usuário > hospedeiro), sem olhar as bandas. */
  #ownVisible(column: GridColumnDef): boolean {
    return this.#userVisible.get(column) ?? column.visible !== false;
  }

  /**
   * Visibilidade efetiva: a própria e a de todas as bandas acima; a banda
   * ainda precisa de uma folha visível (não agrupada).
   * @internal
   */
  _isColumnVisible(column: GridColumnDef): boolean {
    const tree = this.#columnTree;

    if (!this.#ownVisible(column)) {
      return false;
    }

    let parent = tree.parentOf.get(column) ?? null;

    while (parent) {
      if (!this.#ownVisible(parent)) {
        return false;
      }

      parent = tree.parentOf.get(parent) ?? null;
    }

    if (!tree.childrenOf.has(column)) {
      return true;
    }

    return this.#bandsWithVisibleLeaf().has(column);
  }

  /**
   * Bandas com alguma folha comum efetivamente visível (cache: o cabeçalho e
   * o menu perguntam por célula a cada render). Zerado a cada mudança de
   * visibilidade, de ordem ou de definição.
   */
  #bandsWithVisibleLeaf(): Set<GridColumnDef> {
    if (this.#visibleBands) {
      return this.#visibleBands;
    }

    const bands = new Set<GridColumnDef>();
    const tree = this.#columnTree;

    for (const leaf of this._regularColumns) {
      if (!this.#ownVisible(leaf)) {
        continue;
      }

      const chain = ancestorsOf(tree, leaf);

      if (chain.every(band => this.#ownVisible(band))) {
        chain.forEach(band => bands.add(band));
      }
    }

    this.#visibleBands = bands;
    return bands;
  }

  #visibleBands: Set<GridColumnDef> | undefined;

  /**
   * Lado fixo: o da coluna do nível de cima (banda fixa leva os filhos;
   * `fixed` numa coluna aninhada não vale).
   * @internal
   */
  _fixedOf(column: GridColumnDef): GridColumnFixed {
    const root = this.#columnTree.parentOf.has(column) ? rootOf(this.#columnTree, column) : column;

    return this.#userFixed.has(root)
      ? this.#userFixed.get(root)!
      : normalizeFixed(root.fixed);
  }

  /** @internal */
  _isBand(column: GridColumnDef): boolean {
    return this.#columnTree.childrenOf.has(column);
  }

  /** @internal */
  _parentBandOf(column: GridColumnDef): GridColumnDef | null {
    return this.#columnTree.parentOf.get(column) ?? null;
  }

  /** @internal */
  _bandChainOf(column: GridColumnDef): GridColumnDef[] {
    return ancestorsOf(this.#columnTree, column);
  }

  /** Irmãos (mesma banda ou nível de cima) na ordem atual, com alguma folha comum. */
  #siblingsOf(column: GridColumnDef): GridColumnDef[] {
    const parent = this.#columnTree.parentOf.get(column) ?? null;

    // Cache por ordem/árvore: o menu e os atalhos perguntam por célula do cabeçalho a cada render.
    if (this.#siblingCache.regular !== this._regularColumns || this.#siblingCache.tree !== this.#columnTree) {
      this.#siblingCache = { regular: this._regularColumns, tree: this.#columnTree, byParent: new Map() };
    }

    let siblings = this.#siblingCache.byParent.get(parent);

    if (!siblings) {
      siblings = orderedSiblings(this._regularColumns, this.#columnTree, parent);
      this.#siblingCache.byParent.set(parent, siblings);
    }

    return siblings;
  }

  #siblingCache: { regular: GridColumnDef[]; tree: ColumnTree<GridColumnDef>; byParent: Map<GridColumnDef | null, GridColumnDef[]> } = {
    regular: [],
    tree: buildColumnTree<GridColumnDef>([]),
    byParent: new Map(),
  };

  /** Irmãos visíveis do mesmo bloco (fixas no início, livres, fixas no fim): mover pelo teclado/menu. */
  #movableSiblingsOf(column: GridColumnDef): GridColumnDef[] {
    return this.#siblingsOf(column).filter(sibling => this._isColumnVisible(sibling) && this._sameBlock(column, sibling));
  }

  /**
   * Há irmã visível do mesmo bloco ao lado (o menu tem "Mover")? Sem filtrar
   * todas as irmãs: roda por célula do cabeçalho a cada render (300 colunas).
   * Os blocos são contíguos: a irmã visível mais próxima decide cada lado.
   */
  #hasMovableNeighbor(column: GridColumnDef): boolean {
    const siblings = this.#siblingsOf(column);
    const index = siblings.indexOf(column);

    if (index < 0 || !this._isColumnVisible(column)) {
      return false;
    }

    for (const step of [-1, 1]) {
      for (let at = index + step; at >= 0 && at < siblings.length; at += step) {
        if (this._isColumnVisible(siblings[at])) {
          if (this._sameBlock(column, siblings[at])) {
            return true;
          }

          break;
        }
      }
    }

    return false;
  }

  /** @internal */
  _siblingIndexOf(column: GridColumnDef): number {
    return this.#siblingsOf(column).indexOf(column);
  }

  /** Folha comum (não agrupada) ou banda com alguma. @internal */
  _isRegularColumn(column: GridColumnDef): boolean {
    return this._regularColumns.includes(column)
      || (this.#columnTree.childrenOf.has(column) && this._regularColumns.some(leaf => ancestorsOf(this.#columnTree, leaf).includes(column)));
  }

  /**
   * Reordenar só vale dentro do mesmo bloco (fixas no início, livres, fixas no fim).
   * @internal
   */
  _sameBlock(a: GridColumnDef, b: GridColumnDef): boolean {
    return this._fixedOf(a) === this._fixedOf(b);
  }

  /**
   * Arrasto: soltar `moving` sobre `target` só entre irmãos do mesmo bloco.
   * @internal
   */
  _canDropColumn(moving: GridColumnDef, target: GridColumnDef): boolean {
    return this._parentBandOf(moving) === this._parentBandOf(target) && this._sameBlock(moving, target);
  }

  #hasFixedColumns(): boolean {
    return this._visibleColumns.some(column => this._fixedOf(column) !== null);
  }

  /**
   * Reordenação feita pelo usuário (arrasto): move e avisa.
   * @internal
   */
  _userMoveColumn(column: GridColumnDef, targetIndex: number): void {
    const previousIndex = this._siblingIndexOf(column);

    this.#moveColumnTo(false, column, targetIndex, 'user');

    const index = this._siblingIndexOf(column);

    if (previousIndex >= 0 && index !== previousIndex) {
      this.dispatchEvent(new CustomEvent('u-grid-column-reorder', this.#eventInit<GridColumnReorderEventDetail>({
        column,
        band: this._parentBandOf(column),
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
    if (!this._isRegularColumn(column)) {
      return false;
    }

    const tree = this.#columnTree;
    // Uma mudança por coluna cujo estado PRÓPRIO muda: bandas de cima primeiro.
    const changes: GridColumnDef[] = [];

    const change = (target: GridColumnDef, value: boolean): void => {
      if (this.#ownVisible(target) !== value) {
        changes.push(target);
      }
    };

    if (visible) {
      // Banda que volta (ela ou uma de cima estava oculta): as colunas dela
      // voltam ao estado próprio que tinham (APG tri-state: oculta → o misto
      // de antes). Banda já visível (misto) ou sem coluna própria visível: todas.
      const returning = !this.#ownVisible(column) || ancestorsOf(tree, column).some(band => !this.#ownVisible(band));

      ancestorsOf(tree, column).forEach(band => change(band, true));
      change(column, true);

      if (tree.childrenOf.has(column) && (!returning || !this.#hasOwnVisibleLeaf(column))) {
        const showAll = (band: GridColumnDef): void => (tree.childrenOf.get(band) ?? []).forEach(child => {
          change(child, true);
          showAll(child);
        });
        showAll(column);
      }
    } else if (this._isColumnVisible(column)) {
      change(column, false);
    }

    if (!changes.length) {
      return false;
    }

    const previous = new Map(changes.map(target => [target, this.#userVisible.get(target)]));
    changes.forEach(target => this.#userVisible.set(target, visible));
    this.#visibleBands = undefined;

    // Nunca oculta a última coluna visível.
    if (!visible && !this._regularColumns.some(leaf => this._isColumnVisible(leaf))) {
      previous.forEach((value, target) => value === undefined ? this.#userVisible.delete(target) : this.#userVisible.set(target, value));
      this.#visibleBands = undefined;
      this.requestUpdate();
      return false;
    }

    this.#layoutDirty = true;
    this.requestUpdate();
    changes.forEach(target => this.dispatchEvent(new CustomEvent('u-grid-column-visibility-change', this.#eventInit<GridColumnVisibilityChangeEventDetail>({ column: target, visible }))));
    return true;
  }

  /**
   * Fixa/solta pelo seletor e avisa.
   * @internal
   */
  _userSetFixed(column: GridColumnDef, fixed: GridColumnFixed): void {
    const previousFixed = this._fixedOf(column);

    // Só o nível de cima fixa (a banda leva os filhos).
    if (!this._isRegularColumn(column) || this._parentBandOf(column) || previousFixed === fixed) {
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
      // Virtualização de colunas: precisa de todas as larguras (frente 13).
      return this.#virtualColumns
        ? clampWidth(Math.max(column.minWidth ?? 0, DEFAULT_VIRTUAL_COLUMN_WIDTH), column.minWidth ?? 0, column.maxWidth ?? Infinity)
        : undefined;
    }

    return clampWidth(width, column.minWidth ?? 0, column.maxWidth ?? Infinity);
  }

  /** Virtualização de colunas ligada (`columnRenderingMode`; valor desconhecido = `auto`). */
  get #virtualColumns(): boolean {
    const mode = this.columnRenderingMode;
    return mode === 'virtual' || (mode !== 'standard' && this.#columnTree.leaves.length > VIRTUAL_COLUMNS_THRESHOLD);
  }

  /**
   * Colunas que entram no DOM: todas, ou (virtual) as fixas, as da janela
   * horizontal e a da célula ativa; as demais viram espaçadoras
   * (`gapBefore` e `#trailingGap`).
   */
  #columnPlan(): ColumnPlan | undefined {
    this.#trailingGap = 0;

    if (!this.#virtualColumns) {
      this.#freeOffsets = undefined;
      return undefined;
    }

    // Só larguras e lados (barato para todas); o layout completo é só das que entram no DOM.
    const columns = this._visibleColumns;
    const sides = columns.map(column => this._fixedOf(column));
    const widths = columns.map(column => this.#widthOf(column) ?? this.#renderedWidths.get(column) ?? 0);
    const free: number[] = [];
    let fixedArea = this.#stickyStart();

    columns.forEach((_, index) => {
      if (sides[index]) {
        fixedArea += widths[index];
      } else {
        free.push(index);
      }
    });

    this.#freeOffsets = prefixOffsets(free.map(index => widths[index]));
    this.#fixedArea = fixedArea;

    const window = this.#horizontalWindow();
    this.#columnWindow = window;

    const kept = new Set<number>(free.slice(window.first, window.last + 1));
    const active = this.#activeCol - this.#leadingColumns;

    if (active >= 0 && active < columns.length) {
      // A célula ativa (foco, editor) sobrevive à virtualização.
      kept.add(active);
    }

    const gaps = new Map<number, number>();
    let gap = 0;

    columns.forEach((_, index) => {
      if (sides[index] || kept.has(index)) {
        kept.add(index);

        if (gap) {
          gaps.set(index, gap);
        }

        gap = 0;
      } else {
        gap += widths[index];
      }
    });

    this.#trailingGap = gap;
    return { kept, gaps };
  }

  /** Janela das colunas roláveis pela rolagem e largura guardadas (sem ler o DOM no render). */
  #horizontalWindow(): ColumnWindow {
    const offsets = this.#freeOffsets;

    if (!offsets) {
      return { first: 0, last: -1 };
    }

    const viewport = this.#viewportWidth || DEFAULT_VIEWPORT_WIDTH;
    return columnWindow(offsets, this.#scrollStart, Math.max(viewport - this.#fixedArea, 0), COLUMN_OVERSCAN);
  }

  /** Rolagem horizontal: re-renderiza só quando a janela de colunas muda. */
  readonly #onHorizontalScroll = (): void => {
    const scroller = this._scrollContainerRef.value;

    if (!scroller || !this.#freeOffsets) {
      return;
    }

    // Em RTL o scrollLeft vai de 0 a negativo.
    const start = Math.abs(scroller.scrollLeft);
    const viewport = scroller.clientWidth;

    if (start === this.#scrollStart && viewport === this.#viewportWidth) {
      return;
    }

    this.#scrollStart = start;
    this.#viewportWidth = viewport;

    const next = this.#horizontalWindow();

    if (next.first !== this.#columnWindow.first || next.last !== this.#columnWindow.last) {
      // Cabeçalhos novos no DOM: o arrasto precisa deles.
      this.#dragAndDropDirty = true;
      this.requestUpdate();
    }
  };

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

    const colIndex = index + 1 + this.#leadingColumns;
    const cells = this.renderRoot.querySelectorAll<HTMLElement>(
      `th.header-column[aria-colindex="${colIndex}"], tbody tr:not(.group-row):not(.detail-row) > td[aria-colindex="${colIndex}"]`,
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
      const row = root.querySelector('tbody tr[role=row]:not(.group-row):not(.detail-row)');
      cells = row ? [...row.querySelectorAll<HTMLElement>('td[role=gridcell]:not(.selection-cell):not(.detail-toggle-cell)')] : [];
    }

    let changed = false;
    const leading = this.#leadingColumns;

    cells.forEach(cell => {
      // Pelo `aria-colindex` (colunas fora do DOM e bandas não contam).
      const column = this._visibleColumns[Number(cell.getAttribute('aria-colindex')) - 1 - leading];

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

    this.#resizeObserver = new ResizeObserver(entries => {
      if (entries.some(entry => entry.target === scroller)) {
        this.#layoutDirty = true;
        this.#viewportWidth = scroller.clientWidth;
        // Largura visível: o conteúdo do detalhe não passa dela (WCAG 1.4.10).
        scroller.style.setProperty('--_viewport-inline-size', `${scroller.clientWidth}px`);
        this.requestUpdate();
      }

      this.#syncToolbarOffset();
    });

    this.#resizeObserver.observe(scroller);
    this.#observeToolbar();
  }

  /**
   * A barra quebra linha (WCAG 1.4.10, spec 17 A9): o cabeçalho das colunas
   * prende abaixo da altura medida dela, não da \`--u-grid-toolbar-height\`.
   */
  #observeToolbar(): void {
    const toolbar = this.#toolbarRef.value ?? null;

    if (!this.#resizeObserver || toolbar === this.#observedToolbar) {
      return;
    }

    if (this.#observedToolbar) {
      this.#resizeObserver.unobserve(this.#observedToolbar);
    }

    this.#observedToolbar = toolbar;

    if (toolbar) {
      this.#resizeObserver.observe(toolbar);
    } else {
      this._containerRef.value?.style.removeProperty('--_toolbar-offset');
    }
  }

  #syncToolbarOffset(): void {
    const toolbar = this.#observedToolbar;

    if (toolbar?.isConnected) {
      this._containerRef.value?.style.setProperty('--_toolbar-offset', `${toolbar.offsetHeight}px`);
    }
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
  #columnLayout(plan?: ColumnPlan): ColumnLayout[] {
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

    return columns.flatMap((column, index) => {
      if (plan && !plan.kept.has(index)) {
        return [];
      }

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

      return [
        {
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
          col: index + this.#leadingColumns,
          gapBefore: plan?.gaps.get(index) ?? 0,
        },
      ];
    });
  }

  /** Largura presa no início antes das colunas fixas: recuos de grupo e caixas de seleção. */
  #stickyStart(): number {
    return this.#selectionInset + (this.#showSelectionColumn ? SELECTION_COLUMN_WIDTH : 0);
  }

  // -------------------------------------------------------------- row model

  /** Padrão de um nível: `*AllGroups(nível)` → `*AllGroups()` → `autoExpandGroups`. */
  #defaultExpanded(level: number): boolean {
    return this.#levelExpansion[level] ?? this.#allExpansion ?? this.autoExpandGroups;
  }

  readonly #isExpanded = (key: string, level: number): boolean =>
    this.#expansion.get(key)?.expanded ?? this.#defaultExpanded(level);

  #resetExpansion(): void {
    this.#expansionDefaultsVersion++;
    this.#expansion.clear();
    this.#levelExpansion = [];
    this.#allExpansion = undefined;
    this.#rowsDirty = true;
  }

  /** Resolve a coluna de um resumo: `path` (1ª coluna com ele) ou a própria coluna, se definida. */
  #resolveColumn(columnRef: GridColumnRef | undefined): GridColumnDef | undefined {
    const columns = this.columns;

    if (typeof columnRef === 'string') {
      return columns.find(column => column.name === columnRef) ?? columns.find(column => column.path === columnRef);
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

    // Antes dos resumos: o tipo de dado das colunas sai das linhas carregadas.
    this.#syncRemote();

    if (this.#dataSource && !this.#lazy) {
      this.#adoptLoaded();
    } else if (this.#lazy) {
      const generation = this.#loader.current;
      const version = generation?.version ?? -1;

      // Tipos inferidos das linhas carregadas: refaz com a amostra nova.
      if (generation !== this.#typesGeneration || version !== this.#typesVersion) {
        this.#typesGeneration = generation;
        this.#typesVersion = version;
        this.#dataTypes.clear();
        this.#summaryDirty = true;
      }
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

    if (this.#lazy) {
      this.#ensureRemoteRows();
      this.#planQuery();
      this.#announceFiltered();
      this.#applyPage();
      return;
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

    // Filtrado no servidor: as linhas carregadas já são as que passam.
    const mask = this.#remote.filtering ? null : this.#filtering.maskFor(this.#items);

    if (mask !== this.#appliedMask) {
      this.#appliedMask = mask;
      this.#viewDirty = true;
      // Totais e resumos de grupo valem sobre as linhas FILTRADAS.
      this.#totalsDirty = true;
    }

    if (this.#viewDirty) {
      if (this.#sortOrder === undefined) {
        // Ordenado no servidor: vale a ordem carregada.
        const rowSorting = this.#remote.sorting ? [] : this.#sorting.filter(spec => !this.#isGrouped(spec.column));
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

    if (this.#groupsDirty || (languageChanged && this._groupColumns.length)) {
      this.#groups = this.#buildGroupsOf(this.#sortedItems);
      this.#groupsDirty = false;
      this.#rowsDirty = true;
    }

    if (this.#rowsDirty) {
      this.#allRows = flattenRows(this.#sortedItems, this.#groups, this.#isExpanded, this.#rowKeyText, this.#hasGroupFooters, this.#detailsOf);
      this.#rowsDirty = false;
      // Alturas medidas (`wrap`) são por índice: outras linhas, outras alturas.
      this.#virtualizer.measure();
    }

    this.#totalCount = this.#sortedItems.length;

    if (this.#dataSource) {
      this.#planQuery();
    }

    this.#announceFiltered();
    this.#applyPage();
  }

  /**
   * Anúncio do gesto de filtro com a contagem nova: espera a filtragem em
   * fatias e, com fonte de dados, a resposta da consulta nova; total
   * desconhecido (rolagem infinita) não anuncia contagem.
   */
  #announceFiltered(): void {
    if (!this.#announceFilter || this.#filtering.pending || this.#isLoading) {
      return;
    }

    this.#announceFilter = false;

    if (this.#totalCount >= 0) {
      this.#announcement = withRepeatMark(formatMessage(this.#translation.filteredAnnouncement, { count: String(this.#totalCount) }), this.#announcement);
    }
  }

  // ------------------------------------------------------- fonte de dados

  /** Normaliza `remoteOperations` (aviso quando uma operação foi ligada por dependência). */
  #syncRemote(): void {
    const value = this.remoteOperations;

    if (value === this.#remoteSource) {
      return;
    }

    this.#remoteSource = value;

    const { flags, forced } = normalizeRemoteOperations(value);
    const changed = JSON.stringify(flags) !== JSON.stringify(this.#remote);

    if (forced.length) {
      console.warn(`<u-grid>: remoteOperations also needs ${forced.join(', ')} on the server; turned on.`);
    }

    if (typeof value === 'object' && value?.summary && !flags.summary) {
      console.warn('<u-grid>: remoteOperations.summary only applies with remote paging or grouping; summaries are computed in the browser.');
    }

    this.#remote = flags;

    if (changed) {
      this.#sortDirty = true;
      this.#filtering.invalidate();
      this.#groupsDirty = true;
      this.#totalsDirty = true;
      this.#rowsDirty = true;
      this.#queryKey = undefined;
      this.#loadedGeneration = undefined;
      this.#remoteGeneration = undefined;
    }
  }

  /** Carga única (sem paginação nem grupos no servidor): o que veio vira as linhas do pipeline local. */
  #adoptLoaded(): void {
    const generation = this.#loader.current;

    if (generation && generation !== this.#loadedGeneration) {
      this.#loadedGeneration = generation;
      this.#setItems(generation.rootItems() ?? []);
    }
  }

  /** Linhas da geração remota exibida (grupos carregados + blocos preguiçosos). */
  #ensureRemoteRows(): void {
    const generation = this.#loader.current;
    const version = generation?.version ?? -1;

    if (generation === this.#remoteGeneration && version === this.#remoteVersion && !this.#rowsDirty && !this.#groupsDirty && !this.#totalsDirty) {
      return;
    }

    if (generation !== this.#remoteGeneration) {
      this.#pageCause ??= 'api';
    }

    this.#remoteGeneration = generation;
    this.#remoteVersion = version;
    this.#rowsDirty = false;
    this.#groupsDirty = false;
    this.#totalsDirty = false;

    const context = generation?.query.context as RemoteContext | undefined;
    const groupColumns = context?.groupColumns ?? [];
    const groupMap = context?.groupSummaryMap ?? [];
    const totalMap = context?.totalSummaryMap ?? [];
    const groupSummaries = (summary: readonly unknown[]): unknown[] => groupMap.map(index => index >= 0 ? summary[index] : undefined);

    this.#sortedItems = [];
    this.#allRows = generation
      ? flattenRemote(generation, groupColumns, this.#isExpanded, this.#rowKeyText, groupSummaries, this.#hasGroupFooters, this.#detailsOf)
      : new RowList(this.#rowKeyText);
    this.#groups = generation ? remoteGroupNodes(generation, groupColumns, groupSummaries) : [];
    this.#totals = totalMap.map(index => index >= 0 ? generation?.summary[index] : undefined);
    this.#totalCount = generation?.totalCount ?? (generation ? -1 : 0);
    this.#virtualizer.measure();
  }

  #typesGeneration: unknown;
  #typesVersion = -1;

  /** Itens para inferir o `dataType` das colunas: `items`, ou o que a fonte remota já carregou. */
  #typeSample(): readonly unknown[] {
    if (!this.#lazy) {
      return this.#items;
    }

    const sample: unknown[] = [];

    for (const item of this.#loader.current?.loadedItems() ?? []) {
      sample.push(item);

      if (sample.length >= 1000) {
        break;
      }
    }

    return sample;
  }

  /** `path` da coluna para uma operação remota; sem ele avisa uma vez e a coluna fica de fora. */
  #remotePath(column: GridColumnDef, operation: string): string | undefined {
    const unsupported = !column.path
      || (operation !== 'summary' && !!column.valueGetter)
      || (operation === 'sorting' && !!column.comparator)
      || (operation === 'grouping' && !!column.groupValueGetter);

    if (unsupported) {
      const id = `${operation}:${columnIdOf(column)}`;

      if (!this.#warnedColumns.has(id)) {
        this.#warnedColumns.add(id);
        console.warn(`<u-grid>: column "${column.label ?? column.path ?? ''}" needs a plain "path" for remote ${operation}; ignored on the server.`);
      }

      return undefined;
    }

    return column.path;
  }

  #remoteSummaries(specs: readonly ResolvedSummary[], positions: number[]): GridLoadSummary[] {
    const list: GridLoadSummary[] = [];

    positions.length = 0;

    for (const { item, spec } of specs) {
      const path = typeof spec.type === 'string' && spec.column ? this.#remotePath(spec.column, 'summary') : undefined;

      if (path === undefined || typeof spec.type !== 'string') {
        positions.push(-1);
        continue;
      }

      positions.push(list.length);
      list.push(item.name ? { path, type: spec.type, name: item.name } : { path, type: spec.type });
    }

    return list;
  }

  /** Monta a consulta do estado atual; se mudou, fica pendente (pedida depois do render). */
  #planQuery(): void {
    const remote = this.#remote;
    const lazy = this.#lazy;
    const groupColumns = lazy ? this._groupColumns.filter(column => this.#remotePath(column, 'grouping') !== undefined) : [];
    const rowSorting = this.#sorting.filter(spec => !this.#isGrouped(spec.column));
    const sort = remote.sorting
      ? [
        ...groupColumns.map(column => ({ path: column.path!, order: this.#orderOf(column) ?? 'asc' })),
        ...rowSorting.flatMap(({ column, order }) => {
          const path = this.#remotePath(column, 'sorting');
          return path === undefined ? [] : [{ path, order }];
        }),
      ]
      : [];
    const totalSummaryMap: number[] = [];
    const groupSummaryMap: number[] = [];
    const paged = remote.paging;
    const query: LoaderQuery = {
      sort,
      filter: remote.filtering ? this.#filtering.combined() : null,
      filterValue: remote.filtering ? this.#filtering.filterValue : null,
      searchText: remote.filtering ? this.#filtering.searchText : '',
      group: groupColumns.map(column => ({ path: column.path!, order: this.#orderOf(column) ?? 'asc', expanded: false })),
      totalSummary: remote.summary ? this.#remoteSummaries(this.#totalSpecs, totalSummaryMap) : [],
      groupSummary: remote.summary && groupColumns.length ? this.#remoteSummaries(this.#groupSpecs, groupSummaryMap) : [],
      blockSize: paged ? this.#effectivePageSize : Infinity,
      infinite: paged && this.scrollMode === 'infinite' && !this.paging,
    };
    const key = JSON.stringify([query, this.#refreshCount]);

    if (key === this.#queryKey) {
      return;
    }

    if (this.scrollMode !== 'virtual' && !this.#warnedInfinitePaging) {
      const problem = this.scrollMode !== 'infinite'
        ? `unknown scroll-mode "${String(this.scrollMode)}"; "virtual" is used.`
        : this.paging
          ? 'scroll-mode="infinite" is ignored with paging (the pager wins).'
          : !paged ? 'scroll-mode="infinite" needs a dataSource with remote paging; ignored.' : '';

      if (problem) {
        this.#warnedInfinitePaging = true;
        console.warn(`<u-grid>: ${problem}`);
      }
    }

    this.#queryKey = key;
    query.context = { groupColumns, totalSummaryMap, groupSummaryMap } satisfies RemoteContext;
    this.#pendingQuery = {
      query,
      hintRow: this.paging ? this.#pageIndex * this.#effectivePageSize : this.#lastWindowFirst,
    };
  }

  #warnedInfinitePaging = false;
  /** 1ª linha da última janela renderizada (o 1º pedido de uma consulta nova já traz o bloco dela). */
  #lastWindowFirst = 0;

  get #effectivePageSize(): number {
    const size = Math.trunc(Number(this.pageSize));
    return size > 0 ? size : 20;
  }

  /** Página atual (sem as linhas novas da edição). */
  #basePage: RowPage | undefined;

  /** Página (com `paging`) sobre as linhas inteiras. */
  #applyPage(): void {
    const all = this.#allRows;

    if (!this.paging) {
      this.#basePage = undefined;
      this.#rows = this.#rowsWithAdded(all);
      this.#syncDetailsIfChanged();
      return;
    }

    const size = this.#effectivePageSize;
    const known = !this.#dataSource || !!this.#loader.current || !this.#lazy;
    // Linhas de detalhe não contam no `pageSize` e ficam na página da mestre (como a referência).
    const count = Math.max(1, Math.ceil((all.length - all.detailCount) / size));

    if (known && this.#pageIndex >= count && !this.#isLoading) {
      // Sem causa (setter de `pageIndex`/`pageSize`): limita calado.
      if (this.#pageCause) {
        this.#pageCorrection ??= { pageIndex: this.#pageIndex, pageSize: size, source: this.#pageCause };
      }

      this.#pageIndex = count - 1;
    }

    if (!this.#isLoading) {
      this.#pageCause = undefined;
    }

    const { offset, length } = pageBounds(all, this.#pageIndex * size, size);
    let page = this.#basePage;

    // A mesma página das mesmas linhas: reaproveita (o virtualizador guarda as alturas dela).
    if (!(page?.source === all && page.offset === offset && page.length === length)) {
      page = this.#basePage = new RowPage(all, offset, length);
    }

    this.#rows = this.#rowsWithAdded(page);

    this.#syncDetailsIfChanged();
  }

  /** Linhas mudaram (refeitas ou outra página): alturas variáveis de novo. */
  #syncDetailsIfChanged(): void {
    if (this.#rows !== this.#syncedRows) {
      this.#syncDetailSizes();
    }
  }

  /** Página limitada num render: o evento sai depois dele (`updated`). */
  #pageCorrection: { pageIndex: number; pageSize: number; source: GridChangeSource } | undefined;

  /** Número de páginas (`paging`). */
  #pageCount(): number {
    const all = this.#allRows;
    return Math.max(1, Math.ceil((all.length - all.detailCount) / this.#effectivePageSize));
  }

  /** Único ponto que muda a página por gesto ou correção; evento só se mudou. */
  #setPage(pageIndex: number, pageSize: number, source: GridChangeSource): void {
    const previousPageIndex = this.#pageIndex;
    const previousPageSize = this.#effectivePageSize;

    if (pageIndex === previousPageIndex && pageSize === previousPageSize) {
      return;
    }

    this.pageSize = pageSize;
    this.pageIndex = pageIndex;

    // Só a troca pedida pelo usuário fala (a contagem do filtro já é anunciada).
    if (source === 'user' && this.#allRows.length) {
      this.#announce(this.#pageInfoText(Math.min(this.#pageIndex, this.#pageCount() - 1)));
    }

    this.dispatchEvent(new CustomEvent('u-grid-page-change', this.#eventInit<GridPageChangeEventDetail>({
      pageIndex: this.#pageIndex,
      previousPageIndex,
      pageSize: this.#effectivePageSize,
      previousPageSize,
      source,
    })));
  }

  /** Carga de toda a consulta em andamento (painel de carregamento, `aria-busy`). */
  get #isLoading(): boolean {
    return !!this.#dataSource && (!!this.#pendingQuery || this.#loader.loading);
  }

  /** Chama a fonte, com os eventos de carga; `null` = cancelada pelo hospedeiro. */
  #request(options: GridLoadOptions, signal: AbortSignal): Promise<GridLoadResult> | null {
    const source = this.#dataSource;

    if (!source) {
      return null;
    }

    const loading = new CustomEvent<GridLoadingEventDetail>('u-grid-loading', { ...this.#eventInit({ options }), cancelable: true });

    if (!this.dispatchEvent(loading)) {
      return null;
    }

    let promise: Promise<GridLoadResult>;

    try {
      promise = Promise.resolve(source.load(options, signal));
    } catch (error) {
      promise = Promise.reject(error);
    }

    return promise.then(
      result => {
        if (!signal.aborted) {
          this.dispatchEvent(new CustomEvent('u-grid-load', this.#eventInit<GridLoadEventDetail>({ options, result })));
        }

        return result;
      },
      (error: unknown) => {
        if (!signal.aborted) {
          this.dispatchEvent(new CustomEvent('u-grid-load-error', this.#eventInit<GridLoadErrorEventDetail>({ options, error })));
        }

        throw error;
      },
    );
  }

  /** Fim da carga: o "Carregando…" anunciado não fica na região viva (esvaziar não é lido). */
  #clearLoadingAnnouncement(): void {
    if (this.#loadingAnnounced && this.#announcement.replace(/\u00A0$/, '') === this.#translation.loading) {
      this.#announcement = '';
      this.requestUpdate();
    }

    this.#loadingAnnounced = false;
  }

  /** Esperando o estado sem fonte de dados: "Carregando…" aos 300 ms, uma vez (com fonte, `#afterRenderLoad` cuida). */
  #announceStateLoading(): void {
    if (this.#dataSource) {
      return;
    }

    if (!this.#stateWaiting) {
      clearTimeout(this.#loadingTimer);
      this.#loadingTimer = undefined;
      this.#clearLoadingAnnouncement();
    } else if (!this.#loadingTimer && !this.#loadingAnnounced && this.isConnected) {
      this.#loadingTimer = setTimeout(() => {
        this.#loadingTimer = undefined;

        if (this.#stateWaiting) {
          this.#loadingAnnounced = true;
          this.#announce(this.#translation.loading);
        }
      }, LOADING_ANNOUNCE_DELAY);
    }
  }

  /** Depois do render: pede a consulta nova ou os blocos que o render marcou. */
  #afterRenderLoad(): void {
    if (!this.#dataSource || !this.isConnected) {
      return;
    }

    const pending = this.#pendingQuery;

    if (pending) {
      this.#pendingQuery = undefined;
      this.#loader.reset(pending.query, pending.hintRow);
    }

    // "Carregando…" pela região viva, só se a carga passar de 300 ms. Esperar
    // o estado e a 1ª consulta contam como uma carga só (um anúncio).
    if (!this.#isLoading && !this.#stateWaiting) {
      clearTimeout(this.#loadingTimer);
      this.#loadingTimer = undefined;
      this.#clearLoadingAnnouncement();
    } else if (!this.#loadingTimer && !this.#loadingAnnounced) {
      this.#loadingTimer = setTimeout(() => {
        this.#loadingTimer = undefined;

        if (this.#isLoading || this.#stateWaiting) {
          this.#loadingAnnounced = true;
          this.#announce(this.#translation.loading);
        }
      }, LOADING_ANNOUNCE_DELAY);
    }

    // Rolagem rápida: pede só a janela onde parou.
    clearTimeout(this.#flushTimer);
    this.#flushTimer = setTimeout(() => {
      this.#flushTimer = undefined;
      this.#loader.flush();
    }, FLUSH_DELAY);
  }

  /** Atualizações por chave na carga única: sem reordenar nem refiltrar (como o `push` da referência). */
  #applyLocalChanges(
    add: readonly unknown[],
    updates: ReadonlyMap<unknown, unknown>,
    removals: ReadonlySet<unknown>,
    originals?: ReadonlyMap<unknown, unknown>,
  ): void {
    // Poucas linhas trocadas e o item velho conhecido (edição): troca no lugar, sem varrer por chave.
    if (originals && !add.length && !removals.size && updates.size && updates.size <= 256 && this.#replaceInPlace(updates, originals)) {
      return;
    }

    const keyOf = this.#baseKeyOf;

    const items = this.#items;
    // Só acréscimos: cópia direta (sem passar item por item).
    const next: unknown[] = !updates.size && !removals.size ? items.slice() : [];
    // Identidade do item velho → novo (ou removido), para remapear a vista.
    const replaced = new Map<unknown, unknown>();
    const removedItems = new Set<unknown>();
    const newIndex = removals.size ? new Int32Array(items.length) : undefined;

    for (let index = 0; index < items.length && (updates.size || removals.size); index++) {
      const item = items[index];
      const key = keyOf(item);

      if (removals.has(key)) {
        removedItems.add(item);

        if (newIndex) {
          newIndex[index] = -1;
        }

        continue;
      }

      if (newIndex) {
        newIndex[index] = next.length;
      }

      const replacement = updates.get(key);

      if (replacement !== undefined && replacement !== item) {
        replaced.set(item, replacement);
        next.push(replacement);
      } else {
        next.push(item);
      }
    }

    if (!replaced.size && !removedItems.size && !add.length) {
      return;
    }

    const firstAdded = next.length;

    for (const item of add) {
      next.push(item);
    }

    // Vista (filtrada/ordenada): mesma ordem, sem os removidos; novos no fim.
    const view: unknown[] = [];

    for (const item of this.#sortedItems) {
      if (removedItems.has(item)) {
        continue;
      }

      view.push(replaced.get(item) ?? item);
    }

    for (const item of add) {
      view.push(item);
    }

    const mask = this.#appliedMask;
    let nextMask: Uint8Array | null = null;

    if (mask) {
      nextMask = new Uint8Array(next.length);

      for (let index = 0; index < items.length; index++) {
        const target = newIndex ? newIndex[index] : index;

        if (target >= 0) {
          nextMask[target] = mask[index];
        }
      }

      nextMask.fill(1, firstAdded);
    }

    if (this.#sortOrder) {
      const order: number[] = [];

      for (const index of this.#sortOrder) {
        const target = newIndex ? newIndex[index] : index;

        if (target >= 0) {
          order.push(target);
        }
      }

      for (let index = firstAdded; index < next.length; index++) {
        order.push(index);
      }

      this.#sortOrder = Int32Array.from(order);
    }

    this.#pageCause ??= 'api';
    this.#items = next;
    this.#sortedItems = view;
    this.#appliedMask = nextMask;
    this.#filtering.adopt(next, nextMask);
    // Postos e tipos valiam para os itens velhos (a próxima ordenação refaz).
    this.#rankCache.clear();
    this.#allConvert.clear();
    this.#totalsDirty = true;

    if (this._groupColumns.length) {
      this.#groupsDirty = true;
    } else {
      this.#rowsDirty = true;
    }

    this.requestUpdate();
  }

  /**
   * Troca itens pelo índice do item velho (`indexOf` nativo; mesma ordem,
   * mesma máscara, sem refiltrar nem reordenar — como o `push` da
   * referência). `false` se algum item velho não está nas linhas.
   */
  #replaceInPlace(updates: ReadonlyMap<unknown, unknown>, originals: ReadonlyMap<unknown, unknown>): boolean {
    const items = this.#items;
    const shared = this.#sortedItems === items;
    const next = items.slice();
    const view = shared ? next : this.#sortedItems.slice();

    for (const [key, item] of updates) {
      const previous = originals.get(key);
      const index = previous === undefined ? -1 : items.indexOf(previous);

      if (index < 0) {
        return false;
      }

      next[index] = item;

      if (!shared) {
        const position = view.indexOf(previous);

        if (position >= 0) {
          view[position] = item;
        }
      }
    }

    this.#pageCause ??= 'api';
    this.#items = next;
    this.#sortedItems = view;
    this.#filtering.adopt(next, this.#appliedMask);
    this.#rankCache.clear();
    this.#allConvert.clear();
    this.#totalsDirty = true;

    if (this._groupColumns.length) {
      this.#groupsDirty = true;
    } else {
      this.#rowsDirty = true;
    }

    this.requestUpdate();
    return true;
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

    this.#pageCause = source;

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

    // Filtro novo volta à 1ª página (como a referência), depois do evento do filtro.
    if (this.paging) {
      this.#setPage(0, this.#effectivePageSize, source);
    }

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
      : resolveDataType(this.#typeSample(), column);

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

  /** Árvore de grupos (com os resumos de grupo) sobre `items`, já filtrados e ordenados. */
  #buildGroupsOf(items: readonly unknown[]): GroupNode[] {
    const language = this.language;

    return buildGroups(
      items,
      this._groupColumns,
      // A faixa (`groupValueGetter`) compara pelo próprio valor, sem o `dataType` da coluna.
      column => createComparer(language, column.groupValueGetter ? undefined : column.dataType),
      this._groupColumns.map(column => this.#orderOf(column)),
      this.#groupSpecs.map(({ spec }) => spec),
    );
  }

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

    const rowSorting = this.#sorting.filter(spec => !this.#isGrouped(spec.column));
    const priority = rowSorting.findIndex(spec => spec.column === column) + 1;
    const orderText = order === 'asc' ? translation.sortAscending : translation.sortDescending;

    // Com 2+ colunas, a prioridade entra no anúncio (spec 17, A6).
    this.#announcement = withRepeatMark(order
      ? rowSorting.length > 1 && priority > 0
        ? formatMessage(translation.sortedWithPriorityAnnouncement, { ...params, order: orderText, priority: String(priority) })
        : formatMessage(translation.sortedAnnouncement, { ...params, order: orderText })
      : formatMessage(translation.sortClearedAnnouncement, params), this.#announcement);
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
      this.#dataTypes.set(column, resolveDataType(this.#typeSample(), column));
    }

    return this.#dataTypes.get(column);
  }

  #formatContext(column: GridColumnDef): FormatContext {
    const { trueText, falseText } = this.#translation;

    return { language: this.language, dataType: this.#dataTypeOf(column), trueText, falseText };
  }

  #groupValueText(row: Pick<GroupRow, 'column' | 'value' | 'firstItem'>): string {
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

    const items = this.#lazy ? this.#loadedItems() : this.#sortedItems;
    const keys = this.#keyExpr ? items.map(this.#keyOf) : items;
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
    const key = this.#keyOf(row.item);
    const selected = this.#selection.has(key);

    this.#selectionAnchor = key;

    if (this.#selectionMode === 'single') {
      this.#applySelection(selected ? this.#selection.remove([key]) : this.#selection.replace([key]), 'user');
    } else {
      this.#applySelection(selected ? this.#selection.remove([key]) : this.#selection.add([key]), 'user');
    }

    // O foco está na célula: o `aria-selected` da linha (ancestral) não é lido ao mudar (spec 17).
    this.#announceSelectionCount();
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
      this.#selectionAnchor = this.#keyOf(target.item);
    }

    const keys = rangeBetween(anchor, rowIndex)
      .map(index => this.#rows.at(index))
      .filter(isDataRow)
      .map(row => this.#keyOf(row.item));

    const changed = this.#applySelection(append ? this.#selection.add(keys) : this.#selection.replace(keys), 'user');

    if (changed && keys.length > 1) {
      this.#announceSelectionCount();
    }
  }

  /** Caixa "selecionar tudo": desmarca se todas as filtradas estão marcadas; senão marca todas. */
  #toggleAll(): void {
    // Fonte remota: não há "selecionar tudo" (só as linhas carregadas existem).
    if (this.#lazy) {
      return;
    }

    const all = this.#sortedItems.length > 0 && this.#selectedInViewCount() === this.#sortedItems.length;

    if (this.#selectAll(!all, 'user')) {
      this.#announceSelectionCount();
    }
  }

  #announceSelectionCount(): void {
    this.#announce(formatMessage(this.#translation.rowsSelectedAnnouncement, { count: String(this.#selection.size) }));
  }

  #announce(text: string): void {
    this.#announcement = withRepeatMark(text, this.#announcement);
    this.requestUpdate();
  }

  /** Quantas das linhas filtradas estão selecionadas (recalcula só quando a seleção ou os itens mudam). */
  #selectedInViewCount(): number {
    const cache = this.#selectedInView;

    if (cache.version !== this.#selection.version || cache.items !== this.#sortedItems) {
      cache.version = this.#selection.version;
      cache.items = this.#sortedItems;
      cache.count = countSelected(this.#selection, this.#sortedItems, this.#keyExpr ? this.#keyOf : undefined);
    }

    return cache.count;
  }

  readonly #onBodyClick = (event: MouseEvent): void => {
    this.#onEditPointer(event, 'click');

    if (this.#selectionMode === 'none') {
      return;
    }

    const path = event.composedPath();
    // A linha deste corpo (não a de uma tabela no conteúdo de um detalhe).
    const tr = path.find((node): node is HTMLTableRowElement => node instanceof HTMLTableRowElement && node.parentElement === event.currentTarget);
    const index = Number(tr?.getAttribute('data-index') ?? NaN);
    const row = this.#rowAt(index);

    if (!isDataRow(row)) {
      return;
    }

    // O botão de expandir não seleciona (como a referência).
    if (path.some(node => node instanceof HTMLElement && node.classList.contains('detail-toggle-cell'))) {
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
      this.#selectionAnchor = this.#keyOf(row.item);
      this.#select([this.#selectionAnchor], false, 'user');
    }
  };

  /** Índice da linha de dados da chave (sem `keyExpr`, o próprio item); `-1` se não está nas linhas. */
  #rowIndexOfKey(key: unknown): number {
    if (key === undefined) {
      return -1;
    }

    const active = this.#rowAt(this.#activeRowIndex);

    if (isDataRow(active) && this.#keyOf(active.item) === key) {
      return this.#activeRowIndex;
    }

    return this.#rows.indexOfDataKey(key, this.#keyExpr ? this.#keyOf : undefined);
  }

  /** Linhas de dados carregadas (local: todas; remoto: os blocos em cache). */
  #loadedItems(): readonly unknown[] {
    if (this.#lazy) {
      const generation = this.#loader.current;
      return generation ? [...generation.loadedItems()] : [];
    }

    return this.#items;
  }

  /** Item carregado de chave `key` (pela função de chave dada). */
  #loadedItemByKey(key: unknown, keyOf: (item: unknown) => unknown): unknown {
    return this.#loadedItems().find(item => keyOf(item) === key);
  }

  /** `keyExpr` mudou: converte as chaves selecionadas (o que não resolve sai). */
  #convertSelection(previousKeyOf: (item: unknown) => unknown, notify: boolean): void {
    const byPreviousKey = new Map<unknown, unknown>();
    const selection = this.#selection;

    for (const item of this.#loadedItems()) {
      const key = previousKeyOf(item);

      if (selection.has(key) && !byPreviousKey.has(key)) {
        byPreviousKey.set(key, this.#keyOf(item));
      }
    }

    const keys = selection.keys.filter(key => byPreviousKey.has(key)).map(key => byPreviousKey.get(key));
    const change = selection.replace(keys);

    this.#selectionAnchor = undefined;

    if (notify) {
      this.#applySelection(change, 'api');
    }
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

    return isDataRow(row) ? { key: this.#keyOf(row.item) } : isDetailRow(row) ? { detailOf: this.#keyOf(row.item) } : { rowKey: row.key };
  }

  #isRefAt(index: number, target: ActiveRef): boolean {
    if ('totals' in target) {
      return index === this.#rows.length;
    }

    const row = this.#rowAt(index);

    if (!row) {
      return false;
    }

    if ('detailOf' in target) {
      return isDetailRow(row) && this.#keyOf(row.item) === target.detailOf;
    }

    return 'key' in target ? isDataRow(row) && this.#keyOf(row.item) === target.key : row.key === target.rowKey;
  }

  #leadingNavColumns(): NavColumn[] {
    const leading: NavColumn[] = [];

    if (this.#showDetailColumn) {
      leading.push(DETAIL_TOGGLE_COLUMN);
    }

    if (this.#showSelectionColumn) {
      leading.push(SELECTION_COLUMN);
    }

    return leading;
  }

  #currentNavColumns(): NavColumn[] {
    const leading = this.#leadingNavColumns();

    // Coluna de botões da edição (frente 09) depois das colunas comuns.
    return this.#showCommandColumn
      ? [...leading, ...this._visibleColumns, COMMAND_COLUMN]
      : [...leading, ...this._visibleColumns];
  }

  /**
   * Cabeçalho lógico (todas as colunas navegáveis, sem virtualização): níveis
   * e a célula de cada (nível, coluna) para a navegação entre níveis.
   */
  #updateHeaderGrid(navColumns: NavColumn[]): void {
    if (!this.showColumnHeaders) {
      this.#headerLevels = 0;
      this.#headerGrid = [];
      this.#headerGridKey = undefined;
      return;
    }

    // Mesmas colunas e árvore (rolagem): o cabeçalho lógico não muda.
    const key = this.#headerGridKey;
    const leading = this.#leadingNavColumns().join();

    if (key?.visible === this._visibleColumns && key.tree === this.#columnTree && key.leading === leading) {
      return;
    }

    this.#headerGridKey = { visible: this._visibleColumns, tree: this.#columnTree, leading };

    const slots: HeaderSlot<NavColumn>[] = navColumns.map(column => ({
      leaf: column,
      chain: typeof column === 'object' ? this._bandChainOf(column) : [],
    }));
    const levels = 1 + slots.reduce((max, slot) => Math.max(max, slot.chain.length), 0);

    this.#headerLevels = levels;
    this.#headerGrid = buildHeaderRows(slots, levels);
  }

  /** Célula do cabeçalho em (linha `-níveis..-1`, coluna navegável). */
  #headerCellAt(row: number, col: number): HeaderCellLayout<NavColumn> | undefined {
    return headerCellAt(this.#headerGrid, row + this.#headerLevels, col);
  }

  /** Banda ou coluna da célula ativa do cabeçalho (`undefined` fora dele). */
  #activeHeaderColumn(): NavColumn | undefined {
    return this.#activeRowIndex < 0 ? this.#headerCellAt(this.#activeRowIndex, this.#activeCol)?.column ?? undefined : undefined;
  }

  #publicFocus(): PublicFocus {
    const column = this.#activeColumn;
    const row = this.#rowAt(this.#activeRowIndex);

    if (!row) {
      const header = this.#activeRowIndex < 0;
      // No cabeçalho de banda, a coluna é a banda.
      return { rowKey: null, column: dataColumnOf(header ? this.#activeHeaderColumn() ?? column : column), cellType: header ? 'header' : 'summary' };
    }

    if (row.isGroup) {
      return { rowKey: null, column: null, cellType: 'group' };
    }

    if (row.isFooter) {
      return { rowKey: null, column: dataColumnOf(column), cellType: 'summary' };
    }

    // Esqueleto (frente 08): ainda sem item, sem chave.
    const rowKey = !row.isDetail && row.skeleton ? null : this.#keyOf(row.item);

    if (row.isDetail) {
      return { rowKey, column: null, cellType: 'detail' };
    }

    if (column === DETAIL_TOGGLE_COLUMN) {
      return { rowKey, column: null, cellType: 'detail-toggle' };
    }

    if (column === COMMAND_COLUMN) {
      return { rowKey, column: null, cellType: 'command' };
    }

    return column === SELECTION_COLUMN || !column
      ? { rowKey, column: null, cellType: column ? 'selection' : 'data' }
      : { rowKey, column, cellType: 'data' };
  }

  #revealAttempts = 0;

  /** Move a célula ativa. `source` nulo = setter (sem evento). */
  #setActive(
    { row, col }: CellPosition,
    source: GridChangeSource | null,
    { focus = false, reveal = false }: { focus?: boolean; reveal?: boolean } = {},
  ): void {
    const navColumns = this.#currentNavColumns();
    const index = row < 0 || this.#refAt(row) ? row : this.#activeRowIndex;

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

    if (active && !this.#isRefAt(index, active) && 'rowKey' in active && active.rowKey.startsWith('s:')) {
      // Esqueleto que carregou (frente 08): a mesma posição do mesmo bloco, agora com item.
      const found = rows.indexOfSkeletonKey(active.rowKey);

      if (found >= 0) {
        index = found;
      }
    } else if (active && !this.#isRefAt(index, active)) {
      // Detalhe recolhido com o foco nele: o foco volta à linha mestre.
      const found = 'totals' in active
        ? this.#hasTotals ? rows.length : -1
        : 'detailOf' in active
          ? detailOrMaster(rows, active.detailOf, this.#keyExpr ? this.#keyOf : undefined)
          : 'key' in active ? rows.indexOfDataKey(active.key, this.#keyExpr ? this.#keyOf : undefined) : rows.indexOfKey(active.rowKey);
      index = found >= 0 ? found : index;
    }

    const lastRow = rows.length - (this.#hasTotals ? 0 : 1);

    if (index > lastRow) {
      index = lastRow;
    }

    if (index < 0 && !this.showColumnHeaders && rows.length) {
      index = 0;
    }

    // Cabeçalho com menos níveis (banda saiu): o nível mais próximo que existe.
    if (index < -Math.max(this.#headerLevels, 1)) {
      index = -Math.max(this.#headerLevels, 1);
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
    // Só células do próprio grid (não o conteúdo de renderers, com seus `tabindex`).
    return this.#tableRef.value?.querySelector<HTMLElement>(':scope > thead > tr > [tabindex="0"], :scope > tbody > tr > [tabindex="0"], :scope > tfoot > tr > [tabindex="0"]') ?? null;
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
      // Cabeçalho/barra presos no topo e rodapé de totais preso embaixo: a
      // célula do corpo não para embaixo deles (WCAG 2.4.11).
      const inBody = cell.closest('tbody') !== null;
      scroller.style.scrollPaddingBlockStart = cell.tagName === 'TH' ? '0px' : `${this.#stickyTop()}px`;
      scroller.style.scrollPaddingBlockEnd = inBody ? `${this.#stickyBottom()}px` : '0px';
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

  /** Altura do rodapé de totais (preso no fim da rolagem). */
  #stickyBottom(): number {
    return this.renderRoot.querySelector<HTMLElement>('tfoot')?.offsetHeight ?? 0;
  }

  /** Linhas do corpo que cabem na área visível. */
  #pageSize(): number {
    const scroller = this._scrollContainerRef.value;

    if (!scroller) {
      return 1;
    }

    return Math.max(1, Math.floor((scroller.clientHeight - this.#stickyTop() - this.#stickyBottom()) / this.rowHeight));
  }

  /** Célula navegável (td/th com `data-col`) no caminho do evento. */
  #navCellOf(path: EventTarget[]): HTMLElement | undefined {
    const table = this.#tableRef.value;

    for (const node of path) {
      if (node === table) {
        return undefined;
      }

      // Só células desta tabela (não as de um grid aninhado no detalhe).
      if (
        node instanceof HTMLElement
        && node.hasAttribute('data-col')
        && (node.tagName === 'TD' || node.tagName === 'TH')
        && node.parentElement?.parentElement?.parentElement === table
      ) {
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
    // Cabeçalho: nível de baixo da célula (`data-level`) → linha `-níveis..-1`.
    const row = section === 'THEAD'
      ? Number(cell.getAttribute('data-level') ?? this.#headerLevels - 1) - this.#headerLevels
      : section === 'TFOOT' ? this.#rows.length : Number(tr.getAttribute('data-index') ?? NaN);

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

    // Mesma célula do cabeçalho (banda ou folha com `rowspan`): o nível lembrado fica.
    if (position.row < 0 && this.#activeRowIndex < 0 && this.#headerCellAt(position.row, position.col)?.column === this.#activeHeaderColumn()) {
      return;
    }

    const sameRow = position.row === this.#activeRowIndex;

    const singleCell = this.#rowAt(position.row);

    if (!sameRow || (position.col !== this.#activeCol && !singleCell?.isGroup && !singleCell?.isDetail)) {
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

    // Editor aberto: Enter/Tab/Esc são da edição (antes do "conteúdo da célula").
    if (this.#editor && this.#onEditorKeyDown(event, cell, position)) {
      return;
    }

    // Foco dentro do conteúdo da célula (Enter/F2): as teclas são dele; Esc volta à célula.
    if (path[0] !== cell) {
      if (event.key === 'Escape') {
        event.preventDefault();
        cell.focus();
      } else if (event.key === 'Tab' && position.row >= 0 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        // Conteúdo da célula: Tab circula entre os focáveis dela (spec 17, A12).
        if (cycleWithin(cell, path[0] as Element, event.shiftKey)) {
          event.preventDefault();
        }
      } else if (event.key === 'F2' && position.row < 0) {
        // F2 percorre o conteúdo do cabeçalho (spec 05: funil, depois a alça) e volta à célula.
        const controls = this.#headerControls(cell);
        const next = controls[controls.indexOf(path[0] as HTMLElement) + 1] ?? cell;
        event.preventDefault();
        next.focus();
      }

      return;
    }

    // Célula ativa do cabeçalho (banda, folha com `rowspan`): nível e coluna lembrados, não os do DOM.
    if (position.row < 0 && this.#activeRowIndex < 0 && this.#headerCellAt(position.row, position.col)?.column === this.#activeHeaderColumn()) {
      position.row = this.#activeRowIndex;
      position.col = this.#activeCol;
    }

    const ctrl = event.ctrlKey || event.metaKey;
    const row = this.#rowAt(position.row);
    // No cabeçalho a coluna vem da célula (banda ou folha).
    const column = position.row < 0 ? this.#headerCellAt(position.row, position.col)?.column ?? this.#navColumns[position.col] : this.#navColumns[position.col];

    if (position.row < 0 && column && this.#onHeaderKeyDown(event, cell, column)) {
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
      } else if (event.key === 'F2') {
        // Conteúdo interativo do `groupRenderer` (o botão de expandir está fora da célula).
        if (focusFirstWithin(cell)) {
          event.preventDefault();
        }
      } else if (ctrl && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'g') {
        // Ctrl+G na linha de grupo desagrupa a coluna dela (spec 17, A8): sem o
        // painel de grupos é o único caminho de volta do Ctrl+G do cabeçalho.
        event.preventDefault();
        this.#userUngroup(row.column);
      }

      return;
    }

    if (row.isDetail) {
      if ((event.key === 'Enter' || event.key === 'F2') && focusFirstWithin(cell)) {
        event.preventDefault();
      }

      return;
    }

    if (!isDataRow(row)) {
      return;
    }

    if (column === DETAIL_TOGGLE_COLUMN) {
      if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
        event.preventDefault();
        this.#setRowExpanded(this.#keyOf(row.item), !this.#isRowExpandedKey(this.#keyOf(row.item)), 'user');
      }

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
      if (typeof column === 'object' && this.#editingOn && this.#editFromCell(position, column)) {
        event.preventDefault();
      } else if (focusFirstWithin(cell)) {
        event.preventDefault();
      }
    }
  };

  /** Enter/F2 numa célula de dados: abre o editor (ou leva o foco ao já aberto). */
  #editFromCell(position: CellPosition, column: GridColumnDef): boolean {
    const editor = this.#editor;
    const row = this.#rowAt(position.row);

    if (editor && isDataRow(row) && editor.rowKey === this.#keyOf(row.item) && (editor.wholeRow || editor.column === column)) {
      editor.column = column;
      editor.focus = true;
      this.requestUpdate();
      return true;
    }

    return this.#startEdit(position.row, column, 'user');
  }

  /** Teclas com o foco num editor (ou nos botões da linha em edição, modo linha). */
  #onEditorKeyDown(event: KeyboardEvent, cell: HTMLElement, position: CellPosition): boolean {
    const editor = this.#editor!;
    const row = this.#rowAt(position.row);

    if (!isDataRow(row) || this.#keyOf(row.item) !== editor.rowKey || event.ctrlKey || event.metaKey || event.altKey) {
      return false;
    }

    const column = this.#navColumns[position.col];
    const inside = event.composedPath()[0] !== cell;
    const inEditor = inside && cell.classList.contains('editing');
    const inRowButtons = inside && editor.wholeRow && column === COMMAND_COLUMN;

    if (event.key === 'Escape' && editor.wholeRow && !inside) {
      // Modo linha: Esc em qualquer célula da linha aberta cancela a linha.
      event.preventDefault();
      this.#cancelEditor('user');
      return true;
    }

    if (!inEditor && !inRowButtons) {
      return false;
    }

    this.#revealEditingRow(event);

    if (event.key === 'Escape') {
      event.preventDefault();
      this.#cancelEditor('user');
      return true;
    }

    if (event.key === 'Tab') {
      event.preventDefault();

      if (editor.wholeRow) {
        this.#tabInRow(cell, event.shiftKey);
      } else {
        const back = event.shiftKey;
        this.#commitAndThen('user', () => this.#tabToEditable(this.#positionByKey(editor.rowKey, position), back));
      }

      return true;
    }

    if (event.key === 'Enter' && inEditor) {
      event.preventDefault();

      if (editor.wholeRow) {
        void this.#save('user');
      } else {
        const delta = event.shiftKey ? -1 : 1;
        this.#commitAndThen('user', () => this.#moveAfterCommit(this.#positionByKey(editor.rowKey, position), delta));
      }

      return true;
    }

    return false;
  }

  /** Posição atual da linha `rowKey` (salvar pode ter mudado o índice), mesma coluna. */
  #positionByKey(rowKey: unknown, fallback: CellPosition): CellPosition {
    const row = this.#rowIndexOfKey(rowKey);
    return { row: row >= 0 ? row : fallback.row, col: fallback.col };
  }

  /** Enter confirmou: a célula da mesma coluna na linha de dados de baixo (Shift: de cima). */
  #moveAfterCommit(position: CellPosition, delta: number): void {
    let row = position.row + delta;

    while (row >= 0 && row < this.#rows.length && !isDataRow(this.#rowAt(row))) {
      row += delta;
    }

    const target = row >= 0 && row < this.#rows.length ? row : position.row;
    this.#setActive({ row: target, col: position.col }, 'user', { focus: true, reveal: true });
  }

  /** Tab confirmou: abre a próxima célula editável (pula grupos, detalhes, removidas); nas pontas, foco na célula. */
  #tabToEditable(position: CellPosition, back: boolean): void {
    const navColumns = this.#currentNavColumns();
    const step = back ? -1 : 1;
    let row = position.row;
    let col = position.col + step;
    // Não varre a lista inteira (1 milhão de linhas) procurando: algumas telas bastam.
    let budget = Math.max(navColumns.length, 1) * 200;

    while (row >= 0 && row < this.#rows.length && budget-- > 0) {
      const candidate = this.#rowAt(row);

      if (isDataRow(candidate) && !candidate.skeleton) {
        const pending = this.#pendingOf(candidate);

        for (; col >= 0 && col < navColumns.length; col += step) {
          const column = navColumns[col];

          if (typeof column === 'object' && this.#cellEditable(candidate, column, pending)) {
            this.#startEdit(row, column, 'user');
            return;
          }
        }
      }

      row += step;
      col = back ? navColumns.length - 1 : 0;
    }

    this.#setActive(position, 'user', { focus: true, reveal: true });
  }

  /** Modo linha: Tab percorre os editores da linha e os botões Salvar/Cancelar (circular). */
  #tabInRow(cell: HTMLElement, back: boolean): void {
    const tr = cell.closest('tr');

    if (!tr) {
      return;
    }

    const targets: (HTMLElement | SVGElement)[] = [];

    for (const td of tr.querySelectorAll<HTMLElement>(':scope > td.editing, :scope > td.command-cell')) {
      targets.push(...focusTargetsWithin(td));
    }

    if (!targets.length) {
      return;
    }

    const active = this.shadowRoot?.activeElement ?? document.activeElement;
    const current = targets.findIndex(target => target === active || target.contains(active));
    const next = targets[(current + (back ? -1 : 1) + targets.length) % targets.length];
    // Confirma o que foi digitado (validação na hora); a linha continua aberta.
    void this.#commitEditor();
    next.focus();
  }

  /** Perda de foco do editor (clique fora): válido confirma; inválido fica pendente marcado. */
  readonly #onGridFocusOut = (event: FocusEvent): void => {
    const editor = this.#editor;

    if (!editor || editor.wholeRow) {
      return;
    }

    const cell = this.#navCellOf(event.composedPath());

    if (!cell?.classList.contains('editing')) {
      return;
    }

    queueMicrotask(() => {
      if (this.#editor !== editor || (typeof document.hasFocus === 'function' && !document.hasFocus())) {
        return;
      }

      const active = this.shadowRoot?.activeElement;

      // Ainda no editor (o foco andou dentro da célula) ou no editor do light DOM.
      if ((active && cell.contains(active)) || (document.activeElement && document.activeElement !== this && this.contains(document.activeElement))) {
        return;
      }

      this.#commitAndThen('user', () => undefined, { blur: true });
    });
  };

  /** Clique ou duplo clique (`editTrigger`) numa célula editável abre o editor. */
  #onEditPointer(event: MouseEvent, trigger: GridEditTrigger): void {
    if (!this.#editingOn || this.#editMode === 'row' || (this.editTrigger === 'dblclick' ? 'dblclick' : 'click') !== trigger) {
      return;
    }

    const path = event.composedPath();
    const cell = this.#navCellOf(path);
    const position = cell && this.#positionOf(cell);

    const onContent = path[0] !== cell
      && path.some(node => node instanceof HTMLElement && node !== cell && cell?.contains(node) && node.matches(TABBABLE_IN_CELL));

    if (!cell || !position || cell.classList.contains('editing') || onContent) {
      return;
    }

    const column = this.#currentNavColumns()[position.col];

    if (typeof column === 'object') {
      this.#startEdit(position.row, column, 'user');
    }
  }

  readonly #onBodyDblClick = (event: MouseEvent): void => {
    this.#onEditPointer(event, 'dblclick');
  };

  readonly #onBodyPointerDown = (event: PointerEvent): void => {
    const target = event.composedPath()[0];
    this.#checkboxPointer = target instanceof HTMLInputElement && target.classList.contains('cell-editor-checkbox');
  };

  /** Alvos do F2 no cabeçalho, em ordem: conteúdo do `headerRenderer`, funil, menu, alça. */
  #headerControls(cell: HTMLElement): (HTMLElement | SVGElement)[] {
    const label = cell.querySelector<HTMLElement>('.header-text');

    return [
      ...label ? focusTargetsWithin(label) : [],
      ...cell.querySelectorAll<HTMLElement>('.header-filter-button, .column-header-menu-button, .resize-handle'),
    ];
  }

  /** Teclas próprias do cabeçalho; `true` = tratada. */
  #onHeaderKeyDown(event: KeyboardEvent, cell: HTMLElement, column: NavColumn | undefined): boolean {
    if (typeof column === 'object' && this._isBand(column)) {
      return this.#onBandKeyDown(event, cell, column);
    }

    if (column === SELECTION_COLUMN) {
      if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
        event.preventDefault();
        this.#toggleAll();
        return true;
      }

      return false;
    }

    if (!column || column === DETAIL_TOGGLE_COLUMN || column === COMMAND_COLUMN) {
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

      // `groupable: false` recusa: nada a anunciar (spec 17).
      if (this._groupColumns.includes(column)) {
        this.#announce(formatMessage(this.#translation.groupedAnnouncement, { column: column.label ?? '' }));
      }

      this.#focusPending = true;
      return true;
    }

    if (isContextMenuKey(event)) {
      // Menu do cabeçalho pelo teclado (spec 17, A1); abre sob o cabeçalho.
      if (this.columnHeaderMenu && this.#columnMenuItems(column).length) {
        event.preventDefault();
        this.#columnMenu.show({ column, returnFocus: cell });
      }

      return true;
    }

    if (event.key === 'F2') {
      // Conteúdo interativo do cabeçalho (fora da ordem de Tab): o do `headerRenderer`, funil, menu, alça.
      const target = this.#headerControls(cell)[0];

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

  /** Banda (frente 13): só mover (Alt+Shift+←/→), menu (Shift+F10) e F2; não ordena nem agrupa. */
  #onBandKeyDown(event: KeyboardEvent, cell: HTMLElement, band: GridColumnDef): boolean {
    const ctrl = event.ctrlKey || event.metaKey;

    if (event.altKey && event.shiftKey && !ctrl && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      const forward = (event.key === 'ArrowRight') !== this._isRtl();
      this.#keyboardMoveColumn(band, forward ? 1 : -1);
      return true;
    }

    if (isContextMenuKey(event)) {
      if (this.columnHeaderMenu && this.#columnMenuItems(band).length) {
        event.preventDefault();
        this.#columnMenu.show({ column: band, returnFocus: cell });
      }

      return true;
    }

    if (event.key === 'F2') {
      const target = this.#headerControls(cell)[0];

      if (target) {
        event.preventDefault();
        target.focus();
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

    // Cabeçalho multinível (frente 13): navegação espacial entre os níveis.
    if (position.row < 0 && this.#headerLevels) {
      const next = nextHeaderCell(position, key, {
        levels: this.#headerLevels,
        colCount: this.#navColumns.length,
        hasBody: this.#rows.length + (this.#hasTotals ? 1 : 0) > 0,
        cellAt: (level, col) => headerCellAt(this.#headerGrid, level, col),
      });

      if (next) {
        this.#setActive(next, 'user', { focus: true });
        return;
      }
    }

    if (key === 'gridHome' && this.showColumnHeaders && this.#headerLevels > 1) {
      this.#setActive({ row: -this.#headerLevels, col: 0 }, 'user', { focus: true });
      return;
    }

    // Com paginação, PageUp/PageDown no corpo trocam de página (como a referência).
    if (this.paging && (key === 'pageUp' || key === 'pageDown') && position.row >= 0 && !event.shiftKey) {
      const target = this.#pageIndex + (key === 'pageDown' ? 1 : -1);

      if (target >= 0 && target < this.#pageCount()) {
        this.#setPage(target, this.#effectivePageSize, 'user');
        this.#setActive({ row: position.row, col: position.col }, 'user', { focus: true });
        return;
      }
    }

    const next = nextCell({ row: position.row, col: row?.isGroup || row?.isDetail ? this.#activeCol : position.col }, key, {
      rowCount: this.#rows.length + (this.#hasTotals ? 1 : 0),
      colCount: this.#navColumns.length,
      hasHeader: this.showColumnHeaders,
      pageSize: this.#pageSize(),
      // Linha de grupo e de detalhe: uma célula só.
      isGroupRow: index => {
        const target = this.#rowAt(index);
        return !!target?.isGroup || !!target?.isDetail;
      },
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

  /**
   * Alt+Shift+←/→ no cabeçalho: troca a coluna (ou a banda inteira) com a
   * irmã visível do mesmo bloco; coluna de banda não sai dela.
   */
  #keyboardMoveColumn(column: GridColumnDef, direction: 1 | -1): void {
    const movable = this.#movableSiblingsOf(column);
    const neighbor = movable[movable.indexOf(column) + direction];

    if (!neighbor) {
      return;
    }

    const neighborIndex = this._siblingIndexOf(neighbor);
    this._userMoveColumn(column, direction > 0 ? neighborIndex + 1 : neighborIndex);

    // Posição entre as irmãs visíveis (o `_regularColumns` já tem a ordem nova).
    const visibleAfter = this.#siblingsOf(column).filter(sibling => this._isColumnVisible(sibling));

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
        this.#announceGroupLevel(column);
        this.#focusChip(target);
      }

      return;
    }

    if ((ctrl && !event.altKey && event.key.toLowerCase() === 'g') || event.key === 'Delete') {
      event.preventDefault();
      this.#activeChip = Math.min(index, Math.max(count - 2, 0));
      this.#userUngroup(column);
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

  /** Novo nível de uma coluna agrupada (Alt+Shift+←/→ no chip ou menu do painel). */
  #announceGroupLevel(column: GridColumnDef): void {
    this.#announce(formatMessage(this.#translation.groupLevelChangedAnnouncement, {
      column: column.label ?? '',
      level: String(this._groupColumns.indexOf(column) + 1),
      count: String(this._groupColumns.length),
    }));
  }

  /** Largura da coluna depois de redimensionar pelo cabeçalho (teclado: com espera; menu: na hora). */
  #announceWidth(column: GridColumnDef, delay: number): void {
    const announce = () => this.#announce(formatMessage(this.#translation.columnResizedAnnouncement, {
      column: column.label ?? '',
      width: String(Math.round(this.#widthOf(column) ?? this._boundsOf(column).width)),
    }));

    if (delay) {
      this.#resizeAnnouncer.run('resize', announce, delay);
    } else {
      this.#resizeAnnouncer.cancel('resize');
      announce();
    }
  }

  /** Desagrupa pelo teclado (chip ou linha de grupo): anuncia e leva o foco ao cabeçalho da coluna devolvida. */
  #userUngroup(column: GridColumnDef): void {
    this.#moveColumnTo(false, column, this._regularColumns.length, 'user');
    this.#announce(formatMessage(this.#translation.ungroupedAnnouncement, { column: column.label ?? '' }));
    // O foco vai ao cabeçalho da coluna devolvida (fim das comuns); sem cabeçalho, a guarda de foco acha a célula ativa.
    void this.updateComplete.then(() => {
      const col = this.#currentNavColumns().indexOf(column);

      if (col >= 0 && this.showColumnHeaders) {
        this.#setActive({ row: HEADER_ROW, col }, 'user', { focus: true });
      }
    });
  }

  #focusChip(index: number): void {
    this.#activeChip = index;
    this.#chipFocusPending = true;
    this.requestUpdate();
  }

  // ----------------------------------------------------------------- render

  override render() {
    // Esperando o estado (storage assíncrono, SSR/hidratação com storage):
    // sem linhas (nem o cálculo delas), conteúdo oculto, painel de carga.
    const waiting = this.#waitingForState;

    if (!waiting) {
      this.#renderedData = true;
      this.#ensureRows();
    }

    this.#hasWrap = this._visibleColumns.some(column => column.wrap);

    const rows = this.#rows;
    const virtualizer = this.#virtualizer;

    virtualizer.count = rows.length;

    // Antes de medir (1º render, SSR, contêiner sem altura) a janela são as
    // primeiras linhas, em vez de "sem dados".
    const window = virtualizer.renderWindow();
    this.#lastWindowFirst = rows.offset + window.first;

    const navColumns = this.#currentNavColumns();
    this.#updateHeaderGrid(navColumns);
    this.#resolveActive(navColumns);

    // Virtualização de colunas: só as da janela, as fixas e a ativa (frente 13).
    const layout = this.#columnLayout(this.#columnPlan());
    const headerRows = this.#headerLevels + (this.showFilterRow ? 1 : 0);
    const footerRows = this.#totalSpecs.length ? 1 : 0;
    const selectionMode = this.#selectionMode;
    const classes = {
      striped: this.striped,
      'row-lines': this.showRowLines,
      'column-lines': this.showColumnLines,
    };

    // Com todas as larguras definidas a tabela não estica: soma exata (como
    // no modo `widget` da referência). Com alguma automática, ocupa a largura.
    const fit = layout.length > 0 && (this.#virtualColumns || layout.every(({ column }) =>
      this.#userWidths.has(column) || (column.width !== null && column.width !== undefined)));

    // O foco de teclado (`focus()`/`scrollIntoView`) não para sob o que é fixo/sticky.
    const fixedEnd = layout.reduce((sum, { column, width }) => sum + (this._fixedOf(column) === 'end' ? width ?? 0 : 0), 0);
    const fixedStart = layout.reduce((sum, { column, width }) => sum + (this._fixedOf(column) === 'start' ? width ?? 0 : 0), 0);
    // A barra de erro cobre o pé da área de rolagem: o foco não para debaixo dela.
    const scrollPadding = `scroll-padding-inline: ${this.#stickyStart() + fixedStart}px ${fixedEnd}px;`
      + (this.#dataSource && this.#loader.error ? ' scroll-padding-block-end: 56px;' : '');

    // Coluna flex: a área do grid e o pager (que pode quebrar linha) dividem a altura.
    return html`
      <div class=${waiting ? 'layout state-loading' : 'layout'}>
      <div
        class="container ${classMap(classes)}"
        ${ref(this._containerRef)}>
        <div class="scroll-container" style=${scrollPadding} .inert=${waiting} ${ref(this._scrollContainerRef)}>
          ${this.#renderToolbar()}
          <table
            class=${fit ? 'grid-table fit' : 'grid-table'}
            role=${this._groupColumns.length ? 'treegrid' : 'grid'}
            aria-label=${ifDefined(this.#hostLabel.name || undefined)}
            aria-rowcount="${waiting || this.#unknownRowCount ? -1 : this.#allRows.length + this.#added.size + headerRows + footerRows}"
            aria-colcount="${navColumns.length}"
            aria-multiselectable=${ifDefined(selectionMode === 'multiple' ? 'true' : undefined)}
            aria-busy=${ifDefined(waiting || this.#isLoading || this.#filtering.pending ? 'true' : undefined)}
            ${ref(this.#tableRef)}
            @pointerover=${this.#updateCellHint}
            @keydown=${this.#onGridKeyDown}
            @copy=${this.#onCopy}
            @beforecopy=${this.#onBeforeCopy}
            @focusin=${this.#onGridFocusIn}
            @focusout=${this.#onGridFocusOut}>
            <colgroup>${this.#renderColGroups(layout)}</colgroup>
            ${this.#renderColumnHeaders(layout)}
            <tbody
              role="rowgroup"
              style="height: ${virtualizer.getTotalSize()}px;"
              @click=${this.#onBodyClick}
              @dblclick=${this.#onBodyDblClick}
              @pointerdown=${this.#onBodyPointerDown}>
              <tr class="spacer" role="presentation" aria-hidden="true" style="height: ${window.offset}px;"></tr>
              ${this.#renderBody(window, headerRows, layout)}
              <tr role="presentation"></tr>
            </tbody>
            ${footerRows ? this.#renderTotalFooter(layout, this.#allRows.length + headerRows + 1) : nothing}
          </table>
        </div>
        ${this.#inTextLanguage(this.#renderLoadState())}
        ${this.#inTextLanguage(this.#chooser.open ? this.#renderColumnChooser() : nothing)}
        ${this.#inTextLanguage(this.headerFilter ? renderHeaderFilter(this.#headerFilterPopover, this.#translation) : nothing)}
        ${this.#inTextLanguage(this.#filterRow.menuColumn
          ? renderFilterMenu(this.#filterRow, this.#filterRow.menuColumn, this.#dataTypeOf(this.#filterRow.menuColumn), this.#translation)
          : nothing)}
      </div>
      ${this.#inTextLanguage(this.paging ? this.#renderPager() : nothing)}
      </div>
      ${this.#inTextLanguage(this.#groupMenu.open ? this.#renderGroupPanelMenu() : nothing)}
      ${this.#inTextLanguage(this.#columnMenu.open ? this.#renderColumnHeaderMenu() : nothing)}
      <div class="visually-hidden" role="status" aria-live="polite" aria-atomic="true" lang=${this.#textLanguage}>${this.#announcement}</div>
      ${this.#editingOn
        ? html`<div hidden lang=${this.#textLanguage}><span id="edit-desc-added">${this.#translation.addedRowDescription}</span><span
            id="edit-desc-removed">${this.#translation.removedRowDescription}</span><span
            id="edit-desc-modified">${this.#translation.modifiedCellDescription}</span></div>`
        : nothing}
      ${this.#renderRemoveDialog()}
      <slot hidden @slotchange=${this.#readDeclarativeColumns}></slot>
    `;
  }

  #renderColGroups(layout: ColumnLayout[]): HTMLTemplateResult {
    return html`
      ${map(this._groupColumns, () => html`
        <col class="group-column"/>`)}
      ${this.#showDetailColumn ? html`<col class="detail-toggle-column"/>` : nothing}
      ${this.#showSelectionColumn ? html`<col class="selection-column"/>` : nothing}
      ${map(layout, ({ column, gapBefore }) => {
        const width = this.#widthOf(column);
        const colStyles: { width?: string } = {};

        if (width !== undefined) {
          colStyles.width = `${width}px`;
        }

        return html`${gapBefore ? html`<col class="column-spacer" style="width: ${gapBefore}px"/>` : nothing}
          <col style="${styleMap(colStyles)}"/>`;
      })}
      ${this.#trailingGap ? html`<col class="column-spacer" style="width: ${this.#trailingGap}px"/>` : nothing}
      ${this.#showCommandColumn ? html`<col class="command-column"/>` : nothing}
    `;
  }

  /**
   * Células por coluna: com a virtualização de colunas a janela desliza e
   * cada célula precisa seguir a SUA coluna (chave), senão o elemento focado
   * passaria a mostrar a vizinha. Sem virtualização, por posição (mais barato).
   */
  get #cellKey(): ((cell: SummaryColumnLayout) => unknown) | undefined {
    return this.#virtualColumns ? cell => (cell as ColumnLayout).id : undefined;
  }

  #mapCells(layout: ColumnLayout[], render: (cell: ColumnLayout) => unknown) {
    // `keyedRows`, não o `repeat` do Lit (deixa um comentário por item removido; spec 14).
    return this.#virtualColumns ? keyedRows(layout, cell => cell.id, render) : map(layout, render);
  }

  /** Célula espaçadora (colunas fora do DOM): sem papel, sem índice, sem `part`. */
  #spacerCell(width: number) {
    return width ? html`<td class="column-spacer" role="presentation"></td>` : nothing;
  }

  #trailingSpacerCell() {
    return this.#spacerCell(this.#trailingGap);
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
        ${this.showColumnHeaders ? this.#renderHeaderRows(layout) : nothing}
        ${this.showFilterRow ? this.#renderFilterRow(layout) : nothing}
      </thead>
    `;
  }

  /** Linha de filtro: um editor por coluna visível filtrável. */
  #renderFilterRow(layout: ColumnLayout[]) {
    const translation = this.#translation;

    return html`
      <tr class="filter-row" part="filter-row" role="row" aria-rowindex=${this.#headerLevels + 1}>
        ${map(this._groupColumns, (_, index) => html`
          <td
            role="presentation"
            class="group-column sticky-cell"
            style="inset-inline-start: ${index * GROUP_COLUMN_WIDTH}px"></td>`)}
        ${this.#renderEmptyDetailToggleCell(null)}
        ${this.#showSelectionColumn
          ? html`<td
            class="selection-cell sticky-cell"
            part="selection-cell"
            role="gridcell"
            aria-colindex=${this.#selectionCol + 1}
            style="inset-inline-start: ${this.#selectionInset}px"></td>`
          : nothing}
        ${this.#mapCells(layout, cell => html`${this.#spacerCell(cell.gapBefore)}${renderFilterCell({
          controller: this.#filterRow,
          column: cell.column,
          dataType: this.#dataTypeOf(cell.column),
          filterable: isColumnFilterable(cell.column),
          translation,
          className: cell.className,
          style: cell.style,
          colIndex: cell.col + 1,
        })}`)}
        ${this.#trailingSpacerCell()}
        ${this.#renderEmptyCommandCell(null, this.#leadingColumns + this._visibleColumns.length)}
      </tr>`;
  }

  /**
   * Linhas do cabeçalho (frente 13): uma por nível, banda com `colspan`
   * nativo, folha sem banda acima com `rowspan` até o fim; recuos, caixa,
   * detalhe e espaçadoras da virtualização ocupam todos os níveis.
   */
  #renderHeaderRows(layout: ColumnLayout[]) {
    const levels = this.#headerLevels;
    const slots: HeaderSlot<NavColumn>[] = [];
    // Por posição: entrada do layout (folhas renderizadas) ou `null` (caixa, detalhe, espaçadora).
    const cells: (ColumnLayout | null)[] = [];

    for (const column of this.#leadingNavColumns()) {
      slots.push({ leaf: column, chain: [] });
      cells.push(null);
    }

    let previousChain: readonly GridColumnDef[] = [];

    for (const cell of layout) {
      const chain = this._bandChainOf(cell.column);

      if (cell.gapBefore) {
        // Espaçadora sob as bandas comuns aos vizinhos: a banda não se parte.
        slots.push({ leaf: null, chain: commonPrefix(previousChain, chain) });
        cells.push(null);
      }

      slots.push({ leaf: cell.column, chain });
      cells.push(cell);
      previousChain = chain;
    }

    if (this.#trailingGap) {
      slots.push({ leaf: null, chain: [] });
      cells.push(null);
    }

    if (this.#showCommandColumn) {
      // Coluna de botões da edição (frente 09): todos os níveis, depois das comuns.
      slots.push({ leaf: COMMAND_COLUMN, chain: [] });
      cells.push(null);
    }

    const rows = buildHeaderRows<NavColumn>(slots, levels);
    const active = this.#activeHeaderColumn();
    const rowSorting = this.#sorting.filter(spec => !this.#isGrouped(spec.column));
    const sorting: HeaderSorting = { rowSorting, showIndex: rowSorting.length > 1 };

    return map(rows, (row, level) => html`
        <tr id=${ifDefined(level === 0 ? 'header-columns-row' : undefined)} role="row" aria-rowindex=${level + 1}>
          ${level === 0
            ? map(this._groupColumns, (_, index) => html`
              <th
                role="presentation"
                class="group-column sticky-cell"
                rowspan=${ifDefined(levels > 1 ? levels : undefined)}
                style="inset-inline-start: ${index * GROUP_COLUMN_WIDTH}px"></th>`)
            : nothing}
          ${this.#virtualColumns
            ? keyedRows(row, header => headerKeyOf(header), header => this.#renderHeaderSlot(header, cells, active, sorting))
            : map(row, header => this.#renderHeaderSlot(header, cells, active, sorting))}
        </tr>`);
  }

  #renderHeaderSlot(
    header: HeaderCellLayout<NavColumn>,
    cells: readonly (ColumnLayout | null)[],
    active: NavColumn | undefined,
    { rowSorting, showIndex }: HeaderSorting,
  ) {
    const rowSpan = header.rowSpan > 1 ? header.rowSpan : undefined;
    // Nível de baixo coberto: ↓ de uma folha com `rowspan` sai pelo fim dela.
    const bottom = header.level + header.rowSpan - 1;
    const translation = this.#translation;
    const column = header.column;

    if (column === null) {
      return html`<th class="column-spacer" role="presentation" rowspan=${ifDefined(rowSpan)}></th>`;
    }

    if (column === DETAIL_TOGGLE_COLUMN) {
      return html`
        <th
          class="detail-toggle-cell sticky-cell"
          part="detail-toggle-cell"
          role="columnheader"
          rowspan=${ifDefined(rowSpan)}
          aria-colindex="1"
          data-col="0"
          data-level=${bottom}
          tabindex=${active === column ? 0 : -1}
          style="inset-inline-start: ${this._groupColumns.length * GROUP_COLUMN_WIDTH}px"><span class="visually-hidden">${translation.rowDetails}</span></th>`;
    }

    if (column === SELECTION_COLUMN) {
      const selectionCol = this.#selectionCol;

      return html`
        <th
          class="selection-cell sticky-cell"
          part="selection-cell"
          role="columnheader"
          rowspan=${ifDefined(rowSpan)}
          aria-colindex=${selectionCol + 1}
          data-col=${selectionCol}
          data-level=${bottom}
          tabindex=${active === column ? 0 : -1}
          style="inset-inline-start: ${this.#selectionInset}px"
          @click=${() => this.#toggleAll()}>${this.#lazy
            ? html`<span class="visually-hidden">${translation.selectRow}</span>`
            : this.#renderCheckbox(this.#selectAllState(), translation.selectAllRows)}</th>`;
    }

    if (column === COMMAND_COLUMN) {
      const col = this.#leadingColumns + this._visibleColumns.length;

      return html`<th
        class="command-cell"
        part="command-cell"
        role="columnheader"
        rowspan=${ifDefined(rowSpan)}
        aria-colindex=${col + 1}
        data-col=${col}
        data-level=${bottom}
        tabindex=${active === column ? 0 : -1}><span class="header-text">${translation.commandColumn}</span></th>`;
    }

    if (header.band) {
      return this.#renderBandHeader(column, header, cells, active);
    }

    const cell = cells[header.start]!;
    const filterValue = this.#filtering.filterValue;
    const position = rowSorting.findIndex(spec => spec.column === column);
    const idSuffix = `${header.level}-${cell.col + 1}`;

    return renderHeaderCell({
      column,
      classes: cell.headerClasses,
      styles: cell.headerStyles,
      colIndex: cell.col + 1,
      tabIndex: active === column ? 0 : -1,
      level: bottom,
      rowSpan,
      idSuffix,
      columnId: cell.id,
      sortable: this.#canSortByUser(column),
      order: rowSorting[position]?.order,
      sortIndex: showIndex && position >= 0 ? position + 1 : undefined,
      onActivate: this.#onHeaderActivate,
      onPointerDown: this.#onSortPointerDown,
      // Alt+Shift+←/→ move a coluna (no grid); só Alt+←/→ redimensiona.
      onKeyDown: cell.resizable
        ? (event: KeyboardEvent) => {
          // Na alça focada o leitor lê o aria-valuenow; no cabeçalho, anuncia a largura (spec 17, A6).
          if (!event.shiftKey && this.#resize.keyDown(event, column, true)) {
            this.#announceWidth(column, 500);
          }
        }
        : undefined,
      trailing: cell.resizable ? this.#renderResizeHandle(cell) : nothing,
      filterButton: this.headerFilter && isColumnFilterable(column)
        ? renderHeaderFilterButton(this.#headerFilterPopover, column, filterValue, this.#translation, `header-description-${idSuffix}`)
        : nothing,
      filtered: hasColumnCondition(filterValue, column),
      description: this.#headerDescription(column, rowSorting[position]?.order, position + 1, showIndex, hasColumnCondition(filterValue, column)),
      onContextMenu: this.columnHeaderMenu ? (event: MouseEvent) => this.#onHeaderContextMenu(event, column) : undefined,
      menuButton: this.#renderColumnMenuButton(column),
      keyShortcuts: this.#headerKeyShortcuts(column, cell.resizable),
      label: column.headerRenderer ? this.#renderHeaderContent(column, cell.id) : column.label,
    });
  }

  /** Banda: `colspan` = posições renderizadas sob ela; fixa como as filhas. */
  #renderBandHeader(column: GridColumnDef, header: HeaderCellLayout<NavColumn>, cells: readonly (ColumnLayout | null)[], active: NavColumn | undefined) {
    const children = cells.slice(header.start, header.start + header.span).filter((cell): cell is ColumnLayout => !!cell);
    const first = children[0];
    const last = children[children.length - 1];

    if (!first) {
      return html`<th class="column-spacer" role="presentation" colspan=${header.span}></th>`;
    }

    const translation = this.#translation;
    const side = this._fixedOf(column);
    const alignment = column.alignment ?? 'center';
    const classes: Record<string, boolean> = {
      fixed: !!side,
      'fixed-start': side === 'start',
      'fixed-end': side === 'end',
      'fixed-start-edge': side === 'start' && !!last.headerClasses['fixed-start-edge'],
      'fixed-end-edge': side === 'end' && !!first.headerClasses['fixed-end-edge'],
      'align-center': alignment === 'center',
      'align-end': alignment === 'end',
    };
    const id = columnIdOf(column);
    const hasMenu = this.#hasColumnMenu(column);
    const { insetInlineStart: startOffset } = first.headerStyles;
    const { insetInlineEnd: endOffset } = last.headerStyles;

    return renderBandHeaderCell({
      column,
      classes,
      styles: {
        insetInlineStart: side === 'start' ? startOffset : undefined,
        insetInlineEnd: side === 'end' ? endOffset : undefined,
      },
      colIndex: first.col + 1,
      colSpan: header.span,
      level: header.level,
      tabIndex: active === column ? 0 : -1,
      idSuffix: `${header.level}-${first.col + 1}`,
      columnId: id,
      description: side === 'start' ? translation.columnFixedStart : side === 'end' ? translation.columnFixedEnd : '',
      keyShortcuts: ['Alt+Shift+ArrowLeft', 'Alt+Shift+ArrowRight', ...hasMenu ? ['Shift+F10', 'F2'] : []].join(' '),
      onContextMenu: this.columnHeaderMenu ? (event: MouseEvent) => this.#onHeaderContextMenu(event, column) : undefined,
      menuButton: this.#renderColumnMenuButton(column),
      label: column.headerRenderer ? this.#renderHeaderContent(column, id) : column.label,
    });
  }

  /**
   * Descrição do cabeçalho (spec 17, A14): prioridade da ordenação (só a 1ª
   * coluna leva \`aria-sort\`, a ARIA quer um cabeçalho por vez), fixada e
   * filtrada, num texto só separado por vírgula.
   */
  #headerDescription(column: GridColumnDef, order: GridSortOrder | undefined, priority: number, multiple: boolean, filtered: boolean): string {
    const translation = this.#translation;
    const parts: string[] = [];

    if (order && multiple && priority > 1) {
      parts.push(formatMessage(translation.columnSortPriority, {
        order: order === 'asc' ? translation.sortAscending : translation.sortDescending,
        priority: String(priority),
      }));
    }

    const fixed = this._fixedOf(column);

    if (fixed) {
      parts.push(fixed === 'start' ? translation.columnFixedStart : translation.columnFixedEnd);
    }

    if (filtered) {
      parts.push(translation.columnFiltered);
    }

    return parts.join(', ');
  }

  /** \`aria-keyshortcuts\` do cabeçalho: só as teclas que valem para a coluna (nomes do UI Events). */
  #headerKeyShortcuts(column: GridColumnDef, resizable: boolean): string {
    const keys: string[] = [];
    const funnel = this.headerFilter && isColumnFilterable(column);

    if (this.#hasColumnMenu(column)) {
      keys.push('Shift+F10');
    }

    if (isColumnGroupable(column)) {
      keys.push('Control+G', 'Meta+G');
    }

    keys.push('Alt+Shift+ArrowLeft', 'Alt+Shift+ArrowRight');

    if (resizable) {
      keys.push('Alt+ArrowLeft', 'Alt+ArrowRight');
    }

    if (funnel) {
      keys.push('Alt+ArrowDown');
    }

    if (funnel || resizable || this.#hasColumnMenu(column)) {
      keys.push('F2');
    }

    return keys.join(' ');
  }

  #renderResizeHandle({ column, bounds, width }: ColumnLayout) {
    // Fora da ordem de Tab (o grid tem um ponto só): F2 no cabeçalho chega aqui, Esc volta.
    return html`<div
      class="resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label=${formatMessage(this.#translation.resizeHandleLabel, { column: column.label ?? '' })}
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
      // Carregando pela 1ª vez (ou esperando o estado): o painel fala; "sem dados" só depois da resposta.
      if (this.#waitingForState || (this.#dataSource && !this.#loader.current)) {
        return nothing;
      }

      return html`
        <tr role="row" class="no-data-row">
          <td role="gridcell" part="no-data" lang=${ifDefined(this.noDataRenderer ? undefined : this.#textLanguage)} colspan="${Math.max(this.#totalColumns(layout), 1)}">${this.noDataRenderer
            ? this.#renderNoDataContent(this.noDataRenderer)
            : this.#translation.noData}</td>
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

    if (this.#keyExpr && !this.#warnedKeys) {
      this.#checkKeys(entries.map(entry => entry.row));
    }

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

  /** Total de linhas desconhecido (rolagem infinita antes do fim): `aria-rowcount="-1"`. */
  get #unknownRowCount(): boolean {
    return this.#lazy && this.#totalCount < 0;
  }

  /** `keyExpr` com chave vazia ou repetida nas linhas renderizadas: erro uma vez por grid. */
  #checkKeys(rows: readonly Row[]): void {
    const seen = new Set<unknown>();

    for (const row of rows) {
      if (!isDataRow(row)) {
        continue;
      }

      const key = this.#keyOf(row.item);

      if (key === undefined || key === null || key === '' || seen.has(key)) {
        this.#warnedKeys = true;
        console.error(`<u-grid>: keyExpr returned an empty or duplicate key (${String(key)}); keys must be unique.`);
        return;
      }

      seen.add(key);
    }
  }

  /** Painel de carregamento (consulta inteira) e barra de erro com "tentar de novo". */
  #renderLoadState() {
    const waiting = this.#waitingForState;

    if (!this.#dataSource && !waiting) {
      return nothing;
    }

    const translation = this.#translation;
    const failure = this.#dataSource ? this.#loader.error : undefined;

    return html`
      ${waiting || this.#isLoading
        ? html`<div class="load-panel" part="load-panel" aria-hidden=${ifDefined(waiting ? undefined : 'true')}>
          <span class="load-spinner" aria-hidden="true"></span><span>${translation.loading}</span>
        </div>`
        : nothing}
      ${failure
        ? html`<div class="error-row" part="error-row" role="alert">
          <span>${translation.loadError}</span>
          <button type="button" part="retry-button" class="retry-button" @click=${this.#retry}>${translation.retry}</button>
        </div>`
        : nothing}
    `;
  }

  readonly #retry = (): void => {
    this.#loader.retry();
    this.requestUpdate();
  };

  /** "Página x de y (n itens)" (ou só "Página x" com total desconhecido). */
  #pageInfoText(page = Math.min(this.#pageIndex, this.#pageCount() - 1), pageCount = this.#pageCount()): string {
    const translation = this.#translation;
    const format = getNumberFormat(this.language, { maximumFractionDigits: 0 });

    return this.#totalCount < 0
      ? formatMessage(translation.pageInfoUnknownCount, { page: format.format(page + 1) })
      : formatMessage(translation.pageInfo, {
        page: format.format(page + 1),
        pageCount: format.format(pageCount),
        count: format.format(this.#totalCount),
      });
  }

  /** Pager: tamanho da página, "Página x de y (n itens)", primeira/anterior/números/próxima/última. */
  #renderPager() {
    const translation = this.#translation;
    const size = this.#effectivePageSize;
    const pageCount = this.#pageCount();
    const page = Math.min(this.#pageIndex, pageCount - 1);
    const format = getNumberFormat(this.language, { maximumFractionDigits: 0 });
    const info = this.#pageInfoText(page, pageCount);
    const options = [...new Set([...this.pageSizeOptions ?? []].filter(option => Number.isInteger(option) && option > 0))];

    if (options.length && !options.includes(size)) {
      options.push(size);
      options.sort((a, b) => a - b);
    }

    // Até 5 números em volta da atual.
    const first = Math.max(0, Math.min(page - 2, pageCount - 5));
    const numbers = Array.from({ length: Math.min(5, pageCount) }, (_, index) => first + index);

    // Depois do clique o foco fica na página atual: o número clicado muda de lugar
    // quando a janela de números anda, e o botão de seta pode ficar desabilitado.
    const go = (target: number) => (event: Event) => {
      const button = event.currentTarget as HTMLButtonElement;
      const next = Math.max(0, Math.min(target, pageCount - 1));

      this.#setPage(next, size, 'user');

      if (button.matches(':focus') || this.shadowRoot?.activeElement === button) {
        void this.updateComplete.then(() => {
          const lastOrFirst = next === 0 || next === pageCount - 1;

          if (button.classList.contains('pager-number') || (lastOrFirst && button.disabled)) {
            this.renderRoot.querySelector<HTMLElement>('.pager-number[aria-current="page"]')?.focus();
          }
        });
      }
    };

    const button = (target: number, label: string, path: string, disabled: boolean, extra = '') => html`<button
      type="button"
      part="pager-button"
      class="pager-button pager-arrow ${extra}"
      aria-label=${label}
      title=${label}
      ?disabled=${disabled}
      @click=${go(target)}><svg viewBox="0 -960 960 960" width="20" height="20" fill="currentColor" aria-hidden="true"><path d=${path}/></svg></button>`;

    return html`
      <nav class="pager" part="pager" aria-label=${translation.paginationLabel} .inert=${this.#waitingForState}>
        ${options.length
          ? html`<label class="page-size">
            <span>${translation.pageSizeLabel}</span>
            <select part="page-size-select" @change=${(event: Event) => this.#setPage(0, Number((event.target as HTMLSelectElement).value), 'user')}>
              ${options.map(option => html`<option value=${option} ?selected=${option === size}>${format.format(option)}</option>`)}
            </select>
          </label>`
          : nothing}
        <span class="page-info" part="page-info">${info}</span>
        <span class="pager-buttons">
          ${button(0, translation.firstPage, FIRST_PAGE_PATH, page === 0)}
          ${button(page - 1, translation.previousPage, PREVIOUS_PAGE_PATH, page === 0)}
          ${numbers.map(index => html`<button
            type="button"
            part="pager-button"
            class="pager-button pager-number"
            aria-label=${formatMessage(translation.pageInfoUnknownCount, { page: format.format(index + 1) })}
            aria-current=${ifDefined(index === page ? 'page' : undefined)}
            @click=${go(index)}>${format.format(index + 1)}</button>`)}
          ${button(page + 1, translation.nextPage, NEXT_PAGE_PATH, page >= pageCount - 1)}
          ${button(pageCount - 1, translation.lastPage, LAST_PAGE_PATH, page >= pageCount - 1)}
        </span>
      </nav>
    `;
  }

  /** Colunas do DOM (com as espaçadoras): `colspan` das linhas de célula única. */
  #totalColumns(layout: ColumnLayout[]): number {
    return this._groupColumns.length + this.#leadingColumns + layout.length
      + layout.reduce((count, cell) => count + (cell.gapBefore ? 1 : 0), 0)
      + (this.#trailingGap ? 1 : 0);
      + (this.#showCommandColumn ? 1 : 0);
  }

  /**
   * Nível no `treegrid` (só agrupado): grupo = nível + 1; rodapé do grupo e
   * linhas de dados ficam um nível abaixo do grupo que as contém (spec 17).
   */
  #ariaLevelOf(row: Row): number | typeof nothing {
    if (!this._groupColumns.length) {
      return nothing;
    }

    if (!row.isGroup && !row.isFooter && !row.isDetail && row.skeleton && row.level !== undefined) {
      // Esqueleto de uma lista de subgrupos remota: no nível dos grupos que ela representa.
      return row.level + 1;
    }

    return row.isGroup ? row.level + 1 : row.isFooter ? row.level + 2 : this._groupColumns.length + 1;
  }

  #renderRow(index: number, row: Row, headerRows: number, layout: ColumnLayout[], pinned: boolean) {
    if (row.isDetail) {
      return this.#renderDetailRow(index, row, headerRows, layout, pinned);
    }

    const parity = row.isGroup || row.isFooter
      ? ''
      : row.index % 2 === 0 ? 'odd' : 'even';
    const selectable = isDataRow(row) && this.#selectionMode !== 'none';
    const selected = selectable && this.#selection.has(this.#keyOf(row.item));
    const expanded = isDataRow(row) && this.#showDetailColumn && this.#isRowExpandedKey(this.#keyOf(row.item));
    const pending = isDataRow(row) ? this.#pendingOf(row) : undefined;
    const editing = isDataRow(row) && !!this.#editor && this.#editor.rowKey === this.#keyOf(row.item);

    const classes: Record<string, boolean> = {
      'group-row': row.isGroup,
      'group-footer-row': !!row.isFooter,
      'summary-row': !!row.isFooter,
      'skeleton-row': isDataRowLike(row) && !!row.skeleton,
      last: index === this.#rows.length - 1,
      selected,
      expanded,
      pinned,
      added: pending?.type === 'add',
      removed: pending?.type === 'remove',
      editing,
    };

    if (parity) {
      classes[parity] = true;
    }

    const parts = ['row', row.isGroup ? 'group-row' : row.isFooter ? 'group-footer-row summary-row' : row.skeleton ? 'skeleton-row' : parity];

    if (selected) {
      parts.push('selected');
    }

    if (expanded) {
      parts.push('expanded');
    }

    if (pending?.type === 'add' || pending?.type === 'remove') {
      parts.push(pending.type === 'add' ? 'added' : 'removed');
    }

    return html`
      <tr
        id=${ifDefined(this.#showDetailColumn && isDataRow(row) ? `row-${index}` : undefined)}
        style="height: ${this.rowHeight}px;"
        data-index=${index}
        role="row"
        aria-rowindex="${index + 1 + headerRows + this.#rows.offset}"
        aria-busy=${ifDefined(isDataRowLike(row) && row.skeleton ? 'true' : undefined)}
        aria-level=${this.#ariaLevelOf(row)}
        aria-expanded=${ifDefined(row.isGroup ? (row.expanded ? 'true' : 'false') : undefined)}
        aria-selected=${ifDefined(selectable ? (selected ? 'true' : 'false') : undefined)}
        class="${classMap(classes)}"
        part=${parts.join(' ')}>
        ${row.isGroup
          ? this.#renderGroupRowCells(row, index, layout)
          : row.isFooter
            ? this.#renderGroupFooterCells(row, index, layout)
            : this.#renderDataRowCells(row, index, layout, selected, expanded)}
      </tr>
    `;
  }

  /**
   * Linha de detalhe: uma célula de largura total com o conteúdo do
   * `detailRenderer`. A altura de 1px é mínima (o conteúdo a aumenta): sem
   * altura declarada a tabela daria a ela a sobra do `<tbody>` (que tem a
   * altura virtual inteira), em vez de à linha final de preenchimento.
   */
  #renderDetailRow(index: number, row: DetailRow, headerRows: number, layout: ColumnLayout[], pinned: boolean) {
    const renderer = this.detailRenderer;
    const grid = this;
    const { item } = row;

    return html`
      <tr
        data-index=${index}
        role="row"
        aria-rowindex="${index + 1 + headerRows + this.#rows.offset}"
        aria-labelledby=${ifDefined(index > 0 ? `row-${index - 1}` : undefined)}
        aria-level=${this.#ariaLevelOf(row)}
        style="height: 1px;"
        class=${classMap({ 'detail-row': true, last: index === this.#rows.length - 1, pinned })}
        part="row detail-row">
        <td
          class="detail-cell"
          part="detail-cell"
          role="gridcell"
          aria-colindex="1"
          data-col="detail"
          colspan=${Math.max(this.#totalColumns(layout), 1)}
          aria-colspan=${Math.max(this.#navColumns.length, 1)}
          tabindex=${this.#isActive(index, -1) ? 0 : -1}><div class="detail-content">${renderer
            ? rendererContent({
              host: this,
              slotName: `u-grid-internal:detail:${row.masterKey}`,
              deps: [item, renderer, this.#renderEpoch()],
              renderer,
              invoke: signal => renderer(item, {
                item,
                rowKey: item,
                grid,
                get signal() {
                  return signal();
                },
              }),
            })
            : nothing}</div></td>
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
    const offset = this.#leadingColumns;
    const totalColumns = this.#totalColumns(layout);
    // Colunas depois do botão: recuos dos níveis internos, caixas e colunas comuns.
    const base = groupColumns - row.level - 1 + offset;
    const specs = this.#groupSpecs;
    const visible = this._visibleColumns;
    // Índices LÓGICOS (todas as visíveis): o texto não muda com a virtualização de colunas.
    let alignedFrom = visible.length;

    const indexOf = (column: GridColumnDef | undefined): number =>
      column ? visible.indexOf(column) : -1;

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
    // Primeira célula renderizada a partir da 1ª alinhada; o rótulo cobre as do DOM antes dela.
    let renderedFrom = layout.findIndex(cell => cell.col - offset >= alignedFrom);
    renderedFrom = renderedFrom < 0 ? layout.length : renderedFrom;
    const labelDomColumns = renderedFrom + layout.slice(0, renderedFrom).reduce((count, cell) => count + (cell.gapBefore ? 1 : 0), 0);
    const aligned = renderedFrom < layout.length
      ? renderSummaryCells(layout, alignedTexts, renderedFrom, this.#listSeparatorText, offset, undefined, this.#trailingGap, this.#cellKey)
      : nothing;
    // A linha de grupo é um ponto só da navegação: os resumos alinhados entram no rótulo dela.
    const alignedLabels = [...alignedTexts.values()].flat().map(text => text.label);
    const valueText = this.#groupValueText(row);
    const labelText = `${groupRowLabel(row, this.#translation.groupLabelSeparator, valueText)}${info ? ` ${info}` : ''}`;
    const custom = !!row.column.groupRenderer;
    // Com `groupRenderer` o nome acessível vem do conteúdo do hospedeiro.
    const ariaLabel = alignedLabels.length && !custom
      ? [labelText, ...alignedLabels].join(this.#listSeparatorText)
      : undefined;
    const inlineSummaries = (): GridSummaryValue[] => specs
      .map((summary, index) => ({ summary, index }))
      .filter(({ summary }) => (summary.item.display ?? 'inline') === 'inline')
      .map(({ summary, index }) => this.#summaryValue(summary, row.summaries[index]));

    return renderGroupRowCells({
      row,
      content: custom ? this.#renderGroupContent(row, valueText, inlineSummaries, labelText) : undefined,
      alignedSummaries: custom && alignedLabels.length
        ? { text: alignedLabels.join(this.#listSeparatorText), id: `group-${rowIndex}` }
        : undefined,
      totalColumns,
      separator: this.#translation.groupLabelSeparator,
      valueText,
      info,
      ariaLabel,
      labelSpan: renderedFrom < layout.length ? base + labelDomColumns : undefined,
      trailing: aligned === nothing
        ? nothing
        : html`${aligned}${this.#showCommandColumn ? html`<td class="command-cell" role="gridcell" aria-colindex=${offset + this._visibleColumns.length + 1}></td>` : nothing}`,
      tabIndex: this.#isActive(rowIndex, -1) ? 0 : -1,
      onToggle: this.#toggleGroup,
    });
  }

  #renderGroupFooterCells(row: GroupFooterRow, rowIndex: number, layout: ColumnLayout[]) {
    const texts = this.#textsByColumn(this.#groupSpecs, row.summaries, ({ item }) => (item as GridGroupSummaryItem).display === 'footer');
    const offset = this.#leadingColumns;

    return html`
      ${renderIndentCells(this._groupColumns.length, GROUP_COLUMN_WIDTH)}
      ${this.#renderEmptyDetailToggleCell(rowIndex)}
      ${this.#renderEmptySelectionCell(rowIndex)}
      ${renderSummaryCells(layout, texts, 0, this.#listSeparatorText, offset, col => this.#isActive(rowIndex, col) ? 0 : -1, this.#trailingGap, this.#cellKey)}
      ${this.#renderEmptyCommandCell(rowIndex, offset + this._visibleColumns.length)}
    `;
  }

  /** Célula da coluna de caixas nas linhas de resumo (vazia, mas navegável). */
  #renderEmptySelectionCell(rowIndex: number) {
    const col = this.#selectionCol;

    return this.#showSelectionColumn
      ? html`<td
        class="selection-cell sticky-cell"
        part="selection-cell"
        role="gridcell"
        aria-colindex=${col + 1}
        data-col=${col}
        tabindex=${this.#isActive(rowIndex, col) ? 0 : -1}
        style="inset-inline-start: ${this.#selectionInset}px"></td>`
      : nothing;
  }

  /** Célula da coluna de expansão nas linhas sem detalhe (resumos; `null` = linha de filtro, fora da navegação). */
  #renderEmptyDetailToggleCell(rowIndex: number | null) {
    return this.#showDetailColumn
      ? html`<td
        class="detail-toggle-cell sticky-cell"
        part="detail-toggle-cell"
        role="gridcell"
        aria-colindex="1"
        data-col=${ifDefined(rowIndex === null ? undefined : 0)}
        tabindex=${ifDefined(rowIndex === null ? undefined : this.#isActive(rowIndex, 0) ? 0 : -1)}
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
      leading: html`${this.#renderEmptyDetailToggleCell(rowIndex)}${this.#renderEmptySelectionCell(rowIndex)}`,
      trailing: this.#renderEmptyCommandCell(rowIndex, this.#leadingColumns + this._visibleColumns.length),
      colOffset: this.#leadingColumns,
      tabIndexOf: col => this.#isActive(rowIndex, col) ? 0 : -1,
      trailingGap: this.#trailingGap,
      keyOf: this.#cellKey,
    });
  }

  #renderDataRowCells(row: DataRow, rowIndex: number, layout: ColumnLayout[], selected: boolean, expanded: boolean) {
    const selectionCol = this.#selectionCol;
    const matcher = this.#highlightMatcher();
    const edit: RowEditState | undefined = this.#editingOn && !row.skeleton
      ? { pending: this.#pendingOf(row), rowKey: this.#keyOf(row.item), readonlyMarks: !!this.allowEditing || this.allowAdding }
      : undefined;

    return html`
      ${map(this._groupColumns, (_, index) => html`
        <td
          role="presentation"
          class="group-column sticky-cell"
          style="inset-inline-start: ${index * GROUP_COLUMN_WIDTH}px"></td>`)}
      ${this.#showDetailColumn && row.skeleton ? this.#renderEmptyDetailToggleCell(rowIndex) : nothing}
      ${this.#showDetailColumn && !row.skeleton
        ? html`
          <td
            class="detail-toggle-cell sticky-cell"
            part="detail-toggle-cell"
            role="gridcell"
            aria-colindex="1"
            data-col="0"
            aria-expanded=${expanded ? 'true' : 'false'}
            tabindex=${this.#isActive(rowIndex, 0) ? 0 : -1}
            style="inset-inline-start: ${this._groupColumns.length * GROUP_COLUMN_WIDTH}px"><button
              class="detail-toggle"
              part="detail-toggle-button"
              type="button"
              tabindex="-1"
              aria-expanded=${expanded ? 'true' : 'false'}
              aria-label=${this.#translation.rowDetails}
              @mousedown=${(event: MouseEvent) => event.preventDefault()}
              @click=${(event: MouseEvent) => {
                // O foco fica na célula (ativa), não no botão: as setas seguem andando.
                (event.currentTarget as HTMLElement).closest('td')?.focus();
                this.#setRowExpanded(this.#keyOf(row.item), !expanded, 'user');
              }}><span class="toggle-icon"><svg
                xmlns="http://www.w3.org/2000/svg"
                height="1em"
                width="1em"
                viewBox="0 -960 960 960"
                fill="currentColor"
                aria-hidden="true"><path d=${CHEVRON_PATH}/></svg></span></button></td>`
        : nothing}
      ${this.#showSelectionColumn
        ? html`
          <td
            class="selection-cell sticky-cell"
            part="selection-cell"
            role="gridcell"
            aria-colindex=${selectionCol + 1}
            data-col=${selectionCol}
            tabindex=${this.#isActive(rowIndex, selectionCol) ? 0 : -1}
            style="inset-inline-start: ${this.#selectionInset}px">${row.skeleton
              ? nothing
              : this.#renderCheckbox(selected ? 'true' : 'false', this.#translation.selectRow)}</td>`
        : nothing}
      ${this.#mapCells(layout, cell => html`${this.#spacerCell(cell.gapBefore)}${row.skeleton
        ? html`
          <td
            part="cell"
            class=${cell.cellClassName}
            style=${cell.style}
            role="gridcell"
            aria-colindex="${cell.col + 1}"
            data-col=${cell.col}
            tabindex=${this.#isActive(rowIndex, cell.col) ? 0 : -1}><span class="skeleton" aria-hidden="true"></span><span class="visually-hidden">${this.#translation.loading}</span></td>`
        : edit
          ? this.#renderEditableCell(row, rowIndex, cell, cell.col, matcher, edit)
          : html`
          <td
            part="cell"
            class=${cell.cellClassName}
            style=${cell.style}
            role="gridcell"
            aria-colindex="${cell.col + 1}"
            data-col=${cell.col}
            tabindex=${this.#isActive(rowIndex, cell.col) ? 0 : -1}>${this.#renderCellContent(row, cell, matcher)}</td>`}`)}
      ${this.#trailingSpacerCell()}
      ${this.#showCommandColumn ? this.#renderCommandCell(row, rowIndex, this.#leadingColumns + this._visibleColumns.length, edit?.pending) : nothing}
    `;
  }

  /** Célula de dados com a edição ligada: editor, valor pendente, marcas e ARIA (frente 09). */
  #renderEditableCell(row: DataRow, rowIndex: number, cell: ColumnLayout, col: number, matcher: RegExp | null, edit: RowEditState) {
    const { column } = cell;
    const { pending, rowKey } = edit;
    const active = this.#isActive(rowIndex, col);
    const editing = this.#isEditingCell(rowKey, column, pending, row);
    const removed = pending?.type === 'remove';
    const added = pending?.type === 'add';
    const modified = !!pending && !added && !removed && pending.modified.has(column);
    const error = removed ? undefined : pending?.errors.get(column);
    const validating = !!pending && !removed && this.#isValidating(pending, column);
    const readonly = edit.readonlyMarks && !this.#cellEditable(row, column, pending);
    const messageId = error || validating ? `edit-message-${rowIndex}-${col}` : undefined;
    const stateId = added ? 'edit-desc-added' : removed ? 'edit-desc-removed' : modified ? 'edit-desc-modified' : undefined;
    // Erro da linha (`setError` sem coluna, colunas ocultas): na 1ª célula, descreve todas.
    const rowError = removed || !pending ? '' : this.#rowErrorText(pending);
    const rowErrorId = rowError ? `edit-row-error-${rowIndex}` : undefined;
    const describedBy = [messageId, rowErrorId, stateId].filter(Boolean).join(' ');
    const showMessage = !!messageId && (editing || active);
    const classes = [cell.cellClassName];
    const parts = ['cell'];

    if (modified) {
      classes.push('modified');
      parts.push('modified');
    }

    if (error) {
      classes.push('invalid');
      parts.push('invalid');
    }

    if (editing) {
      classes.push('editing');
    }

    if (showMessage) {
      classes.push('show-message');
    }

    let content: unknown;

    if (editing) {
      content = this.#renderEditor(row, pending, column, cell, describedBy);
    } else if (pending?.unparsed.has(column)) {
      content = pending.unparsed.get(column)!.text;
    } else if (pending && !added && Object.keys(pending.data).length) {
      content = this.#renderCellContent({ ...row, item: this.#edits.mergedOf(pending) }, cell, matcher);
    } else {
      content = this.#renderCellContent(row, cell, matcher);
    }

    const message = messageId
      ? html`<div
          id=${messageId}
          class="validation-message"
          part="validation-message"
          lang=${ifDefined(error ? undefined : this.#textLanguage)}
          aria-hidden=${ifDefined(editing ? undefined : 'true')}
          ?hidden=${!showMessage}>${error
            ? editing && this.#editMode !== 'batch' ? `${error} ${this.#translation.validationEscapeHint}` : error
            : html`<span class="validating-spinner" aria-hidden="true"></span>${this.#translation.validating}`}</div>`
      : nothing;
    // Visível com a linha ativa; o texto também vai pelo `aria-describedby` de cada célula.
    const firstCell = col === this.#leadingColumns;
    const showRowError = !!rowErrorId && firstCell && rowIndex === this.#activeRowIndex;
    const rowMessage = rowErrorId && firstCell
      ? html`<div
          id=${rowErrorId}
          class="validation-message"
          part="validation-message"
          aria-hidden=${ifDefined(editing ? undefined : 'true')}
          ?hidden=${!showRowError || showMessage}>${rowError}</div>`
      : nothing;

    if (showRowError) {
      classes.push('show-message');
    }

    return html`
      <td
        part=${parts.join(' ')}
        class=${classes.join(' ')}
        style=${cell.style}
        role="gridcell"
        aria-colindex="${col + 1}"
        data-col=${col}
        aria-readonly=${ifDefined(readonly ? 'true' : undefined)}
        aria-invalid=${ifDefined((error || rowError) && !editing ? 'true' : undefined)}
        aria-describedby=${ifDefined(!editing && describedBy ? describedBy : undefined)}
        tabindex=${active ? 0 : -1}>${(showMessage || showRowError) && !editing ? html`<span class="cell-text">${content}</span>` : content}${message}${rowMessage}</td>`;
  }

  /** Erro da linha: o de `setError` sem coluna e os das colunas que não estão à vista ("Coluna: mensagem"). */
  #rowErrorText(pending: PendingRow): string {
    const parts = pending.rowError ? [pending.rowError] : [];

    for (const [column, message] of pending.errors) {
      if (!this._visibleColumns.includes(column)) {
        parts.push(`${column.label ?? ''}: ${message}`);
      }
    }

    return parts.join(' ');
  }

  /** Editor da célula: o `editorRenderer` da coluna ou o embutido pelo tipo. */
  #renderEditor(row: DataRow, pending: PendingRow | undefined, column: GridColumnDef, cell: ColumnLayout, describedBy: string) {
    const editor = this.#editor!;
    const item = pending ? pending.item : row.item;
    const current = editor.drafts.has(column)
      ? editor.drafts.get(column)
      : pending ? this.#pendingValue(pending, column) : getCellValue(row.item, column);
    const label = column.label ?? '';
    const error = pending?.errors.get(column) ?? '';
    const renderer = column.editorRenderer;

    if (renderer) {
      const grid = this;
      const rowKey = editor.rowKey;

      return rendererContent({
        host: this,
        slotName: `u-grid-internal:editor:${row.key}:${cell.id}`,
        deps: [editor.session, column, renderer, this.#renderEpoch(), error],
        renderer,
        invoke: signal => {
          const ctx: GridEditorRenderContext = {
            item,
            get value() {
              return editor.drafts.has(column) ? editor.drafts.get(column) : current;
            },
            get data() {
              return (pending?.data ?? {}) as Partial<unknown>;
            },
            column,
            rowKey,
            label,
            invalid: !!error,
            errorMessage: error,
            describedBy,
            setValue: (value: unknown) => {
              if (grid.#editor === editor) {
                grid.#editorChanged(editor, column);
                editor.drafts.set(column, value);
              }
            },
            commit: () => {
              if (grid.#editor === editor) {
                grid.#commitAndThen('user', () => undefined, { keepOpen: true });
              }
            },
            cancel: () => {
              if (grid.#editor === editor) {
                grid.#cancelEditor('user');
              }
            },
            grid,
            get signal() {
              return signal();
            },
          };

          return renderer.call(column, item, ctx);
        },
      });
    }

    const kind = editorKindOf(this.#dataTypeOf(column));
    const language = this.language || undefined;
    const original = getCellValue(item, column);
    const text = editor.texts.get(column) ?? (
      current instanceof UnparsedValue
        ? current.text
        : kind === 'number'
          ? formatEditorNumber(current, language)
          : kind === 'date' || kind === 'datetime'
            ? formatEditorDate(current, kind === 'datetime')
            : current === null || current === undefined ? '' : String(current));

    const headerIndex = this.#currentNavColumns().indexOf(column) + 1;

    return renderBuiltInEditor({
      kind,
      text,
      checked: current === null || current === undefined ? null : !!current,
      label,
      labelledBy: this.showColumnHeaders && headerIndex > 0 ? `header-text-${headerIndex}` : undefined,
      invalid: !!error,
      describedBy,
      onInput: (event: Event) => {
        if (this.#editor !== editor) {
          return;
        }

        const value = (event.target as HTMLInputElement).value;
        this.#editorChanged(editor, column);
        editor.texts.set(column, value);
        editor.drafts.set(column, kind === 'number'
          ? parseEditorNumber(value, language)
          : kind === 'date' || kind === 'datetime'
            ? parseEditorDate(value, original, kind === 'datetime')
            : value);
        this.#revealEditingRow(event);
      },
      onChange: (event: Event) => {
        if (this.#editor !== editor || kind !== 'boolean') {
          return;
        }

        editor.drafts.set(column, (event.target as HTMLInputElement).checked);

        // Clique na caixa: alterna e confirma num passo (Espaço só alterna).
        if (this.#checkboxPointer && !editor.wholeRow) {
          this.#checkboxPointer = false;
          this.#commitAndThen('user', () => {
            this.#focusPending = true;
            this.requestUpdate();
          });
        }
      },
    });
  }

  /** Valor do editor mudou: aborta a validação em curso da célula (a resposta velha não vale). */
  #editorChanged(editor: OpenEditor, column: GridColumnDef): void {
    editor.seq++;
    const pending = this.#edits.get(editor.rowKey);
    const controller = pending && this.#validations.get(pending)?.get(column);

    if (controller) {
      controller.abort();
      this.#validations.get(pending)!.delete(column);
      this.#edits.touch();
      this.requestUpdate();
    }
  }

  /** Editor numa linha fora da janela (presa, invisível): rola até ela antes de agir. */
  #revealEditingRow(event: Event): void {
    const tr = event.composedPath().find((node): node is HTMLTableRowElement => node instanceof HTMLTableRowElement);

    if (tr?.classList.contains('pinned')) {
      this.#revealPending = true;
      this.#revealAttempts = 0;
      this.requestUpdate();
    }
  }

  /** Botões da linha: Editar/Excluir; Salvar/Cancelar (linha em edição); Restaurar (lote). */
  #renderCommandCell(row: DataRow, rowIndex: number, col: number, pending: PendingRow | undefined) {
    const translation = this.#translation;
    let buttons: unknown = nothing;

    if (!row.skeleton) {
      const rowKey = this.#keyOf(row.item);
      const removed = pending?.type === 'remove';
      const canRemove = pending?.type === 'add' ? true : this.#canRemoveItem(row.item);
      const button = (text: string, onClick: (event: MouseEvent) => void, name: string) => html`<button
        class="command-button ${name}"
        part="command-button"
        type="button"
        tabindex="-1"
        @click=${onClick}>${text}</button>`;

      if (this.#editMode === 'row') {
        const editing = this.#editor?.rowKey === rowKey;

        buttons = editing
          ? html`${button(translation.saveRow, () => void this.#save('user'), 'save')}${button(translation.cancel, () => this.#cancelEditor('user'), 'cancel')}`
          : html`${this.#rowEditable(row, pending)
            ? button(translation.editRow, () => this.#startEdit(this.#rowIndexOfKey(rowKey), null, 'user'), 'edit')
            : nothing}${canRemove && this.allowRemoving
            ? button(translation.removeRow, event => void this.#requestRemove(rowKey, event.currentTarget as HTMLElement), 'remove')
            : nothing}`;
      } else if (this.allowRemoving && (canRemove || removed)) {
        // O MESMO botão vira Restaurar (lote): o foco fica nele.
        buttons = button(
          removed ? translation.restoreRow : translation.removeRow,
          event => removed ? this.#restoreRow(rowKey, 'user') : void this.#requestRemove(rowKey, event.currentTarget as HTMLElement),
          'remove',
        );
      }
    }

    return html`<td
      class="command-cell"
      part="command-cell"
      role="gridcell"
      aria-colindex=${col + 1}
      data-col=${col}
      tabindex=${this.#isActive(rowIndex, col) ? 0 : -1}>${buttons}</td>`;
  }

  /** Célula vazia da coluna de botões (resumos; `null` = linha de filtro, fora da navegação). */
  #renderEmptyCommandCell(rowIndex: number | null, col: number) {
    return this.#showCommandColumn
      ? html`<td
        class="command-cell"
        part="command-cell"
        role="gridcell"
        aria-colindex=${col + 1}
        data-col=${ifDefined(rowIndex === null ? undefined : col)}
        tabindex=${ifDefined(rowIndex === null ? undefined : this.#isActive(rowIndex, col) ? 0 : -1)}></td>`
      : nothing;
  }

  /** Rótulo do cabeçalho pelo `headerRenderer` da coluna. */
  #renderHeaderContent(column: GridColumnDef, columnId: number) {
    const renderer = column.headerRenderer!;
    const grid = this;

    return rendererContent({
      host: this,
      slotName: `u-grid-internal:header:${columnId}`,
      deps: [column, renderer, this.#renderEpoch()],
      renderer,
      invoke: signal => renderer.call(column, {
        column,
        grid,
        get signal() {
          return signal();
        },
      }),
    });
  }

  /** Rótulo da linha de grupo pelo `groupRenderer` da coluna agrupada. */
  #renderGroupContent(row: GroupRow, text: string, summaries: () => readonly GridSummaryValue[], defaultText: string) {
    const { column } = row;
    const renderer = column.groupRenderer!;
    const grid = this;

    return rendererContent({
      host: this,
      slotName: `u-grid-internal:group:${row.key}`,
      deps: [row.groupKey, column, renderer, this.#renderEpoch(), row.value, row.expanded, row.itemCount, row.summaries, defaultText],
      renderer,
      invoke: signal => renderer.call(column, {
        column,
        value: row.value,
        text,
        groupPath: row.path,
        groupIndex: row.level,
        itemCount: row.itemCount,
        expanded: row.expanded,
        get summaries() {
          return summaries();
        },
        defaultText,
        grid,
        get signal() {
          return signal();
        },
      }),
    });
  }

  /** Estado vazio pelo `noDataRenderer`. */
  #renderNoDataContent(renderer: GridNoDataRenderer) {
    const filtered = this.#items.length > 0;
    const grid = this;

    return rendererContent({
      host: this,
      slotName: 'u-grid-internal:no-data',
      deps: [renderer, filtered, this.#renderEpoch()],
      renderer,
      // A linha vazia não está na navegação: o Tab chega ao conteúdo.
      demote: false,
      invoke: signal => renderer({
        filtered,
        grid,
        get signal() {
          return signal();
        },
      }),
    });
  }

  #epoch: { language: string | undefined; translation: GridI18n } | undefined;

  /**
   * Identidade do idioma e da tradução atuais: entra nas dependências dos
   * renderers do hospedeiro (trocar o idioma os roda de novo).
   */
  #renderEpoch(): object {
    const language = this.#effectiveLanguage;
    const translation = this.#translation;

    let epoch = this.#epoch;

    if (!epoch || epoch.language !== language || epoch.translation !== translation) {
      epoch = this.#epoch = { language, translation };
    }

    return epoch;
  }

  /** Conteúdo da célula, com os trechos da busca destacados (só texto nativo). */
  #renderCellContent(row: DataRow, cell: ColumnLayout, matcher: RegExp | null) {
    const content = renderDataCell(this, row, cell.column, cell.id, cell.format, this.#renderEpoch());

    return matcher && typeof content === 'string' && isColumnFilterable(cell.column)
      ? renderHighlighted(content, matcher)
      : content;
  }

  /** Barra acima da tabela: painel de grupos, busca e/ou botão do seletor de colunas. */
  #renderToolbar() {
    const editBar = this.#showEditBar;

    if (!this.showGroupPanel && !this.columnChooser && !this.showSearchPanel && !editBar) {
      return nothing;
    }

    const translation = this.#translation;

    return html`
      <div class="header" ${ref(this.#toolbarRef)}>
        ${this.showGroupPanel ? this.#renderGroupPanel() : html`<div class="toolbar-spacer"></div>`}
        ${editBar ? this.#inTextLanguage(this.#renderEditBar()) : nothing}
        ${this.#inTextLanguage(this.showSearchPanel ? renderSearchPanel(this.#search, translation) : nothing)}
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

  /** Barra da edição: "Adicionar linha", "Salvar"/"Descartar" (lote) e a mensagem persistente. */
  get #showEditBar(): boolean {
    return (this.#editingOn && (this.allowAdding || this.#editMode === 'batch')) || !!this.#editStatus || this.#savingSlow;
  }

  #renderEditBar() {
    const translation = this.#translation;
    const status = this.#savingSlow ? translation.saving : this.#editStatus;
    const batch = this.#editingOn && this.#editMode === 'batch';
    const empty = !this.hasChanges();
    const saving = !!this.#saving;

    return html`
      <div class="edit-bar">
        ${this.#editingOn && this.allowAdding
          ? html`<button
            class="edit-bar-button add-row-button"
            part="add-row-button"
            type="button"
            aria-disabled=${saving ? 'true' : 'false'}
            @click=${(event: MouseEvent) => {
              if (!this.#saving) {
                this.#addRow({}, 'user', event.currentTarget as HTMLElement);
              }
            }}><svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 -960 960 960"
              width="18"
              height="18"
              fill="currentColor"
              aria-hidden="true"><path d=${ADD_PATH}/></svg>${translation.addRow}</button>`
          : nothing}
        ${batch
          ? html`<button
              class="edit-bar-button save-button"
              part="save-button"
              type="button"
              aria-disabled=${empty || saving ? 'true' : 'false'}
              aria-busy=${saving ? 'true' : 'false'}
              @click=${() => {
                if (this.hasChanges() && !this.#saving) {
                  void this.#save('user');
                }
              }}>${translation.saveChanges}</button><button
              class="edit-bar-button discard-button"
              part="discard-button"
              type="button"
              aria-disabled=${empty || saving ? 'true' : 'false'}
              @click=${() => {
                if (this.hasChanges() && !this.#saving) {
                  this.#discard('user');
                }
              }}>${translation.discardChanges}</button>`
          : nothing}
        ${status ? html`<span class="edit-status">${status}</span>` : nothing}
      </div>
    `;
  }

  /** Confirmação de exclusão (`alertdialog` modal; foco inicial em Cancelar). */
  #renderRemoveDialog() {
    if (!this.#removeDialog) {
      return nothing;
    }

    const translation = this.#translation;

    return html`
      <dialog
        class="remove-dialog"
        part="remove-dialog"
        role="alertdialog"
        aria-labelledby="remove-dialog-title"
        aria-describedby="remove-dialog-message"
        lang=${this.#textLanguage}
        ${ref(this.#removeDialogRef)}
        @cancel=${(event: Event) => {
          event.preventDefault();
          this.#closeRemoveDialog(false);
        }}
        @close=${() => this.#closeRemoveDialog(false)}>
        <h2 id="remove-dialog-title" class="remove-dialog-title">${translation.confirmRemoveTitle}</h2>
        <p id="remove-dialog-message" class="remove-dialog-message">${translation.confirmRemoveMessage}</p>
        <div class="remove-dialog-actions">
          <button class="dialog-button" type="button" autofocus @click=${() => this.#closeRemoveDialog(false)}>${translation.cancel}</button>
          <button class="dialog-button danger" type="button" @click=${() => this.#closeRemoveDialog(true)}>${translation.removeRow}</button>
        </div>
      </dialog>`;
  }

  #closeRemoveDialog(confirmed: boolean): void {
    const pending = this.#removeDialog;

    if (!pending) {
      return;
    }

    this.#removeDialog = null;
    this.#removeDialogRef.value?.close();
    this.requestUpdate();

    if (confirmed) {
      void this.#removeRowNow(pending.rowKey, 'user', true).then(removed => {
        if (!removed && pending.returnFocus?.isConnected) {
          pending.returnFocus.focus();
        }
      });
      // Enquanto salva, o foco fica no botão Excluir (não cai no body).
      pending.returnFocus?.focus();
      return;
    }

    if (pending.returnFocus?.isConnected) {
      pending.returnFocus.focus();
    } else {
      this.#focusPending = true;
    }
  }

  #renderGroupPanel() {
    return html`
      <div
        class="group-container"
        role="toolbar"
        aria-label=${this.#translation.groupPanelLabel}
        ${ref(this._groupContainerRef)}
        @contextmenu=${this.#onGroupPanelContextMenu}>
        ${this._groupColumns.length
          ? html`
            ${map(this._groupColumns, (column, index) => this.#renderGroupChip(column, index))}
            <div class="group-end-dropzone"></div>`
          : html`<div class="drag-here" lang=${this.#textLanguage}>${this.#translation.dragToGroup}</div>`}
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
        aria-keyshortcuts=${`${menu && sortable ? 'Shift+F10 ' : ''}Alt+Shift+ArrowLeft Alt+Shift+ArrowRight Delete Control+G Meta+G`}
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
    // O hospedeiro pode cancelar na captura e tratar o próprio menu (como no cabeçalho).
    if (event.defaultPrevented || !this.groupPanelMenu || !this._groupColumns.length) {
      return;
    }

    event.preventDefault();

    const chip = event.composedPath().find(target => target instanceof HTMLElement && target.classList.contains('group')) as HTMLElement | undefined;
    const column = chip ? this._nativeColumnMap.get(chip) ?? null : null;

    // Na área vazia o foco volta ao chip ativo da barra (não ao `<body>`; spec 17).
    const returnFocus = chip ?? this.renderRoot.querySelector<HTMLElement>('.group[tabindex="0"]');
    this.#groupMenu.show({ column, returnFocus, x: event.clientX, y: event.clientY });
  };

  /**
   * Itens do menu do cabeçalho que valem para a coluna (spec 17, A1). "Mover"
   * fica visível e \`aria-disabled\` no limite do bloco; o resto some quando
   * não se aplica. Lados físicos: em RTL "esquerda" vai para o fim.
   */
  #columnMenuItems(column: GridColumnDef): MenuItem<ColumnHeaderMenuAction>[] {
    const translation = this.#translation;
    const items: MenuItem<ColumnHeaderMenuAction>[] = [];

    const band = this._isBand(column);

    if (!band && !this._groupColumns.includes(column) && isColumnGroupable(column)) {
      items.push({ action: 'groupColumn', label: translation.groupColumn });
    }

    // Irmãs visíveis do mesmo bloco (coluna de banda só se move dentro dela).
    const movable = this.#movableSiblingsOf(column);
    const index = movable.indexOf(column);

    const canMove = (direction: 1 | -1) => !!movable[index + direction];

    const rtl = this._isRtl() ? -1 : 1;

    if (index >= 0 && (canMove(1) || canMove(-1))) {
      items.push(
        { action: 'moveLeft', label: translation.moveLeft, disabled: !canMove(-rtl as 1 | -1) },
        { action: 'moveRight', label: translation.moveRight, disabled: !canMove(rtl) },
      );
    }

    if (!band && this.#isResizable(column) && (this.resizeMode !== 'next-column' || !!this._resizeNeighbor(column))) {
      items.push(
        { action: 'autoSizeColumn', label: translation.autoSizeColumn },
        { action: 'increaseColumnWidth', label: translation.increaseColumnWidth },
        { action: 'decreaseColumnWidth', label: translation.decreaseColumnWidth },
      );
    }

    return items;
  }

  /** Há o que pôr no menu (sem medir a direção: roda no render, inclusive no SSR). */
  #hasColumnMenu(column: GridColumnDef): boolean {
    if (!this.columnHeaderMenu) {
      return false;
    }

    const band = this._isBand(column);

    return (!band && !this._groupColumns.includes(column) && isColumnGroupable(column))
      || this.#hasMovableNeighbor(column)
      || (!band && this.#isResizable(column) && (this.resizeMode !== 'next-column' || !!this._resizeNeighbor(column)));
  }

  /** Clique direito no cabeçalho: abre o menu se houver o que fazer (senão fica o do navegador). */
  #onHeaderContextMenu(event: MouseEvent, column: GridColumnDef): void {
    // O hospedeiro pode cancelar na captura e tratar o próprio menu.
    if (event.defaultPrevented || !this.#columnMenuItems(column).length) {
      return;
    }

    event.preventDefault();
    const cell = event.currentTarget as HTMLElement;
    const position = this.#positionOf(cell);

    // O cabeçalho vira a célula ativa: Esc devolve o foco a ele (roving).
    if (position) {
      this.#setActive(position, 'user');
    }

    this.#columnMenu.show({ column, returnFocus: cell, x: event.clientX, y: event.clientY });
  }

  /**
   * Botão "⋮": abre o menu no toque (iOS não tem menu de contexto) e mostra
   * que ele existe. O ícone é máscara CSS (um nó por cabeçalho; spec 16).
   */
  #renderColumnMenuButton(column: GridColumnDef) {
    if (!this.#hasColumnMenu(column)) {
      return nothing;
    }

    const label = formatMessage(this.#translation.columnHeaderMenuLabel, { column: column.label ?? '' });
    const open = this.#columnMenu.open && this.#columnMenu.column === column;

    return html`<button
      class="column-header-menu-button"
      part="column-header-menu-button"
      type="button"
      tabindex="-1"
      aria-haspopup="menu"
      aria-expanded=${open ? 'true' : 'false'}
      aria-label=${label}
      title=${label}
      @click=${(event: MouseEvent) => {
        event.stopPropagation();

        // O botão também é alça do arrasto do cabeçalho: o clique que termina um arrasto não abre.
        if (this.#consumeDrag(event)) {
          return;
        }

        if (open) {
          this.#columnMenu.hide(true);
          return;
        }

        const button = event.currentTarget as HTMLElement;
        const position = this.#positionOf(button.closest('th')!);

        if (position) {
          this.#setActive(position, 'user');
        }

        this.#columnMenu.show({ column, returnFocus: button });
      }}
      @keydown=${(event: KeyboardEvent) => {
        // Enter/Espaço no botão não podem ordenar a coluna.
        if (event.key === 'Enter' || event.key === ' ') {
          event.stopPropagation();
        }
      }}></button>`;
  }

  #renderColumnHeaderMenu() {
    const column = this.#columnMenu.column!;

    return html`
      <div
        class="column-header-menu"
        part="column-header-menu"
        .popover=${'manual'}
        role="menu"
        aria-label=${formatMessage(this.#translation.columnHeaderMenuLabel, { column: column.label ?? '' })}
        @contextmenu=${(event: Event) => event.preventDefault()}
        @keydown=${this.#columnMenu.onKeyDown}>
        ${renderMenuItems('group-panel-menu-item', this.#columnMenuItems(column), this.#onColumnMenuAction)}
      </div>`;
  }

  readonly #onColumnMenuAction = (action: ColumnHeaderMenuAction): void => {
    const column = this.#columnMenu.column;

    if (!column) {
      return;
    }

    if (action === 'moveLeft' || action === 'moveRight') {
      // Como Alt+Shift+←/→: o foco segue a coluna.
      this.#columnMenu.hide();
      const physical = action === 'moveRight' ? 1 : -1;
      this.#keyboardMoveColumn(column, (physical * (this._isRtl() ? -1 : 1)) as 1 | -1);
      return;
    }

    switch (action) {
      case 'groupColumn':
        // O cabeçalho sai do DOM: a guarda de foco leva o foco à célula ativa.
        this.#columnMenu.hide();
        this._userGroupColumn(column, this._groupColumns.length);

        if (this._groupColumns.includes(column)) {
          this.#announce(formatMessage(this.#translation.groupedAnnouncement, { column: column.label ?? '' }));
        }

        this.#focusPending = true;
        break;

      case 'autoSizeColumn':
        this.#columnMenu.hide(true);
        this.#userAutoSize(column);
        void this.updateComplete.then(() => this.#announceWidth(column, 0));
        break;
      case 'increaseColumnWidth':
      case 'decreaseColumnWidth':
        // O menu fica aberto para repetir o passo.
        this.#resize.step(column, action === 'increaseColumnWidth' ? 1 : -1);
        void this.updateComplete.then(() => this.#announceWidth(column, 0));
        break;
    }
  };

  #renderGroupPanelMenu() {
    const column = this.#groupMenu.column;
    const index = column ? this._groupColumns.indexOf(column) : -1;
    const count = this._groupColumns.length;
    // Lados físicos: em RTL a esquerda é o fim da barra.
    const towardLeft = this._isRtl() ? index + 1 < count : index > 0;
    const towardRight = this._isRtl() ? index > 0 : index + 1 < count;

    return renderGroupPanelMenu({
      translation: this.#translation,
      column,
      canMoveLeft: index >= 0 && towardLeft,
      canMoveRight: index >= 0 && towardRight,
      onAction: this.#onGroupMenuAction,
      onKeyDown: this.#groupMenu.onKeyDown,
    });
  }

  readonly #onGroupMenuAction = (action: GroupPanelMenuAction): void => {
    const column = this.#groupMenu.column;
    const ungroups = action === 'ungroupColumn' || action === 'ungroupAll';
    const chipIndex = column ? this._groupColumns.indexOf(column) : 0;

    if ((action === 'moveLeft' || action === 'moveRight') && column) {
      // Muda o nível do chip (como Alt+Shift+←/→): o foco segue o chip.
      const forward = (action === 'moveRight') !== this._isRtl();
      const target = chipIndex + (forward ? 1 : -1);
      this.#groupMenu.hide();

      if (target >= 0 && target < this._groupColumns.length) {
        this._userGroupColumn(column, forward ? target + 1 : target);
        this.#announceGroupLevel(column);
        this.#focusChip(target);
      }

      return;
    }

    // Desagrupar tira o chip que tinha o foco: o foco vai ao chip vizinho (ou ao 1º cabeçalho).
    this.#groupMenu.hide(!ungroups);

    if (ungroups) {
      void this.updateComplete.then(() => this.#focusAfterUngroup(chipIndex));
    }

    switch (action) {
      case 'ungroupColumn':
        if (column && this._groupColumns.includes(column)) {
          this.#moveColumnTo(false, column, this._regularColumns.length, 'user');
          this.#announce(formatMessage(this.#translation.ungroupedAnnouncement, { column: column.label ?? '' }));
        }

        break;
      case 'ungroupAll':
        this.#ungroupAll('user');
        this.#announce(this.#translation.groupingClearedAnnouncement);
        break;
      case 'expandAllGroups':
        this.#setAllExpanded(true, undefined, 'user');
        this.#announce(this.#translation.groupsExpandedAnnouncement);
        break;
      case 'collapseAllGroups':
        this.#setAllExpanded(false, undefined, 'user');
        this.#announce(this.#translation.groupsCollapsedAnnouncement);
        break;
    }
  };

  #renderColumnChooser() {
    const visibleCount = this._visibleColumns.length;
    const tree = this.#columnTree;

    // Árvore na ordem atual (frente 13); banda com `showInChooser: false` sai com as colunas.
    const itemsOf = (parent: GridColumnDef | null): ColumnChooserItem[] => orderedSiblings(this._regularColumns, tree, parent)
      .filter(column => column.showInChooser !== false)
      .map(column => {
        const visible = this._isColumnVisible(column);
        const fixed = parent ? undefined : this._fixedOf(column);

        if (!tree.childrenOf.has(column)) {
          return { column, id: columnIdOf(column), visible, canToggle: !visible || visibleCount > 1, fixed };
        }

        const leaves = this._regularColumns.filter(leaf => ancestorsOf(tree, leaf).includes(column));
        const shown = leaves.filter(leaf => this._isColumnVisible(leaf)).length;

        return {
          column,
          id: columnIdOf(column),
          visible: visible && shown === leaves.length,
          indeterminate: visible && shown > 0 && shown < leaves.length,
          // Ocultar a banda não pode esconder a última coluna visível.
          canToggle: !visible || visibleCount > shown,
          fixed,
          children: itemsOf(column),
        };
      });

    const items = itemsOf(null);

    return renderColumnChooser({
      items,
      translation: this.#translation,
      onVisibleChange: (column, visible) => this._userSetVisible(column, visible),
      onFixedChange: (column, fixed) => this._userSetFixed(column, fixed),
      onKeyDown: this.#chooser.onKeyDown,
      onFocusOut: this.#chooser.onFocusOut,
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

    // Folhas e bandas pela identidade (`data-column-id`): com bandas e virtualização o índice não serve.
    const byId = new Map<string, GridColumnDef>();
    this.#columnTree.parentOf.forEach((_, column) => byId.set(String(columnIdOf(column)), column));

    root.querySelectorAll<HTMLElement>('th.header-column, th.band-header').forEach(th => {
      const column = byId.get(th.getAttribute('data-column-id') ?? '');

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
    'u-grid-state-change': CustomEvent<GridStateChangeEventDetail>;
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
    'u-grid-copying': CustomEvent<GridCopyEventDetail>;
    'u-grid-loading': CustomEvent<GridLoadingEventDetail>;
    'u-grid-load': CustomEvent<GridLoadEventDetail>;
    'u-grid-load-error': CustomEvent<GridLoadErrorEventDetail>;
    'u-grid-page-change': CustomEvent<GridPageChangeEventDetail>;
    'u-grid-row-expansion-change': CustomEvent<GridRowExpansionChangeEventDetail>;
    'u-grid-edit-starting': CustomEvent<GridEditStartingEventDetail>;
    'u-grid-row-adding': CustomEvent<GridRowAddingEventDetail>;
    'u-grid-row-removing': CustomEvent<GridRowRemovingEventDetail>;
    'u-grid-row-validating': CustomEvent<GridRowValidatingEventDetail>;
    'u-grid-saving': CustomEvent<GridSavingEventDetail>;
    'u-grid-save': CustomEvent<GridSaveEventDetail>;
    'u-grid-save-error': CustomEvent<GridSaveErrorEventDetail>;
    'u-grid-edit-cancel': CustomEvent<GridEditCancelEventDetail>;
  }
}
