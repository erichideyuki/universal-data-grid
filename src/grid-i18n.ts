import { type Context, type ContextCallback, ContextEvent, ContextProvider, createContext } from '@lit/context';

/**
 * Set of user facing strings rendered by the grid. Column labels are provided
 * by the consumer and are therefore not part of this contract.
 */
export interface GridI18n {
  /** Empty-state message. */
  noData: string;
  /** Hint in the group panel while nothing is grouped (mentions the Ctrl+G keyboard alternative). */
  dragToGroup: string;
  /** Between the column label and the value in group rows (`": "`). */
  groupLabelSeparator: string;
  /** Ascending direction, used in `sortedAnnouncement` and in the group chip label. */
  sortAscending: string;
  /** Descending direction, used in `sortedAnnouncement` and in the group chip label. */
  sortDescending: string;
  /** Screen reader announcement after removing a column from the sorting. `{column}` = column label. */
  sortClearedAnnouncement: string;
  /** Screen reader announcement after sorting. `{column}` = column label, `{order}` = direction. */
  sortedAnnouncement: string;
  /** Text of `true` in `boolean` columns (cells and group rows). */
  trueText: string;
  /** Text of `false` in `boolean` columns (cells and group rows). */
  falseText: string;
  /** Column chooser button label and popover title. */
  columnChooser: string;
  /** Tooltip of a checked column in the chooser (and of the chooser drop target). */
  hideColumn: string;
  /** Tooltip of an unchecked column in the chooser. */
  showColumn: string;
  /** Tooltip of the chooser button that fixes a column at the start (its name is `fixStartLabel`). */
  fixStart: string;
  /** Tooltip of the chooser button that fixes a column at the end (its name is `fixEndLabel`). */
  fixEnd: string;
  /** Tooltip of a pressed fix button (removes the fixing). */
  unfix: string;
  /** Tooltip of the column resize handle: double-click or Enter auto-sizes. */
  autoSize: string;
  /** Name of the `sum` summary. */
  summarySum: string;
  /** Name of the `min` summary. */
  summaryMin: string;
  /** Name of the `max` summary. */
  summaryMax: string;
  /** Name of the `avg` summary. */
  summaryAvg: string;
  /** Name of the `count` summary. */
  summaryCount: string;
  /** Summary text in a cell. `{type}` = summary name (or `label`), `{value}` = formatted value. */
  summaryText: string;
  /** Summary text with its column (group row text and accessible label of every summary). `{type}`, `{column}`, `{value}`. */
  summaryColumnText: string;
  /** Count and inline summaries after the group value. `{info}` = the items joined as a list of the language. */
  groupInfoText: string;
  /** Group panel menu: removes the column from the grouping. */
  ungroupColumn: string;
  /** Group panel menu: removes every column from the grouping. */
  ungroupAll: string;
  /** Group panel menu: expands every group. */
  expandAllGroups: string;
  /** Group panel menu: collapses every group. */
  collapseAllGroups: string;
  /** Accessible name of the group panel menu. */
  groupPanelMenu: string;
  /** Filter operation `=` (operation menu). */
  filterEquals: string;
  /** Filter operation `<>`. */
  filterNotEquals: string;
  /** Filter operation `<`. */
  filterLessThan: string;
  /** Filter operation `<=`. */
  filterLessThanOrEqual: string;
  /** Filter operation `>`. */
  filterGreaterThan: string;
  /** Filter operation `>=`. */
  filterGreaterThanOrEqual: string;
  /** Filter operation `contains`. */
  filterContains: string;
  /** Filter operation `notcontains`. */
  filterNotContains: string;
  /** Filter operation `startswith`. */
  filterStartsWith: string;
  /** Filter operation `endswith`. */
  filterEndsWith: string;
  /** Filter operation `between`. */
  filterBetween: string;
  /** Filter operation `anyof`. */
  filterAnyOf: string;
  /** Filter operation `noneof`. */
  filterNoneOf: string;
  /** Filter operation `isblank`. */
  filterIsBlank: string;
  /** Filter operation `isnotblank`. */
  filterIsNotBlank: string;
  /** Last item of the operation menu: removes the condition and restores the default operation. */
  filterReset: string;
  /** Accessible name of the filter row editors. `{column}` = column label. */
  filterEditorLabel: string;
  /** Name of the filter row operation menu (the button uses `filterOperationButtonLabel`). */
  filterOperationLabel: string;
  /** Header filter button and popover name. `{column}` = column label. */
  headerFilterLabel: string;
  /** Accessible name suffix of the first `between` editor. */
  filterBetweenStart: string;
  /** Accessible name suffix of the second `between` editor. */
  filterBetweenEnd: string;
  /** Boolean filter row option without condition. */
  filterAll: string;
  /** Header filter entry of the empty values. */
  filterBlanks: string;
  /** Header filter button that removes every condition of the column. */
  filterClear: string;
  /** Placeholder of the search panel and of the header filter search (their names are `searchPanelLabel` and `headerFilterSearchLabel`). */
  searchPlaceholder: string;
  /** Header filter "select all" checkbox. */
  selectAll: string;
  /** Confirm button (header filter). */
  ok: string;
  /** Cancel button (header filter). */
  cancel: string;
  /** Screen reader announcement after the user filters. `{count}` = rows that pass (no plural forms: keep it a label). */
  filteredAnnouncement: string;
  /** Label of the row selection checkbox. */
  selectRow: string;
  /** Label of the "select all" checkbox in the header of the selection column. */
  selectAllRows: string;
  /** Screen reader announcement after a bulk selection change. `{count}` = number of selected rows. */
  rowsSelectedAnnouncement: string;
  /** Screen reader announcement after Ctrl+C copied rows. `{count}` = copied rows (no plural forms: keep it a label). */
  rowsCopiedAnnouncement: string;
  /** Screen reader announcement after Ctrl+C copied the focused cell. */
  cellCopiedAnnouncement: string;
  /** Screen reader announcement after moving a column (keyboard or column header menu). `{column}`, `{position}`, `{count}`. */
  columnMovedAnnouncement: string;
  /** Screen reader announcement after grouping by a new column (keyboard or column header menu). `{column}`. */
  groupedAnnouncement: string;
  /** Screen reader announcement after ungrouping a column (keyboard or group panel menu). `{column}`. */
  ungroupedAnnouncement: string;
  /** Name of the column header menu and of its button. `{column}` = column label. */
  columnHeaderMenuLabel: string;
  /** Column header menu item that groups by the column. */
  groupColumn: string;
  /** Menu item (column header and group chip) that moves the column one position to the left (physical side, also in RTL). */
  moveLeft: string;
  /** Menu item (column header and group chip) that moves the column one position to the right (physical side, also in RTL). */
  moveRight: string;
  /** Column header menu item that fits the column width to its content. */
  autoSizeColumn: string;
  /** Column header menu item that widens the column by one keyboard step (keeps the menu open). */
  increaseColumnWidth: string;
  /** Column header menu item that narrows the column by one keyboard step (keeps the menu open). */
  decreaseColumnWidth: string;
  /** Description of a filtered column header and of its header filter button. */
  columnFiltered: string;
  /** Description of a column header pinned to the start. */
  columnFixedStart: string;
  /** Description of a column header pinned to the end. */
  columnFixedEnd: string;
  /** Description of a column header sorted after the first one. `{order}` = direction, `{priority}` = position in the sorting. */
  columnSortPriority: string;
  /** Screen reader announcement after sorting when more than one column is sorted. `{column}`, `{order}`, `{priority}`. */
  sortedWithPriorityAnnouncement: string;
  /** Screen reader announcement after moving a grouped column to another level. `{column}`, `{level}`, `{count}`. */
  groupLevelChangedAnnouncement: string;
  /** Screen reader announcement after ungrouping every column. */
  groupingClearedAnnouncement: string;
  /** Screen reader announcement after expanding all groups. */
  groupsExpandedAnnouncement: string;
  /** Screen reader announcement after collapsing all groups. */
  groupsCollapsedAnnouncement: string;
  /** Screen reader announcement after resizing a column from the header (keyboard or menu). `{column}`, `{width}` = pixels. */
  columnResizedAnnouncement: string;
  /** Name of the column resize handle. `{column}` = column label. */
  resizeHandleLabel: string;
  /** Name of the group panel (toolbar of group chips). */
  groupPanelLabel: string;
  /** Name of the filter row operation button. `{column}` = column label, `{operation}` = current operation. */
  filterOperationButtonLabel: string;
  /** Name of the search panel field (the placeholder is `searchPlaceholder`). */
  searchPanelLabel: string;
  /** Name of the search field in the header filter. */
  headerFilterSearchLabel: string;
  /** Name of the "pin to start" toggle in the column chooser. `{column}` = column label. */
  fixStartLabel: string;
  /** Name of the "pin to end" toggle in the column chooser. `{column}` = column label. */
  fixEndLabel: string;
  /** Header filter note when only part of the values is listed. `{shown}`, `{count}`. */
  headerFilterTruncated: string;
  /** Header filter announcement after searching. `{count}` = values found (no plural forms: keep it a label). */
  headerFilterSearchAnnouncement: string;
  /** "Select all" checkbox of the header filter while searching. `{count}` = values found. */
  selectAllResults: string;
}

/** Keys renamed in 1.x: old name → new name (spec 15). */
const LEGACY_I18N_KEYS: Readonly<Record<string, keyof GridI18n>> = {
  clearSorting: 'sortClearedAnnouncement',
  pinStart: 'fixStart',
  pinEnd: 'fixEnd',
  unpin: 'unfix',
};

const warnedLegacyKeys = new Set<string>();

/** Translation that may still use the deprecated key names. */
export type GridI18nInput = Partial<GridI18n> & {
  /** @deprecated Use `sortClearedAnnouncement`. */
  clearSorting?: string;
  /** @deprecated Use `fixStart`. */
  pinStart?: string;
  /** @deprecated Use `fixEnd`. */
  pinEnd?: string;
  /** @deprecated Use `unfix`. */
  unpin?: string;
};

/** Troca as chaves antigas pelas novas (aviso uma vez por chave). */
const normalizeTranslation = (translation: GridI18nInput): Partial<GridI18n> => {
  const result: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(translation)) {
    const renamed = LEGACY_I18N_KEYS[key];

    if (!renamed) {
      result[key] = value;
      continue;
    }

    if (!warnedLegacyKeys.has(key)) {
      warnedLegacyKeys.add(key);
      console.warn(`setGridTranslation: "${key}" is deprecated, use "${renamed}" instead.`);
    }

    // A chave nova, se vier junto, vence.
    if (!(renamed in translation)) {
      result[renamed] = value;
    }
  }

  return result;
};

/** @internal */
export const DEFAULT_GRID_LANGUAGE = 'en';

/**
 * Built-in translations keyed by lowercase language code. Region specific
 * entries (e.g. `pt-br`) can be added through {@link setGridTranslation} and
 * take precedence over their base language.
 *
 * Objeto sem protótipo: `language="constructor"` ou
 * `setGridTranslation('__proto__', …)` não alcançam `Object.prototype`.
 * @internal
 */
export const gridTranslations: Record<string, GridI18n> = Object.assign(Object.create(null) as Record<string, GridI18n>, {
  en: {
    noData: 'No data',
    dragToGroup: 'Drag a column header here, or press Ctrl+G on a header, to group by it',
    groupLabelSeparator: ': ',
    sortAscending: 'ascending',
    sortDescending: 'descending',
    sortClearedAnnouncement: 'Sorting removed from {column}',
    sortedAnnouncement: 'Sorted by {column}, {order}',
    trueText: 'True',
    falseText: 'False',
    columnChooser: 'Column chooser',
    hideColumn: 'Hide column',
    showColumn: 'Show column',
    fixStart: 'Pin to start',
    fixEnd: 'Pin to end',
    unfix: 'Unpin',
    autoSize: 'Double-click or press Enter to auto-size',
    summarySum: 'Sum',
    summaryMin: 'Min',
    summaryMax: 'Max',
    summaryAvg: 'Avg',
    summaryCount: 'Count',
    summaryText: '{type}: {value}',
    summaryColumnText: '{type} of {column}: {value}',
    groupInfoText: '({info})',
    ungroupColumn: 'Ungroup',
    ungroupAll: 'Ungroup all',
    expandAllGroups: 'Expand all groups',
    collapseAllGroups: 'Collapse all groups',
    groupPanelMenu: 'Group options',
    filterEquals: 'Equals',
    filterNotEquals: 'Does not equal',
    filterLessThan: 'Less than',
    filterLessThanOrEqual: 'Less than or equal to',
    filterGreaterThan: 'Greater than',
    filterGreaterThanOrEqual: 'Greater than or equal to',
    filterContains: 'Contains',
    filterNotContains: 'Does not contain',
    filterStartsWith: 'Starts with',
    filterEndsWith: 'Ends with',
    filterBetween: 'Between',
    filterAnyOf: 'Is any of',
    filterNoneOf: 'Is none of',
    filterIsBlank: 'Is blank',
    filterIsNotBlank: 'Is not blank',
    filterReset: 'Reset',
    filterEditorLabel: 'Filter {column}',
    filterOperationLabel: 'Filter operation',
    headerFilterLabel: 'Filter options for {column}',
    filterBetweenStart: 'From',
    filterBetweenEnd: 'To',
    filterAll: '(All)',
    filterBlanks: '(Blanks)',
    filterClear: 'Clear filter',
    searchPlaceholder: 'Search…',
    selectAll: 'Select all',
    ok: 'OK',
    cancel: 'Cancel',
    filteredAnnouncement: 'Rows: {count}',
    selectRow: 'Select row',
    selectAllRows: 'Select all rows',
    rowsSelectedAnnouncement: 'Selected rows: {count}',
    rowsCopiedAnnouncement: 'Copied rows: {count}',
    cellCopiedAnnouncement: 'Cell copied',
    columnMovedAnnouncement: '{column} moved to position {position} of {count}',
    groupedAnnouncement: 'Grouped by {column}',
    ungroupedAnnouncement: 'Ungrouped {column}',
    columnHeaderMenuLabel: 'Options for {column}',
    groupColumn: 'Group by this column',
    moveLeft: 'Move left',
    moveRight: 'Move right',
    autoSizeColumn: 'Auto-size column',
    increaseColumnWidth: 'Increase width',
    decreaseColumnWidth: 'Decrease width',
    columnFiltered: 'Filtered',
    columnFixedStart: 'Pinned to start',
    columnFixedEnd: 'Pinned to end',
    columnSortPriority: 'Sorted {order}, priority {priority}',
    sortedWithPriorityAnnouncement: 'Sorted by {column}, {order}, priority {priority}',
    groupLevelChangedAnnouncement: '{column} moved to grouping level {level} of {count}',
    groupingClearedAnnouncement: 'All columns ungrouped',
    groupsExpandedAnnouncement: 'All groups expanded',
    groupsCollapsedAnnouncement: 'All groups collapsed',
    columnResizedAnnouncement: '{column} width: {width} px',
    resizeHandleLabel: 'Resize {column}',
    groupPanelLabel: 'Grouping',
    filterOperationButtonLabel: 'Filter operation for {column}: {operation}',
    searchPanelLabel: 'Search in the grid',
    headerFilterSearchLabel: 'Search values',
    fixStartLabel: 'Pin {column} to start',
    fixEndLabel: 'Pin {column} to end',
    headerFilterTruncated: 'Showing {shown} of {count}',
    headerFilterSearchAnnouncement: 'Values: {count}',
    selectAllResults: 'Select all results ({count})',
  },
  es: {
    noData: 'Sin datos',
    dragToGroup: 'Arrastre aquí el encabezado de una columna, o pulse Ctrl+G en un encabezado, para agrupar',
    groupLabelSeparator: ': ',
    sortAscending: 'ascendente',
    sortDescending: 'descendente',
    sortClearedAnnouncement: 'Se quitó el orden de {column}',
    sortedAnnouncement: 'Ordenado por {column}, {order}',
    trueText: 'Verdadero',
    falseText: 'Falso',
    columnChooser: 'Selector de columnas',
    hideColumn: 'Ocultar columna',
    showColumn: 'Mostrar columna',
    fixStart: 'Fijar al inicio',
    fixEnd: 'Fijar al final',
    unfix: 'Desfijar',
    autoSize: 'Doble clic o Intro para ajustar al contenido',
    summarySum: 'Suma',
    summaryMin: 'Mín.',
    summaryMax: 'Máx.',
    summaryAvg: 'Prom.',
    summaryCount: 'Recuento',
    summaryText: '{type}: {value}',
    summaryColumnText: '{type} de {column}: {value}',
    groupInfoText: '({info})',
    ungroupColumn: 'Desagrupar',
    ungroupAll: 'Desagrupar todo',
    expandAllGroups: 'Expandir todos los grupos',
    collapseAllGroups: 'Contraer todos los grupos',
    groupPanelMenu: 'Opciones de grupo',
    filterEquals: 'Igual a',
    filterNotEquals: 'Distinto de',
    filterLessThan: 'Menor que',
    filterLessThanOrEqual: 'Menor o igual que',
    filterGreaterThan: 'Mayor que',
    filterGreaterThanOrEqual: 'Mayor o igual que',
    filterContains: 'Contiene',
    filterNotContains: 'No contiene',
    filterStartsWith: 'Empieza por',
    filterEndsWith: 'Termina en',
    filterBetween: 'Entre',
    filterAnyOf: 'Es alguno de',
    filterNoneOf: 'No es ninguno de',
    filterIsBlank: 'Está vacío',
    filterIsNotBlank: 'No está vacío',
    filterReset: 'Restablecer',
    filterEditorLabel: 'Filtrar {column}',
    filterOperationLabel: 'Operación de filtro',
    headerFilterLabel: 'Opciones de filtro de {column}',
    filterBetweenStart: 'Desde',
    filterBetweenEnd: 'Hasta',
    filterAll: '(Todos)',
    filterBlanks: '(Vacíos)',
    filterClear: 'Quitar filtro',
    searchPlaceholder: 'Buscar…',
    selectAll: 'Seleccionar todo',
    ok: 'Aceptar',
    cancel: 'Cancelar',
    filteredAnnouncement: 'Filas: {count}',
    selectRow: 'Seleccionar fila',
    selectAllRows: 'Seleccionar todas las filas',
    rowsSelectedAnnouncement: 'Filas seleccionadas: {count}',
    rowsCopiedAnnouncement: 'Filas copiadas: {count}',
    cellCopiedAnnouncement: 'Celda copiada',
    columnMovedAnnouncement: '{column} movida a la posición {position} de {count}',
    groupedAnnouncement: 'Agrupado por {column}',
    ungroupedAnnouncement: 'Se quitó la agrupación por {column}',
    columnHeaderMenuLabel: 'Opciones de {column}',
    groupColumn: 'Agrupar por esta columna',
    moveLeft: 'Mover a la izquierda',
    moveRight: 'Mover a la derecha',
    autoSizeColumn: 'Ajustar ancho al contenido',
    increaseColumnWidth: 'Aumentar ancho',
    decreaseColumnWidth: 'Reducir ancho',
    columnFiltered: 'Filtrada',
    columnFixedStart: 'Fijada al inicio',
    columnFixedEnd: 'Fijada al final',
    columnSortPriority: 'Orden {order}, prioridad {priority}',
    sortedWithPriorityAnnouncement: 'Ordenado por {column}, {order}, prioridad {priority}',
    groupLevelChangedAnnouncement: '{column} movida al nivel de agrupación {level} de {count}',
    groupingClearedAnnouncement: 'Todas las columnas desagrupadas',
    groupsExpandedAnnouncement: 'Todos los grupos expandidos',
    groupsCollapsedAnnouncement: 'Todos los grupos contraídos',
    columnResizedAnnouncement: 'Ancho de {column}: {width} px',
    resizeHandleLabel: 'Cambiar el ancho de {column}',
    groupPanelLabel: 'Agrupación',
    filterOperationButtonLabel: 'Operación de filtro de {column}: {operation}',
    searchPanelLabel: 'Buscar en la cuadrícula',
    headerFilterSearchLabel: 'Buscar valores',
    fixStartLabel: 'Fijar {column} al inicio',
    fixEndLabel: 'Fijar {column} al final',
    headerFilterTruncated: 'Mostrando {shown} de {count}',
    headerFilterSearchAnnouncement: 'Valores: {count}',
    selectAllResults: 'Seleccionar todos los resultados ({count})',
  },
  pt: {
    noData: 'Sem dados',
    dragToGroup: 'Arraste o cabeçalho de uma coluna aqui, ou pressione Ctrl+G num cabeçalho, para agrupar',
    groupLabelSeparator: ': ',
    sortAscending: 'crescente',
    sortDescending: 'decrescente',
    sortClearedAnnouncement: 'Ordenação removida de {column}',
    sortedAnnouncement: 'Ordenado por {column}, {order}',
    trueText: 'Verdadeiro',
    falseText: 'Falso',
    columnChooser: 'Seletor de colunas',
    hideColumn: 'Ocultar coluna',
    showColumn: 'Mostrar coluna',
    fixStart: 'Fixar no início',
    fixEnd: 'Fixar no fim',
    unfix: 'Desafixar',
    autoSize: 'Clique duplo ou Enter para ajustar ao conteúdo',
    summarySum: 'Soma',
    summaryMin: 'Mín.',
    summaryMax: 'Máx.',
    summaryAvg: 'Média',
    summaryCount: 'Contagem',
    summaryText: '{type}: {value}',
    summaryColumnText: '{type} de {column}: {value}',
    groupInfoText: '({info})',
    ungroupColumn: 'Desagrupar',
    ungroupAll: 'Desagrupar tudo',
    expandAllGroups: 'Expandir todos os grupos',
    collapseAllGroups: 'Recolher todos os grupos',
    groupPanelMenu: 'Opções de grupo',
    filterEquals: 'Igual a',
    filterNotEquals: 'Diferente de',
    filterLessThan: 'Menor que',
    filterLessThanOrEqual: 'Menor ou igual a',
    filterGreaterThan: 'Maior que',
    filterGreaterThanOrEqual: 'Maior ou igual a',
    filterContains: 'Contém',
    filterNotContains: 'Não contém',
    filterStartsWith: 'Começa com',
    filterEndsWith: 'Termina com',
    filterBetween: 'Entre',
    filterAnyOf: 'É um de',
    filterNoneOf: 'Não é nenhum de',
    filterIsBlank: 'Está vazio',
    filterIsNotBlank: 'Não está vazio',
    filterReset: 'Redefinir',
    filterEditorLabel: 'Filtrar {column}',
    filterOperationLabel: 'Operação do filtro',
    headerFilterLabel: 'Opções de filtro de {column}',
    filterBetweenStart: 'De',
    filterBetweenEnd: 'Até',
    filterAll: '(Todos)',
    filterBlanks: '(Vazios)',
    filterClear: 'Limpar filtro',
    searchPlaceholder: 'Pesquisar…',
    selectAll: 'Selecionar tudo',
    ok: 'OK',
    cancel: 'Cancelar',
    filteredAnnouncement: 'Linhas: {count}',
    selectRow: 'Selecionar linha',
    selectAllRows: 'Selecionar todas as linhas',
    rowsSelectedAnnouncement: 'Linhas selecionadas: {count}',
    rowsCopiedAnnouncement: 'Linhas copiadas: {count}',
    cellCopiedAnnouncement: 'Célula copiada',
    columnMovedAnnouncement: '{column} movida para a posição {position} de {count}',
    groupedAnnouncement: 'Agrupado por {column}',
    ungroupedAnnouncement: 'Agrupamento por {column} removido',
    columnHeaderMenuLabel: 'Opções de {column}',
    groupColumn: 'Agrupar por esta coluna',
    moveLeft: 'Mover para a esquerda',
    moveRight: 'Mover para a direita',
    autoSizeColumn: 'Ajustar largura ao conteúdo',
    increaseColumnWidth: 'Aumentar largura',
    decreaseColumnWidth: 'Diminuir largura',
    columnFiltered: 'Filtrada',
    columnFixedStart: 'Fixada no início',
    columnFixedEnd: 'Fixada no fim',
    columnSortPriority: 'Ordem {order}, prioridade {priority}',
    sortedWithPriorityAnnouncement: 'Ordenado por {column}, {order}, prioridade {priority}',
    groupLevelChangedAnnouncement: '{column} movida para o nível de agrupamento {level} de {count}',
    groupingClearedAnnouncement: 'Todas as colunas desagrupadas',
    groupsExpandedAnnouncement: 'Todos os grupos expandidos',
    groupsCollapsedAnnouncement: 'Todos os grupos recolhidos',
    columnResizedAnnouncement: 'Largura de {column}: {width} px',
    resizeHandleLabel: 'Redimensionar {column}',
    groupPanelLabel: 'Agrupamento',
    filterOperationButtonLabel: 'Operação de filtro de {column}: {operation}',
    searchPanelLabel: 'Pesquisar na grade',
    headerFilterSearchLabel: 'Pesquisar valores',
    fixStartLabel: 'Fixar {column} no início',
    fixEndLabel: 'Fixar {column} no fim',
    headerFilterTruncated: 'Mostrando {shown} de {count}',
    headerFilterSearchAnnouncement: 'Valores: {count}',
    selectAllResults: 'Selecionar todos os resultados ({count})',
  },
  fr: {
    noData: 'Aucune donnée',
    dragToGroup: 'Faites glisser l’en-tête d’une colonne ici, ou appuyez sur Ctrl+G sur un en-tête, pour regrouper',
    groupLabelSeparator: ' : ',
    sortAscending: 'croissant',
    sortDescending: 'décroissant',
    sortClearedAnnouncement: 'Tri retiré de {column}',
    sortedAnnouncement: 'Trié par {column}, {order}',
    trueText: 'Vrai',
    falseText: 'Faux',
    columnChooser: 'Sélecteur de colonnes',
    hideColumn: 'Masquer la colonne',
    showColumn: 'Afficher la colonne',
    fixStart: 'Épingler au début',
    fixEnd: 'Épingler à la fin',
    unfix: 'Désépingler',
    autoSize: 'Double-cliquez ou appuyez sur Entrée pour ajuster au contenu',
    summarySum: 'Somme',
    summaryMin: 'Min',
    summaryMax: 'Max',
    summaryAvg: 'Moy.',
    summaryCount: 'Nombre',
    summaryText: '{type} : {value}',
    summaryColumnText: '{type} de {column} : {value}',
    groupInfoText: '({info})',
    ungroupColumn: 'Dégrouper',
    ungroupAll: 'Tout dégrouper',
    expandAllGroups: 'Développer tous les groupes',
    collapseAllGroups: 'Réduire tous les groupes',
    groupPanelMenu: 'Options de groupe',
    filterEquals: 'Égal à',
    filterNotEquals: 'Différent de',
    filterLessThan: 'Inférieur à',
    filterLessThanOrEqual: 'Inférieur ou égal à',
    filterGreaterThan: 'Supérieur à',
    filterGreaterThanOrEqual: 'Supérieur ou égal à',
    filterContains: 'Contient',
    filterNotContains: 'Ne contient pas',
    filterStartsWith: 'Commence par',
    filterEndsWith: 'Se termine par',
    filterBetween: 'Entre',
    filterAnyOf: 'Est l’un de',
    filterNoneOf: 'N’est aucun de',
    filterIsBlank: 'Est vide',
    filterIsNotBlank: 'N’est pas vide',
    filterReset: 'Réinitialiser',
    filterEditorLabel: 'Filtrer {column}',
    filterOperationLabel: 'Opération de filtre',
    headerFilterLabel: 'Options de filtre pour {column}',
    filterBetweenStart: 'De',
    filterBetweenEnd: 'À',
    filterAll: '(Tous)',
    filterBlanks: '(Vides)',
    filterClear: 'Effacer le filtre',
    searchPlaceholder: 'Rechercher…',
    selectAll: 'Tout sélectionner',
    ok: 'OK',
    cancel: 'Annuler',
    filteredAnnouncement: 'Lignes : {count}',
    selectRow: 'Sélectionner la ligne',
    selectAllRows: 'Sélectionner toutes les lignes',
    rowsSelectedAnnouncement: 'Lignes sélectionnées : {count}',
    rowsCopiedAnnouncement: 'Lignes copiées : {count}',
    cellCopiedAnnouncement: 'Cellule copiée',
    columnMovedAnnouncement: '{column} déplacée en position {position} sur {count}',
    groupedAnnouncement: 'Groupé par {column}',
    ungroupedAnnouncement: 'Regroupement par {column} supprimé',
    columnHeaderMenuLabel: 'Options de {column}',
    groupColumn: 'Regrouper par cette colonne',
    moveLeft: 'Déplacer vers la gauche',
    moveRight: 'Déplacer vers la droite',
    autoSizeColumn: 'Ajuster la largeur au contenu',
    increaseColumnWidth: 'Élargir',
    decreaseColumnWidth: 'Rétrécir',
    columnFiltered: 'Filtrée',
    columnFixedStart: 'Épinglée au début',
    columnFixedEnd: 'Épinglée à la fin',
    columnSortPriority: 'Tri {order}, priorité {priority}',
    sortedWithPriorityAnnouncement: 'Trié par {column}, {order}, priorité {priority}',
    groupLevelChangedAnnouncement: '{column} déplacée au niveau de regroupement {level} sur {count}',
    groupingClearedAnnouncement: 'Toutes les colonnes dégroupées',
    groupsExpandedAnnouncement: 'Tous les groupes développés',
    groupsCollapsedAnnouncement: 'Tous les groupes réduits',
    columnResizedAnnouncement: 'Largeur de {column} : {width} px',
    resizeHandleLabel: 'Redimensionner {column}',
    groupPanelLabel: 'Regroupement',
    filterOperationButtonLabel: 'Opération de filtre pour {column} : {operation}',
    searchPanelLabel: 'Rechercher dans la grille',
    headerFilterSearchLabel: 'Rechercher des valeurs',
    fixStartLabel: 'Épingler {column} au début',
    fixEndLabel: 'Épingler {column} à la fin',
    headerFilterTruncated: '{shown} affichées sur {count}',
    headerFilterSearchAnnouncement: 'Valeurs : {count}',
    selectAllResults: 'Sélectionner tous les résultats ({count})',
  },
  de: {
    noData: 'Keine Daten',
    dragToGroup: 'Ziehen Sie eine Spaltenüberschrift hierher oder drücken Sie Strg+G auf einer Überschrift, um zu gruppieren',
    groupLabelSeparator: ': ',
    sortAscending: 'aufsteigend',
    sortDescending: 'absteigend',
    sortClearedAnnouncement: 'Sortierung von {column} entfernt',
    sortedAnnouncement: 'Sortiert nach {column}, {order}',
    trueText: 'Wahr',
    falseText: 'Falsch',
    columnChooser: 'Spaltenauswahl',
    hideColumn: 'Spalte ausblenden',
    showColumn: 'Spalte einblenden',
    fixStart: 'Am Anfang fixieren',
    fixEnd: 'Am Ende fixieren',
    unfix: 'Fixierung aufheben',
    autoSize: 'Doppelklicken oder Eingabetaste drücken, um die Breite anzupassen',
    summarySum: 'Summe',
    summaryMin: 'Min.',
    summaryMax: 'Max.',
    summaryAvg: 'Mittelw.',
    summaryCount: 'Anzahl',
    summaryText: '{type}: {value}',
    summaryColumnText: '{type} von {column}: {value}',
    groupInfoText: '({info})',
    ungroupColumn: 'Gruppierung aufheben',
    ungroupAll: 'Alle Gruppierungen aufheben',
    expandAllGroups: 'Alle Gruppen erweitern',
    collapseAllGroups: 'Alle Gruppen reduzieren',
    groupPanelMenu: 'Gruppenoptionen',
    filterEquals: 'Gleich',
    filterNotEquals: 'Ungleich',
    filterLessThan: 'Kleiner als',
    filterLessThanOrEqual: 'Kleiner oder gleich',
    filterGreaterThan: 'Größer als',
    filterGreaterThanOrEqual: 'Größer oder gleich',
    filterContains: 'Enthält',
    filterNotContains: 'Enthält nicht',
    filterStartsWith: 'Beginnt mit',
    filterEndsWith: 'Endet mit',
    filterBetween: 'Zwischen',
    filterAnyOf: 'Ist einer von',
    filterNoneOf: 'Ist keiner von',
    filterIsBlank: 'Ist leer',
    filterIsNotBlank: 'Ist nicht leer',
    filterReset: 'Zurücksetzen',
    filterEditorLabel: '{column} filtern',
    filterOperationLabel: 'Filteroperation',
    headerFilterLabel: 'Filteroptionen für {column}',
    filterBetweenStart: 'Von',
    filterBetweenEnd: 'Bis',
    filterAll: '(Alle)',
    filterBlanks: '(Leer)',
    filterClear: 'Filter löschen',
    searchPlaceholder: 'Suchen…',
    selectAll: 'Alle auswählen',
    ok: 'OK',
    cancel: 'Abbrechen',
    filteredAnnouncement: 'Zeilen: {count}',
    selectRow: 'Zeile auswählen',
    selectAllRows: 'Alle Zeilen auswählen',
    rowsSelectedAnnouncement: 'Ausgewählte Zeilen: {count}',
    rowsCopiedAnnouncement: 'Kopierte Zeilen: {count}',
    cellCopiedAnnouncement: 'Zelle kopiert',
    columnMovedAnnouncement: '{column} an Position {position} von {count} verschoben',
    groupedAnnouncement: 'Gruppiert nach {column}',
    ungroupedAnnouncement: 'Gruppierung nach {column} aufgehoben',
    columnHeaderMenuLabel: 'Optionen für {column}',
    groupColumn: 'Nach dieser Spalte gruppieren',
    moveLeft: 'Nach links verschieben',
    moveRight: 'Nach rechts verschieben',
    autoSizeColumn: 'Breite an Inhalt anpassen',
    increaseColumnWidth: 'Breiter',
    decreaseColumnWidth: 'Schmaler',
    columnFiltered: 'Gefiltert',
    columnFixedStart: 'Am Anfang fixiert',
    columnFixedEnd: 'Am Ende fixiert',
    columnSortPriority: 'Sortierung {order}, Priorität {priority}',
    sortedWithPriorityAnnouncement: 'Sortiert nach {column}, {order}, Priorität {priority}',
    groupLevelChangedAnnouncement: '{column} auf Gruppierungsebene {level} von {count} verschoben',
    groupingClearedAnnouncement: 'Gruppierung aller Spalten aufgehoben',
    groupsExpandedAnnouncement: 'Alle Gruppen erweitert',
    groupsCollapsedAnnouncement: 'Alle Gruppen reduziert',
    columnResizedAnnouncement: 'Breite von {column}: {width} px',
    resizeHandleLabel: 'Breite von {column} ändern',
    groupPanelLabel: 'Gruppierung',
    filterOperationButtonLabel: 'Filteroperation für {column}: {operation}',
    searchPanelLabel: 'Im Raster suchen',
    headerFilterSearchLabel: 'Werte suchen',
    fixStartLabel: '{column} am Anfang fixieren',
    fixEndLabel: '{column} am Ende fixieren',
    headerFilterTruncated: '{shown} von {count} angezeigt',
    headerFilterSearchAnnouncement: 'Werte: {count}',
    selectAllResults: 'Alle Ergebnisse auswählen ({count})',
  },
  it: {
    noData: 'Nessun dato',
    dragToGroup: 'Trascina qui l’intestazione di una colonna, o premi Ctrl+G su un’intestazione, per raggruppare',
    groupLabelSeparator: ': ',
    sortAscending: 'crescente',
    sortDescending: 'decrescente',
    sortClearedAnnouncement: 'Ordinamento rimosso da {column}',
    sortedAnnouncement: 'Ordinato per {column}, {order}',
    trueText: 'Vero',
    falseText: 'Falso',
    columnChooser: 'Selettore colonne',
    hideColumn: 'Nascondi colonna',
    showColumn: 'Mostra colonna',
    fixStart: 'Blocca all’inizio',
    fixEnd: 'Blocca alla fine',
    unfix: 'Sblocca',
    autoSize: 'Doppio clic o Invio per adattare al contenuto',
    summarySum: 'Somma',
    summaryMin: 'Min',
    summaryMax: 'Max',
    summaryAvg: 'Media',
    summaryCount: 'Conteggio',
    summaryText: '{type}: {value}',
    summaryColumnText: '{type} di {column}: {value}',
    groupInfoText: '({info})',
    ungroupColumn: 'Separa',
    ungroupAll: 'Separa tutto',
    expandAllGroups: 'Espandi tutti i gruppi',
    collapseAllGroups: 'Comprimi tutti i gruppi',
    groupPanelMenu: 'Opzioni di gruppo',
    filterEquals: 'Uguale a',
    filterNotEquals: 'Diverso da',
    filterLessThan: 'Minore di',
    filterLessThanOrEqual: 'Minore o uguale a',
    filterGreaterThan: 'Maggiore di',
    filterGreaterThanOrEqual: 'Maggiore o uguale a',
    filterContains: 'Contiene',
    filterNotContains: 'Non contiene',
    filterStartsWith: 'Inizia con',
    filterEndsWith: 'Termina con',
    filterBetween: 'Tra',
    filterAnyOf: 'È uno di',
    filterNoneOf: 'Non è nessuno di',
    filterIsBlank: 'È vuoto',
    filterIsNotBlank: 'Non è vuoto',
    filterReset: 'Reimposta',
    filterEditorLabel: 'Filtra {column}',
    filterOperationLabel: 'Operazione di filtro',
    headerFilterLabel: 'Opzioni di filtro per {column}',
    filterBetweenStart: 'Da',
    filterBetweenEnd: 'A',
    filterAll: '(Tutti)',
    filterBlanks: '(Vuoti)',
    filterClear: 'Cancella filtro',
    searchPlaceholder: 'Cerca…',
    selectAll: 'Seleziona tutto',
    ok: 'OK',
    cancel: 'Annulla',
    filteredAnnouncement: 'Righe: {count}',
    selectRow: 'Seleziona riga',
    selectAllRows: 'Seleziona tutte le righe',
    rowsSelectedAnnouncement: 'Righe selezionate: {count}',
    rowsCopiedAnnouncement: 'Righe copiate: {count}',
    cellCopiedAnnouncement: 'Cella copiata',
    columnMovedAnnouncement: '{column} spostata in posizione {position} di {count}',
    groupedAnnouncement: 'Raggruppato per {column}',
    ungroupedAnnouncement: 'Raggruppamento per {column} rimosso',
    columnHeaderMenuLabel: 'Opzioni di {column}',
    groupColumn: 'Raggruppa per questa colonna',
    moveLeft: 'Sposta a sinistra',
    moveRight: 'Sposta a destra',
    autoSizeColumn: 'Adatta larghezza al contenuto',
    increaseColumnWidth: 'Aumenta larghezza',
    decreaseColumnWidth: 'Riduci larghezza',
    columnFiltered: 'Filtrata',
    columnFixedStart: 'Bloccata all’inizio',
    columnFixedEnd: 'Bloccata alla fine',
    columnSortPriority: 'Ordine {order}, priorità {priority}',
    sortedWithPriorityAnnouncement: 'Ordinato per {column}, {order}, priorità {priority}',
    groupLevelChangedAnnouncement: '{column} spostata al livello di raggruppamento {level} di {count}',
    groupingClearedAnnouncement: 'Raggruppamento rimosso da tutte le colonne',
    groupsExpandedAnnouncement: 'Tutti i gruppi espansi',
    groupsCollapsedAnnouncement: 'Tutti i gruppi compressi',
    columnResizedAnnouncement: 'Larghezza di {column}: {width} px',
    resizeHandleLabel: 'Ridimensiona {column}',
    groupPanelLabel: 'Raggruppamento',
    filterOperationButtonLabel: 'Operazione di filtro per {column}: {operation}',
    searchPanelLabel: 'Cerca nella griglia',
    headerFilterSearchLabel: 'Cerca valori',
    fixStartLabel: 'Blocca {column} all’inizio',
    fixEndLabel: 'Blocca {column} alla fine',
    headerFilterTruncated: 'Visualizzati {shown} di {count}',
    headerFilterSearchAnnouncement: 'Valori: {count}',
    selectAllResults: 'Seleziona tutti i risultati ({count})',
  },
  nl: {
    noData: 'Geen gegevens',
    dragToGroup: 'Sleep een kolomkop hierheen, of druk op Ctrl+G op een kolomkop, om te groeperen',
    groupLabelSeparator: ': ',
    sortAscending: 'oplopend',
    sortDescending: 'aflopend',
    sortClearedAnnouncement: 'Sortering verwijderd van {column}',
    sortedAnnouncement: 'Gesorteerd op {column}, {order}',
    trueText: 'Waar',
    falseText: 'Onwaar',
    columnChooser: 'Kolomkiezer',
    hideColumn: 'Kolom verbergen',
    showColumn: 'Kolom weergeven',
    fixStart: 'Vastzetten aan het begin',
    fixEnd: 'Vastzetten aan het einde',
    unfix: 'Losmaken',
    autoSize: 'Dubbelklik of druk op Enter om aan de inhoud aan te passen',
    summarySum: 'Som',
    summaryMin: 'Min.',
    summaryMax: 'Max.',
    summaryAvg: 'Gem.',
    summaryCount: 'Aantal',
    summaryText: '{type}: {value}',
    summaryColumnText: '{type} van {column}: {value}',
    groupInfoText: '({info})',
    ungroupColumn: 'Groepering opheffen',
    ungroupAll: 'Alle groeperingen opheffen',
    expandAllGroups: 'Alle groepen uitvouwen',
    collapseAllGroups: 'Alle groepen samenvouwen',
    groupPanelMenu: 'Groepsopties',
    filterEquals: 'Is gelijk aan',
    filterNotEquals: 'Is niet gelijk aan',
    filterLessThan: 'Kleiner dan',
    filterLessThanOrEqual: 'Kleiner dan of gelijk aan',
    filterGreaterThan: 'Groter dan',
    filterGreaterThanOrEqual: 'Groter dan of gelijk aan',
    filterContains: 'Bevat',
    filterNotContains: 'Bevat niet',
    filterStartsWith: 'Begint met',
    filterEndsWith: 'Eindigt op',
    filterBetween: 'Tussen',
    filterAnyOf: 'Is een van',
    filterNoneOf: 'Is geen van',
    filterIsBlank: 'Is leeg',
    filterIsNotBlank: 'Is niet leeg',
    filterReset: 'Herstellen',
    filterEditorLabel: '{column} filteren',
    filterOperationLabel: 'Filterbewerking',
    headerFilterLabel: 'Filteropties voor {column}',
    filterBetweenStart: 'Van',
    filterBetweenEnd: 'Tot',
    filterAll: '(Alle)',
    filterBlanks: '(Leeg)',
    filterClear: 'Filter wissen',
    searchPlaceholder: 'Zoeken…',
    selectAll: 'Alles selecteren',
    ok: 'OK',
    cancel: 'Annuleren',
    filteredAnnouncement: 'Rijen: {count}',
    selectRow: 'Rij selecteren',
    selectAllRows: 'Alle rijen selecteren',
    rowsSelectedAnnouncement: 'Geselecteerde rijen: {count}',
    rowsCopiedAnnouncement: 'Gekopieerde rijen: {count}',
    cellCopiedAnnouncement: 'Cel gekopieerd',
    columnMovedAnnouncement: '{column} verplaatst naar positie {position} van {count}',
    groupedAnnouncement: 'Gegroepeerd op {column}',
    ungroupedAnnouncement: 'Groepering op {column} verwijderd',
    columnHeaderMenuLabel: 'Opties voor {column}',
    groupColumn: 'Groeperen op deze kolom',
    moveLeft: 'Naar links verplaatsen',
    moveRight: 'Naar rechts verplaatsen',
    autoSizeColumn: 'Breedte aan inhoud aanpassen',
    increaseColumnWidth: 'Breder',
    decreaseColumnWidth: 'Smaller',
    columnFiltered: 'Gefilterd',
    columnFixedStart: 'Vastgezet aan het begin',
    columnFixedEnd: 'Vastgezet aan het einde',
    columnSortPriority: 'Sortering {order}, prioriteit {priority}',
    sortedWithPriorityAnnouncement: 'Gesorteerd op {column}, {order}, prioriteit {priority}',
    groupLevelChangedAnnouncement: '{column} verplaatst naar groeperingsniveau {level} van {count}',
    groupingClearedAnnouncement: 'Groepering van alle kolommen opgeheven',
    groupsExpandedAnnouncement: 'Alle groepen uitgevouwen',
    groupsCollapsedAnnouncement: 'Alle groepen samengevouwen',
    columnResizedAnnouncement: 'Breedte van {column}: {width} px',
    resizeHandleLabel: 'Breedte van {column} wijzigen',
    groupPanelLabel: 'Groepering',
    filterOperationButtonLabel: 'Filterbewerking voor {column}: {operation}',
    searchPanelLabel: 'Zoeken in het raster',
    headerFilterSearchLabel: 'Waarden zoeken',
    fixStartLabel: '{column} aan het begin vastzetten',
    fixEndLabel: '{column} aan het einde vastzetten',
    headerFilterTruncated: '{shown} van {count} weergegeven',
    headerFilterSearchAnnouncement: 'Waarden: {count}',
    selectAllResults: 'Alle resultaten selecteren ({count})',
  },
  ru: {
    noData: 'Нет данных',
    dragToGroup: 'Перетащите сюда заголовок столбца или нажмите Ctrl+G на заголовке для группировки',
    groupLabelSeparator: ': ',
    sortAscending: 'по возрастанию',
    sortDescending: 'по убыванию',
    sortClearedAnnouncement: 'Сортировка по столбцу {column} отменена',
    sortedAnnouncement: 'Отсортировано по столбцу {column}, {order}',
    trueText: 'Истина',
    falseText: 'Ложь',
    columnChooser: 'Выбор столбцов',
    hideColumn: 'Скрыть столбец',
    showColumn: 'Показать столбец',
    fixStart: 'Закрепить в начале',
    fixEnd: 'Закрепить в конце',
    unfix: 'Открепить',
    autoSize: 'Дважды щёлкните или нажмите Enter, чтобы подогнать ширину',
    summarySum: 'Сумма',
    summaryMin: 'Мин.',
    summaryMax: 'Макс.',
    summaryAvg: 'Сред.',
    summaryCount: 'Количество',
    summaryText: '{type}: {value}',
    summaryColumnText: '{type} ({column}): {value}',
    groupInfoText: '({info})',
    ungroupColumn: 'Разгруппировать',
    ungroupAll: 'Разгруппировать все',
    expandAllGroups: 'Развернуть все группы',
    collapseAllGroups: 'Свернуть все группы',
    groupPanelMenu: 'Параметры группировки',
    filterEquals: 'Равно',
    filterNotEquals: 'Не равно',
    filterLessThan: 'Меньше',
    filterLessThanOrEqual: 'Меньше или равно',
    filterGreaterThan: 'Больше',
    filterGreaterThanOrEqual: 'Больше или равно',
    filterContains: 'Содержит',
    filterNotContains: 'Не содержит',
    filterStartsWith: 'Начинается с',
    filterEndsWith: 'Заканчивается на',
    filterBetween: 'Между',
    filterAnyOf: 'Любое из',
    filterNoneOf: 'Ни одно из',
    filterIsBlank: 'Пусто',
    filterIsNotBlank: 'Не пусто',
    filterReset: 'Сбросить',
    filterEditorLabel: 'Фильтр: {column}',
    filterOperationLabel: 'Операция фильтра',
    headerFilterLabel: 'Параметры фильтра: {column}',
    filterBetweenStart: 'С',
    filterBetweenEnd: 'По',
    filterAll: '(Все)',
    filterBlanks: '(Пустые)',
    filterClear: 'Очистить фильтр',
    searchPlaceholder: 'Поиск…',
    selectAll: 'Выбрать все',
    ok: 'ОК',
    cancel: 'Отмена',
    filteredAnnouncement: 'Строк: {count}',
    selectRow: 'Выбрать строку',
    selectAllRows: 'Выбрать все строки',
    rowsSelectedAnnouncement: 'Выбрано строк: {count}',
    rowsCopiedAnnouncement: 'Скопировано строк: {count}',
    cellCopiedAnnouncement: 'Ячейка скопирована',
    columnMovedAnnouncement: 'Столбец {column} перемещён на позицию {position} из {count}',
    groupedAnnouncement: 'Сгруппировано по {column}',
    ungroupedAnnouncement: 'Группировка по {column} снята',
    columnHeaderMenuLabel: 'Параметры столбца {column}',
    groupColumn: 'Группировать по этому столбцу',
    moveLeft: 'Переместить влево',
    moveRight: 'Переместить вправо',
    autoSizeColumn: 'Подогнать ширину по содержимому',
    increaseColumnWidth: 'Увеличить ширину',
    decreaseColumnWidth: 'Уменьшить ширину',
    columnFiltered: 'Отфильтрован',
    columnFixedStart: 'Закреплён в начале',
    columnFixedEnd: 'Закреплён в конце',
    columnSortPriority: 'Сортировка {order}, приоритет {priority}',
    sortedWithPriorityAnnouncement: 'Отсортировано по столбцу {column}, {order}, приоритет {priority}',
    groupLevelChangedAnnouncement: 'Столбец {column} перемещён на уровень группировки {level} из {count}',
    groupingClearedAnnouncement: 'Группировка всех столбцов отменена',
    groupsExpandedAnnouncement: 'Все группы развёрнуты',
    groupsCollapsedAnnouncement: 'Все группы свёрнуты',
    columnResizedAnnouncement: 'Ширина столбца {column}: {width} px',
    resizeHandleLabel: 'Изменить ширину столбца {column}',
    groupPanelLabel: 'Группировка',
    filterOperationButtonLabel: 'Операция фильтра для столбца {column}: {operation}',
    searchPanelLabel: 'Поиск в таблице',
    headerFilterSearchLabel: 'Поиск значений',
    fixStartLabel: 'Закрепить {column} в начале',
    fixEndLabel: 'Закрепить {column} в конце',
    headerFilterTruncated: 'Показано {shown} из {count}',
    headerFilterSearchAnnouncement: 'Значения: {count}',
    selectAllResults: 'Выбрать все результаты ({count})',
  },
  pl: {
    noData: 'Brak danych',
    dragToGroup: 'Przeciągnij tutaj nagłówek kolumny lub naciśnij Ctrl+G na nagłówku, aby pogrupować',
    groupLabelSeparator: ': ',
    sortAscending: 'rosnąco',
    sortDescending: 'malejąco',
    sortClearedAnnouncement: 'Usunięto sortowanie według {column}',
    sortedAnnouncement: 'Posortowano według {column}, {order}',
    trueText: 'Prawda',
    falseText: 'Fałsz',
    columnChooser: 'Wybór kolumn',
    hideColumn: 'Ukryj kolumnę',
    showColumn: 'Pokaż kolumnę',
    fixStart: 'Przypnij na początku',
    fixEnd: 'Przypnij na końcu',
    unfix: 'Odepnij',
    autoSize: 'Kliknij dwukrotnie lub naciśnij Enter, aby dopasować szerokość',
    summarySum: 'Suma',
    summaryMin: 'Min.',
    summaryMax: 'Maks.',
    summaryAvg: 'Średnia',
    summaryCount: 'Liczba',
    summaryText: '{type}: {value}',
    summaryColumnText: '{type} ({column}): {value}',
    groupInfoText: '({info})',
    ungroupColumn: 'Rozgrupuj',
    ungroupAll: 'Rozgrupuj wszystko',
    expandAllGroups: 'Rozwiń wszystkie grupy',
    collapseAllGroups: 'Zwiń wszystkie grupy',
    groupPanelMenu: 'Opcje grupowania',
    filterEquals: 'Równe',
    filterNotEquals: 'Różne od',
    filterLessThan: 'Mniejsze niż',
    filterLessThanOrEqual: 'Mniejsze lub równe',
    filterGreaterThan: 'Większe niż',
    filterGreaterThanOrEqual: 'Większe lub równe',
    filterContains: 'Zawiera',
    filterNotContains: 'Nie zawiera',
    filterStartsWith: 'Zaczyna się od',
    filterEndsWith: 'Kończy się na',
    filterBetween: 'Pomiędzy',
    filterAnyOf: 'Jest jednym z',
    filterNoneOf: 'Nie jest żadnym z',
    filterIsBlank: 'Jest puste',
    filterIsNotBlank: 'Nie jest puste',
    filterReset: 'Resetuj',
    filterEditorLabel: 'Filtruj {column}',
    filterOperationLabel: 'Operacja filtru',
    headerFilterLabel: 'Opcje filtru dla {column}',
    filterBetweenStart: 'Od',
    filterBetweenEnd: 'Do',
    filterAll: '(Wszystkie)',
    filterBlanks: '(Puste)',
    filterClear: 'Wyczyść filtr',
    searchPlaceholder: 'Szukaj…',
    selectAll: 'Zaznacz wszystko',
    ok: 'OK',
    cancel: 'Anuluj',
    filteredAnnouncement: 'Wiersze: {count}',
    selectRow: 'Zaznacz wiersz',
    selectAllRows: 'Zaznacz wszystkie wiersze',
    rowsSelectedAnnouncement: 'Zaznaczone wiersze: {count}',
    rowsCopiedAnnouncement: 'Skopiowane wiersze: {count}',
    cellCopiedAnnouncement: 'Skopiowano komórkę',
    columnMovedAnnouncement: '{column} przeniesiono na pozycję {position} z {count}',
    groupedAnnouncement: 'Pogrupowano według {column}',
    ungroupedAnnouncement: 'Usunięto grupowanie według {column}',
    columnHeaderMenuLabel: 'Opcje kolumny {column}',
    groupColumn: 'Grupuj według tej kolumny',
    moveLeft: 'Przenieś w lewo',
    moveRight: 'Przenieś w prawo',
    autoSizeColumn: 'Dopasuj szerokość do zawartości',
    increaseColumnWidth: 'Zwiększ szerokość',
    decreaseColumnWidth: 'Zmniejsz szerokość',
    columnFiltered: 'Przefiltrowana',
    columnFixedStart: 'Przypięta na początku',
    columnFixedEnd: 'Przypięta na końcu',
    columnSortPriority: 'Sortowanie {order}, priorytet {priority}',
    sortedWithPriorityAnnouncement: 'Posortowano według {column}, {order}, priorytet {priority}',
    groupLevelChangedAnnouncement: '{column} przeniesiono na poziom grupowania {level} z {count}',
    groupingClearedAnnouncement: 'Usunięto grupowanie wszystkich kolumn',
    groupsExpandedAnnouncement: 'Rozwinięto wszystkie grupy',
    groupsCollapsedAnnouncement: 'Zwinięto wszystkie grupy',
    columnResizedAnnouncement: 'Szerokość {column}: {width} px',
    resizeHandleLabel: 'Zmień szerokość {column}',
    groupPanelLabel: 'Grupowanie',
    filterOperationButtonLabel: 'Operacja filtra dla {column}: {operation}',
    searchPanelLabel: 'Szukaj w siatce',
    headerFilterSearchLabel: 'Szukaj wartości',
    fixStartLabel: 'Przypnij {column} na początku',
    fixEndLabel: 'Przypnij {column} na końcu',
    headerFilterTruncated: 'Wyświetlono {shown} z {count}',
    headerFilterSearchAnnouncement: 'Wartości: {count}',
    selectAllResults: 'Zaznacz wszystkie wyniki ({count})',
  },
  tr: {
    noData: 'Veri yok',
    dragToGroup: 'Gruplamak için bir sütun başlığını buraya sürükleyin veya bir başlıkta Ctrl+G tuşlarına basın',
    groupLabelSeparator: ': ',
    sortAscending: 'artan',
    sortDescending: 'azalan',
    sortClearedAnnouncement: '{column} sıralaması kaldırıldı',
    sortedAnnouncement: '{column} sütununa göre sıralandı, {order}',
    trueText: 'Doğru',
    falseText: 'Yanlış',
    columnChooser: 'Sütun seçici',
    hideColumn: 'Sütunu gizle',
    showColumn: 'Sütunu göster',
    fixStart: 'Başa sabitle',
    fixEnd: 'Sona sabitle',
    unfix: 'Sabitlemeyi kaldır',
    autoSize: 'İçeriğe sığdırmak için çift tıklayın veya Enter tuşuna basın',
    summarySum: 'Toplam',
    summaryMin: 'En küçük',
    summaryMax: 'En büyük',
    summaryAvg: 'Ortalama',
    summaryCount: 'Sayı',
    summaryText: '{type}: {value}',
    summaryColumnText: '{column} {type}: {value}',
    groupInfoText: '({info})',
    ungroupColumn: 'Gruplamayı kaldır',
    ungroupAll: 'Tüm gruplamaları kaldır',
    expandAllGroups: 'Tüm grupları genişlet',
    collapseAllGroups: 'Tüm grupları daralt',
    groupPanelMenu: 'Grup seçenekleri',
    filterEquals: 'Eşittir',
    filterNotEquals: 'Eşit değildir',
    filterLessThan: 'Küçüktür',
    filterLessThanOrEqual: 'Küçük veya eşittir',
    filterGreaterThan: 'Büyüktür',
    filterGreaterThanOrEqual: 'Büyük veya eşittir',
    filterContains: 'İçerir',
    filterNotContains: 'İçermez',
    filterStartsWith: 'İle başlar',
    filterEndsWith: 'İle biter',
    filterBetween: 'Arasında',
    filterAnyOf: 'Şunlardan biri',
    filterNoneOf: 'Şunların hiçbiri',
    filterIsBlank: 'Boş',
    filterIsNotBlank: 'Boş değil',
    filterReset: 'Sıfırla',
    filterEditorLabel: '{column} filtrele',
    filterOperationLabel: 'Filtre işlemi',
    headerFilterLabel: '{column} filtre seçenekleri',
    filterBetweenStart: 'Başlangıç',
    filterBetweenEnd: 'Bitiş',
    filterAll: '(Tümü)',
    filterBlanks: '(Boş)',
    filterClear: 'Filtreyi temizle',
    searchPlaceholder: 'Ara…',
    selectAll: 'Tümünü seç',
    ok: 'Tamam',
    cancel: 'İptal',
    filteredAnnouncement: 'Satır: {count}',
    selectRow: 'Satırı seç',
    selectAllRows: 'Tüm satırları seç',
    rowsSelectedAnnouncement: 'Seçili satır: {count}',
    rowsCopiedAnnouncement: 'Kopyalanan satır: {count}',
    cellCopiedAnnouncement: 'Hücre kopyalandı',
    columnMovedAnnouncement: '{column} {count} içinde {position}. konuma taşındı',
    groupedAnnouncement: '{column} ile gruplandı',
    ungroupedAnnouncement: '{column} gruplaması kaldırıldı',
    columnHeaderMenuLabel: '{column} seçenekleri',
    groupColumn: 'Bu sütuna göre grupla',
    moveLeft: 'Sola taşı',
    moveRight: 'Sağa taşı',
    autoSizeColumn: 'Genişliği içeriğe sığdır',
    increaseColumnWidth: 'Genişliği artır',
    decreaseColumnWidth: 'Genişliği azalt',
    columnFiltered: 'Filtrelendi',
    columnFixedStart: 'Başa sabitlendi',
    columnFixedEnd: 'Sona sabitlendi',
    columnSortPriority: 'Sıralama {order}, öncelik {priority}',
    sortedWithPriorityAnnouncement: '{column} sütununa göre sıralandı, {order}, öncelik {priority}',
    groupLevelChangedAnnouncement: '{column} gruplama düzeyi {level}/{count} konumuna taşındı',
    groupingClearedAnnouncement: 'Tüm sütunların gruplaması kaldırıldı',
    groupsExpandedAnnouncement: 'Tüm gruplar genişletildi',
    groupsCollapsedAnnouncement: 'Tüm gruplar daraltıldı',
    columnResizedAnnouncement: '{column} genişliği: {width} px',
    resizeHandleLabel: '{column} genişliğini değiştir',
    groupPanelLabel: 'Gruplama',
    filterOperationButtonLabel: '{column} için filtre işlemi: {operation}',
    searchPanelLabel: 'Tabloda ara',
    headerFilterSearchLabel: 'Değerlerde ara',
    fixStartLabel: '{column} sütununu başa sabitle',
    fixEndLabel: '{column} sütununu sona sabitle',
    headerFilterTruncated: '{count} değerden {shown} tanesi gösteriliyor',
    headerFilterSearchAnnouncement: 'Değerler: {count}',
    selectAllResults: 'Tüm sonuçları seç ({count})',
  },
  ja: {
    noData: 'データがありません',
    dragToGroup: '列ヘッダーをここにドラッグするか、ヘッダーで Ctrl+G を押してグループ化します',
    groupLabelSeparator: '：',
    sortAscending: '昇順',
    sortDescending: '降順',
    sortClearedAnnouncement: '{column} の並べ替えを解除しました',
    sortedAnnouncement: '{column} で並べ替えました（{order}）',
    trueText: '真',
    falseText: '偽',
    columnChooser: '列の選択',
    hideColumn: '列を非表示',
    showColumn: '列を表示',
    fixStart: '先頭に固定',
    fixEnd: '末尾に固定',
    unfix: '固定を解除',
    autoSize: 'ダブルクリックまたは Enter で幅を自動調整',
    summarySum: '合計',
    summaryMin: '最小',
    summaryMax: '最大',
    summaryAvg: '平均',
    summaryCount: '件数',
    summaryText: '{type}: {value}',
    summaryColumnText: '{column}の{type}: {value}',
    groupInfoText: '（{info}）',
    ungroupColumn: 'グループ解除',
    ungroupAll: 'すべてのグループ解除',
    expandAllGroups: 'すべてのグループを展開',
    collapseAllGroups: 'すべてのグループを折りたたむ',
    groupPanelMenu: 'グループのオプション',
    filterEquals: '等しい',
    filterNotEquals: '等しくない',
    filterLessThan: 'より小さい',
    filterLessThanOrEqual: '以下',
    filterGreaterThan: 'より大きい',
    filterGreaterThanOrEqual: '以上',
    filterContains: '含む',
    filterNotContains: '含まない',
    filterStartsWith: 'で始まる',
    filterEndsWith: 'で終わる',
    filterBetween: '範囲内',
    filterAnyOf: 'いずれかに一致',
    filterNoneOf: 'いずれにも一致しない',
    filterIsBlank: '空白',
    filterIsNotBlank: '空白ではない',
    filterReset: 'リセット',
    filterEditorLabel: '{column} をフィルター',
    filterOperationLabel: 'フィルター演算子',
    headerFilterLabel: '{column} のフィルターオプション',
    filterBetweenStart: '開始',
    filterBetweenEnd: '終了',
    filterAll: '(すべて)',
    filterBlanks: '(空白)',
    filterClear: 'フィルターをクリア',
    searchPlaceholder: '検索…',
    selectAll: 'すべて選択',
    ok: 'OK',
    cancel: 'キャンセル',
    filteredAnnouncement: '行数: {count}',
    selectRow: '行を選択',
    selectAllRows: 'すべての行を選択',
    rowsSelectedAnnouncement: '選択した行: {count}',
    rowsCopiedAnnouncement: 'コピーした行: {count}',
    cellCopiedAnnouncement: 'セルをコピーしました',
    columnMovedAnnouncement: '{column} を {count} 列中 {position} 番目に移動しました',
    groupedAnnouncement: '{column} でグループ化しました',
    ungroupedAnnouncement: '{column} のグループ化を解除しました',
    columnHeaderMenuLabel: '{column} のオプション',
    groupColumn: 'この列でグループ化',
    moveLeft: '左へ移動',
    moveRight: '右へ移動',
    autoSizeColumn: '幅を内容に合わせる',
    increaseColumnWidth: '幅を広げる',
    decreaseColumnWidth: '幅を狭める',
    columnFiltered: 'フィルター適用中',
    columnFixedStart: '先頭に固定済み',
    columnFixedEnd: '末尾に固定済み',
    columnSortPriority: '並べ替え: {order}、優先度 {priority}',
    sortedWithPriorityAnnouncement: '{column} で並べ替えました（{order}、優先度 {priority}）',
    groupLevelChangedAnnouncement: '{column} をグループ化レベル {count} 中 {level} に移動しました',
    groupingClearedAnnouncement: 'すべての列のグループ化を解除しました',
    groupsExpandedAnnouncement: 'すべてのグループを展開しました',
    groupsCollapsedAnnouncement: 'すべてのグループを折りたたみました',
    columnResizedAnnouncement: '{column} の幅: {width} px',
    resizeHandleLabel: '{column} の幅を変更',
    groupPanelLabel: 'グループ化',
    filterOperationButtonLabel: '{column} のフィルター演算: {operation}',
    searchPanelLabel: 'グリッド内を検索',
    headerFilterSearchLabel: '値を検索',
    fixStartLabel: '{column} を先頭に固定',
    fixEndLabel: '{column} を末尾に固定',
    headerFilterTruncated: '{count} 件中 {shown} 件を表示',
    headerFilterSearchAnnouncement: '値: {count}',
    selectAllResults: '検索結果をすべて選択 ({count})',
  },
  ko: {
    noData: '데이터 없음',
    dragToGroup: '열 머리글을 여기로 끌거나 머리글에서 Ctrl+G를 눌러 그룹화하세요',
    groupLabelSeparator: ': ',
    sortAscending: '오름차순',
    sortDescending: '내림차순',
    sortClearedAnnouncement: '{column} 정렬을 해제했습니다',
    sortedAnnouncement: '{column} 기준 {order} 정렬됨',
    trueText: '참',
    falseText: '거짓',
    columnChooser: '열 선택기',
    hideColumn: '열 숨기기',
    showColumn: '열 표시',
    fixStart: '시작 부분에 고정',
    fixEnd: '끝 부분에 고정',
    unfix: '고정 해제',
    autoSize: '두 번 클릭하거나 Enter를 눌러 너비 자동 맞춤',
    summarySum: '합계',
    summaryMin: '최소',
    summaryMax: '최대',
    summaryAvg: '평균',
    summaryCount: '개수',
    summaryText: '{type}: {value}',
    summaryColumnText: '{column} {type}: {value}',
    groupInfoText: '({info})',
    ungroupColumn: '그룹 해제',
    ungroupAll: '모든 그룹 해제',
    expandAllGroups: '모든 그룹 펼치기',
    collapseAllGroups: '모든 그룹 접기',
    groupPanelMenu: '그룹 옵션',
    filterEquals: '같음',
    filterNotEquals: '같지 않음',
    filterLessThan: '보다 작음',
    filterLessThanOrEqual: '작거나 같음',
    filterGreaterThan: '보다 큼',
    filterGreaterThanOrEqual: '크거나 같음',
    filterContains: '포함',
    filterNotContains: '포함하지 않음',
    filterStartsWith: '시작 문자',
    filterEndsWith: '끝 문자',
    filterBetween: '범위',
    filterAnyOf: '다음 중 하나',
    filterNoneOf: '다음 중 어느 것도 아님',
    filterIsBlank: '비어 있음',
    filterIsNotBlank: '비어 있지 않음',
    filterReset: '초기화',
    filterEditorLabel: '{column} 필터',
    filterOperationLabel: '필터 연산',
    headerFilterLabel: '{column} 필터 옵션',
    filterBetweenStart: '시작',
    filterBetweenEnd: '끝',
    filterAll: '(전체)',
    filterBlanks: '(빈 값)',
    filterClear: '필터 지우기',
    searchPlaceholder: '검색…',
    selectAll: '모두 선택',
    ok: '확인',
    cancel: '취소',
    filteredAnnouncement: '행: {count}',
    selectRow: '행 선택',
    selectAllRows: '모든 행 선택',
    rowsSelectedAnnouncement: '선택한 행: {count}',
    rowsCopiedAnnouncement: '복사한 행: {count}',
    cellCopiedAnnouncement: '셀을 복사했습니다',
    columnMovedAnnouncement: '{column}을(를) {count}개 중 {position}번째로 이동했습니다',
    groupedAnnouncement: '{column}(으)로 그룹화했습니다',
    ungroupedAnnouncement: '{column} 그룹화를 해제했습니다',
    columnHeaderMenuLabel: '{column} 옵션',
    groupColumn: '이 열로 그룹화',
    moveLeft: '왼쪽으로 이동',
    moveRight: '오른쪽으로 이동',
    autoSizeColumn: '내용에 맞게 너비 조정',
    increaseColumnWidth: '너비 늘리기',
    decreaseColumnWidth: '너비 줄이기',
    columnFiltered: '필터 적용됨',
    columnFixedStart: '시작 부분에 고정됨',
    columnFixedEnd: '끝 부분에 고정됨',
    columnSortPriority: '정렬: {order}, 우선순위 {priority}',
    sortedWithPriorityAnnouncement: '{column} 기준 {order} 정렬됨, 우선순위 {priority}',
    groupLevelChangedAnnouncement: '{column}을(를) 그룹화 수준 {count}개 중 {level}(으)로 이동했습니다',
    groupingClearedAnnouncement: '모든 열의 그룹화를 해제했습니다',
    groupsExpandedAnnouncement: '모든 그룹을 펼쳤습니다',
    groupsCollapsedAnnouncement: '모든 그룹을 접었습니다',
    columnResizedAnnouncement: '{column} 너비: {width} px',
    resizeHandleLabel: '{column} 너비 조정',
    groupPanelLabel: '그룹화',
    filterOperationButtonLabel: '{column} 필터 연산: {operation}',
    searchPanelLabel: '그리드에서 검색',
    headerFilterSearchLabel: '값 검색',
    fixStartLabel: '{column}을(를) 시작 부분에 고정',
    fixEndLabel: '{column}을(를) 끝 부분에 고정',
    headerFilterTruncated: '{count}개 중 {shown}개 표시',
    headerFilterSearchAnnouncement: '값: {count}',
    selectAllResults: '검색 결과 모두 선택 ({count})',
  },
  zh: {
    noData: '无数据',
    dragToGroup: '将列标题拖到此处，或在列标题上按 Ctrl+G 进行分组',
    groupLabelSeparator: '：',
    sortAscending: '升序',
    sortDescending: '降序',
    sortClearedAnnouncement: '已取消按 {column} 排序',
    sortedAnnouncement: '已按 {column} {order}排序',
    trueText: '是',
    falseText: '否',
    columnChooser: '列选择器',
    hideColumn: '隐藏列',
    showColumn: '显示列',
    fixStart: '固定到开头',
    fixEnd: '固定到末尾',
    unfix: '取消固定',
    autoSize: '双击或按 Enter 自动调整宽度',
    summarySum: '合计',
    summaryMin: '最小值',
    summaryMax: '最大值',
    summaryAvg: '平均值',
    summaryCount: '计数',
    summaryText: '{type}：{value}',
    summaryColumnText: '{column}{type}：{value}',
    groupInfoText: '（{info}）',
    ungroupColumn: '取消分组',
    ungroupAll: '全部取消分组',
    expandAllGroups: '展开所有分组',
    collapseAllGroups: '折叠所有分组',
    groupPanelMenu: '分组选项',
    filterEquals: '等于',
    filterNotEquals: '不等于',
    filterLessThan: '小于',
    filterLessThanOrEqual: '小于或等于',
    filterGreaterThan: '大于',
    filterGreaterThanOrEqual: '大于或等于',
    filterContains: '包含',
    filterNotContains: '不包含',
    filterStartsWith: '开头是',
    filterEndsWith: '结尾是',
    filterBetween: '介于',
    filterAnyOf: '是其中之一',
    filterNoneOf: '不是其中任何一个',
    filterIsBlank: '为空',
    filterIsNotBlank: '不为空',
    filterReset: '重置',
    filterEditorLabel: '筛选 {column}',
    filterOperationLabel: '筛选运算',
    headerFilterLabel: '{column} 的筛选选项',
    filterBetweenStart: '从',
    filterBetweenEnd: '到',
    filterAll: '(全部)',
    filterBlanks: '(空白)',
    filterClear: '清除筛选',
    searchPlaceholder: '搜索…',
    selectAll: '全选',
    ok: '确定',
    cancel: '取消',
    filteredAnnouncement: '行数：{count}',
    selectRow: '选择行',
    selectAllRows: '选择所有行',
    rowsSelectedAnnouncement: '已选择行数：{count}',
    rowsCopiedAnnouncement: '已复制行数：{count}',
    cellCopiedAnnouncement: '已复制单元格',
    columnMovedAnnouncement: '已将 {column} 移到第 {position} 位（共 {count} 位）',
    groupedAnnouncement: '已按 {column} 分组',
    ungroupedAnnouncement: '已取消按 {column} 分组',
    columnHeaderMenuLabel: '{column} 选项',
    groupColumn: '按此列分组',
    moveLeft: '左移',
    moveRight: '右移',
    autoSizeColumn: '自动调整列宽',
    increaseColumnWidth: '增加宽度',
    decreaseColumnWidth: '减小宽度',
    columnFiltered: '已筛选',
    columnFixedStart: '已固定到开头',
    columnFixedEnd: '已固定到末尾',
    columnSortPriority: '排序：{order}，优先级 {priority}',
    sortedWithPriorityAnnouncement: '已按 {column} {order}排序，优先级 {priority}',
    groupLevelChangedAnnouncement: '已将 {column} 移到分组级别 {level}（共 {count} 级）',
    groupingClearedAnnouncement: '已取消所有列的分组',
    groupsExpandedAnnouncement: '已展开所有分组',
    groupsCollapsedAnnouncement: '已折叠所有分组',
    columnResizedAnnouncement: '{column} 宽度：{width} px',
    resizeHandleLabel: '调整 {column} 的宽度',
    groupPanelLabel: '分组',
    filterOperationButtonLabel: '{column} 的筛选运算：{operation}',
    searchPanelLabel: '在表格中搜索',
    headerFilterSearchLabel: '搜索值',
    fixStartLabel: '将 {column} 固定到开头',
    fixEndLabel: '将 {column} 固定到末尾',
    headerFilterTruncated: '显示 {count} 项中的 {shown} 项',
    headerFilterSearchAnnouncement: '值：{count}',
    selectAllResults: '全选搜索结果（{count}）',
  },
  ar: {
    noData: 'لا توجد بيانات',
    dragToGroup: 'اسحب عنوان عمود إلى هنا، أو اضغط Ctrl+G على عنوان، للتجميع حسبه',
    groupLabelSeparator: ': ',
    sortAscending: 'تصاعدي',
    sortDescending: 'تنازلي',
    sortClearedAnnouncement: 'تمت إزالة الفرز حسب {column}',
    sortedAnnouncement: 'تم الفرز حسب {column}، {order}',
    trueText: 'صحيح',
    falseText: 'خطأ',
    columnChooser: 'منتقي الأعمدة',
    hideColumn: 'إخفاء العمود',
    showColumn: 'إظهار العمود',
    fixStart: 'تثبيت في البداية',
    fixEnd: 'تثبيت في النهاية',
    unfix: 'إلغاء التثبيت',
    autoSize: 'انقر نقرًا مزدوجًا أو اضغط Enter لملاءمة العرض',
    summarySum: 'المجموع',
    summaryMin: 'الحد الأدنى',
    summaryMax: 'الحد الأقصى',
    summaryAvg: 'المتوسط',
    summaryCount: 'العدد',
    summaryText: '{type}: {value}',
    summaryColumnText: '{type} {column}: {value}',
    groupInfoText: '({info})',
    ungroupColumn: 'إلغاء التجميع',
    ungroupAll: 'إلغاء كل التجميعات',
    expandAllGroups: 'توسيع كل المجموعات',
    collapseAllGroups: 'طي كل المجموعات',
    groupPanelMenu: 'خيارات التجميع',
    filterEquals: 'يساوي',
    filterNotEquals: 'لا يساوي',
    filterLessThan: 'أصغر من',
    filterLessThanOrEqual: 'أصغر من أو يساوي',
    filterGreaterThan: 'أكبر من',
    filterGreaterThanOrEqual: 'أكبر من أو يساوي',
    filterContains: 'يحتوي على',
    filterNotContains: 'لا يحتوي على',
    filterStartsWith: 'يبدأ بـ',
    filterEndsWith: 'ينتهي بـ',
    filterBetween: 'بين',
    filterAnyOf: 'أحد القيم',
    filterNoneOf: 'ليس أيًا من القيم',
    filterIsBlank: 'فارغ',
    filterIsNotBlank: 'غير فارغ',
    filterReset: 'إعادة تعيين',
    filterEditorLabel: 'تصفية {column}',
    filterOperationLabel: 'عملية التصفية',
    headerFilterLabel: 'خيارات التصفية لـ {column}',
    filterBetweenStart: 'من',
    filterBetweenEnd: 'إلى',
    filterAll: '(الكل)',
    filterBlanks: '(فارغ)',
    filterClear: 'مسح عامل التصفية',
    searchPlaceholder: 'بحث…',
    selectAll: 'تحديد الكل',
    ok: 'موافق',
    cancel: 'إلغاء',
    filteredAnnouncement: 'الصفوف: {count}',
    selectRow: 'تحديد الصف',
    selectAllRows: 'تحديد كل الصفوف',
    rowsSelectedAnnouncement: 'الصفوف المحددة: {count}',
    rowsCopiedAnnouncement: 'الصفوف المنسوخة: {count}',
    cellCopiedAnnouncement: 'تم نسخ الخلية',
    columnMovedAnnouncement: 'تم نقل {column} إلى الموضع {position} من {count}',
    groupedAnnouncement: 'تم التجميع حسب {column}',
    ungroupedAnnouncement: 'تم إلغاء التجميع حسب {column}',
    columnHeaderMenuLabel: 'خيارات {column}',
    groupColumn: 'التجميع حسب هذا العمود',
    moveLeft: 'نقل لليسار',
    moveRight: 'نقل لليمين',
    autoSizeColumn: 'ملاءمة العرض مع المحتوى',
    increaseColumnWidth: 'زيادة العرض',
    decreaseColumnWidth: 'تقليل العرض',
    columnFiltered: 'مُصفّى',
    columnFixedStart: 'مثبّت في البداية',
    columnFixedEnd: 'مثبّت في النهاية',
    columnSortPriority: 'الفرز {order}، الأولوية {priority}',
    sortedWithPriorityAnnouncement: 'تم الفرز حسب {column}، {order}، الأولوية {priority}',
    groupLevelChangedAnnouncement: 'تم نقل {column} إلى مستوى التجميع {level} من {count}',
    groupingClearedAnnouncement: 'تم إلغاء تجميع كل الأعمدة',
    groupsExpandedAnnouncement: 'تم توسيع كل المجموعات',
    groupsCollapsedAnnouncement: 'تم طي كل المجموعات',
    columnResizedAnnouncement: 'عرض {column}: {width} px',
    resizeHandleLabel: 'تغيير عرض {column}',
    groupPanelLabel: 'التجميع',
    filterOperationButtonLabel: 'عملية التصفية لـ {column}: {operation}',
    searchPanelLabel: 'البحث في الجدول',
    headerFilterSearchLabel: 'البحث في القيم',
    fixStartLabel: 'تثبيت {column} في البداية',
    fixEndLabel: 'تثبيت {column} في النهاية',
    headerFilterTruncated: 'عرض {shown} من {count}',
    headerFilterSearchAnnouncement: 'القيم: {count}',
    selectAllResults: 'تحديد كل النتائج ({count})',
  },
});

/**
 * Lit context carrying the default language for every grid in the subtree.
 * Uses a shared symbol so duplicate module copies resolve to the same context.
 */
export const gridLanguageContext = createContext<string | undefined>(Symbol.for('u-grid-language'));

const findTranslation = (language: string | undefined): GridI18n | undefined => {

  if (!language || typeof language !== 'string') {
    return undefined;
  }

  const normalized = language.toLowerCase();

  return gridTranslations[normalized] ?? gridTranslations[normalized.split('-')[0]];
};

/**
 * Resolves the translation for a language code, falling back to the base
 * language and finally to {@link DEFAULT_GRID_LANGUAGE}.
 * @internal
 */
export const resolveGridTranslation = (language?: string): GridI18n =>
  findTranslation(language) ?? gridTranslations[DEFAULT_GRID_LANGUAGE];

/**
 * Overrides part (or all) of a built-in translation. Missing keys keep their
 * previous value, so a partial object is enough. The deprecated key names
 * (`clearSorting`, `pinStart`, `pinEnd`, `unpin`) are still accepted, with a
 * console warning.
 */
export const setGridTranslation = (language: string, translation: GridI18nInput): void => {

  const key = language.toLowerCase();
  const base = gridTranslations[key] ?? findTranslation(language) ?? gridTranslations[DEFAULT_GRID_LANGUAGE];

  gridTranslations[key] = { ...base, ...normalizeTranslation(translation) };
};

/**
 * Pedidos de context de idioma que ainda não têm provedor. Faz o papel do
 * `ContextRoot` do @lit/context — sem ele, {@link setGridLanguage} chamado
 * depois de o grid conectar nunca chegaria a esse grid — mas sem o
 * vazamento dele: o `ContextRoot` empilha cada pedido sem provedor (um
 * objeto e dois `WeakRef`s por grid conectado) e só esvazia quando aparece
 * um provedor; numa página que cria e destrói grids sem `setGridLanguage`,
 * cresce para sempre. Aqui só entra o context do grid, e pedidos de
 * elementos coletados ou desconectados são descartados (o grid pede de novo
 * ao reconectar). Spec 14.
 */
class PendingLanguageRequests {
  #requests: { element: WeakRef<Element>; callback: WeakRef<ContextCallback<unknown>> }[] = [];
  #callbacks = new WeakSet<ContextCallback<unknown>>();
  #pruneAt = PRUNE_MIN;

  get size(): number {
    return this.#requests.length;
  }

  readonly onRequest = (event: ContextEvent<Context<unknown, unknown>>): void => {
    if (event.context !== gridLanguageContext || event.subscribe !== true || this.#callbacks.has(event.callback)) {
      return;
    }

    const element = event.contextTarget ?? event.composedPath()[0] as Element;

    this.#callbacks.add(event.callback);
    this.#requests.push({ element: new WeakRef(element), callback: new WeakRef(event.callback) });

    if (this.#requests.length >= this.#pruneAt) {
      this.#prune();
      this.#pruneAt = Math.max(PRUNE_MIN, this.#requests.length * 2);
    }
  };

  readonly onProvider = (event: Event): void => {
    if ((event as Event & { context?: unknown }).context !== gridLanguageContext) {
      return;
    }

    // Os que continuarem sem provedor voltam para a lista ao redespachar.
    const requests = this.#requests;
    this.#requests = [];
    this.#callbacks = new WeakSet();
    this.#pruneAt = PRUNE_MIN;

    for (const request of requests) {
      const element = request.element.deref();
      const callback = request.callback.deref();

      if (element?.isConnected && callback) {
        element.dispatchEvent(new ContextEvent(gridLanguageContext, element, callback, true));
      }
    }
  };

  #prune(): void {
    this.#requests = this.#requests.filter(request => {
      const callback = request.callback.deref();
      const keep = !!callback && !!request.element.deref()?.isConnected;

      if (!keep && callback) {
        this.#callbacks.delete(callback);
      }

      return keep;
    });
  }
}

/** Abaixo disso não vale limpar a lista. */
const PRUNE_MIN = 16;

const PENDING_REQUESTS = Symbol.for('u-grid-pending-language-requests');

type WindowWithRequests = Record<symbol, PendingLanguageRequests | undefined>;

// Uma só vez por página, mesmo com duas cópias do pacote carregadas (o
// context usa `Symbol.for`, então uma lista serve às duas).
if (typeof document !== 'undefined' && !(window as unknown as WindowWithRequests)[PENDING_REQUESTS]) {

  const pending = new PendingLanguageRequests();
  (window as unknown as WindowWithRequests)[PENDING_REQUESTS] = pending;

  const attach = (): void => {
    document.body.addEventListener('context-request', pending.onRequest);
    document.body.addEventListener('context-provider', pending.onProvider);
  };

  if (document.body) {
    attach();
  } else {
    document.addEventListener('DOMContentLoaded', attach, { once: true });
  }
}

/**
 * Quantos pedidos de idioma esperam provedor (diagnóstico/testes, spec 14).
 * @internal
 */
export const _pendingLanguageRequests = (): number =>
  typeof window === 'undefined' ? 0 : (window as unknown as WindowWithRequests)[PENDING_REQUESTS]?.size ?? 0;

const languageProviders = new WeakMap<HTMLElement, ContextProvider<typeof gridLanguageContext>>();

/**
 * Provides a default language through Lit context on `host` (the document body
 * by default). Every grid without an explicit `language` inherits this value.
 */
export const setGridLanguage = (language: string, host: HTMLElement = document.body): void => {

  const existing = languageProviders.get(host);

  if (existing) {
    existing.setValue(language);
    return;
  }

  const provider = new ContextProvider(host, { context: gridLanguageContext, initialValue: language });

  provider.hostConnected();
  languageProviders.set(host, provider);
};

const documentLanguageListeners = new Set<() => void>();
let documentLanguageObserver: MutationObserver | undefined;

/**
 * Avisa quando o `lang` do `<html>` muda. Um único `MutationObserver` serve a
 * todos os grids da página. Devolve a função que cancela a inscrição.
 * @internal
 */
export const observeDocumentLanguage = (listener: () => void): () => void => {

  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
    return () => undefined;
  }

  documentLanguageListeners.add(listener);

  if (!documentLanguageObserver) {
    documentLanguageObserver = new MutationObserver(() => {
      for (const notify of documentLanguageListeners) {
        notify();
      }
    });

    documentLanguageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }

  return () => {
    documentLanguageListeners.delete(listener);

    if (!documentLanguageListeners.size) {
      documentLanguageObserver?.disconnect();
      documentLanguageObserver = undefined;
    }
  };
};
