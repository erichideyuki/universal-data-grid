import { type Context, type ContextCallback, ContextEvent, ContextProvider, createContext } from '@lit/context';

/**
 * Set of user facing strings rendered by the grid. Column labels are provided
 * by the consumer and are therefore not part of this contract.
 */
export interface GridI18n {
  /** Empty-state message. */
  noData: string;
  /** Hint in the group panel while nothing is grouped. */
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
  /** Chooser button that fixes a column at the start. */
  fixStart: string;
  /** Chooser button that fixes a column at the end. */
  fixEnd: string;
  /** Tooltip of a pressed fix button (removes the fixing). */
  unfix: string;
  /** Tooltip of the column resize handle (double-click auto-sizes). */
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
  /** Operation button of the filter row (followed by the current operation) and menu name. */
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
  /** Placeholder and accessible name of the search panel and of the header filter search. */
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
  /** Screen reader announcement after moving a column with the keyboard. `{column}`, `{position}`, `{count}`. */
  columnMovedAnnouncement: string;
  /** Screen reader announcement after grouping by a column (or changing its level) with the keyboard. `{column}`. */
  groupedAnnouncement: string;
  /** Screen reader announcement after ungrouping a column with the keyboard. `{column}`. */
  ungroupedAnnouncement: string;
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
    dragToGroup: 'Drag a column header here to group by it',
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
    autoSize: 'Double-click to auto-size',
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
    columnMovedAnnouncement: '{column} moved to position {position} of {count}',
    groupedAnnouncement: 'Grouped by {column}',
    ungroupedAnnouncement: 'Ungrouped {column}',
  },
  es: {
    noData: 'Sin datos',
    dragToGroup: 'Arrastre el encabezado de una columna aquí para agrupar',
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
    autoSize: 'Doble clic para ajustar al contenido',
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
    columnMovedAnnouncement: '{column} movida a la posición {position} de {count}',
    groupedAnnouncement: 'Agrupado por {column}',
    ungroupedAnnouncement: 'Se quitó la agrupación por {column}',
  },
  pt: {
    noData: 'Sem dados',
    dragToGroup: 'Arraste o cabeçalho de uma coluna aqui para agrupar',
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
    autoSize: 'Clique duplo para ajustar ao conteúdo',
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
    columnMovedAnnouncement: '{column} movida para a posição {position} de {count}',
    groupedAnnouncement: 'Agrupado por {column}',
    ungroupedAnnouncement: 'Agrupamento por {column} removido',
  },
  fr: {
    noData: 'Aucune donnée',
    dragToGroup: 'Faites glisser l’en-tête d’une colonne ici pour la regrouper',
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
    autoSize: 'Double-cliquez pour ajuster au contenu',
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
    columnMovedAnnouncement: '{column} déplacée en position {position} sur {count}',
    groupedAnnouncement: 'Groupé par {column}',
    ungroupedAnnouncement: 'Regroupement par {column} supprimé',
  },
  de: {
    noData: 'Keine Daten',
    dragToGroup: 'Ziehen Sie eine Spaltenüberschrift hierher, um danach zu gruppieren',
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
    autoSize: 'Doppelklicken, um die Breite anzupassen',
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
    columnMovedAnnouncement: '{column} an Position {position} von {count} verschoben',
    groupedAnnouncement: 'Gruppiert nach {column}',
    ungroupedAnnouncement: 'Gruppierung nach {column} aufgehoben',
  },
  it: {
    noData: 'Nessun dato',
    dragToGroup: 'Trascina qui l’intestazione di una colonna per raggrupparla',
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
    autoSize: 'Doppio clic per adattare al contenuto',
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
    columnMovedAnnouncement: '{column} spostata in posizione {position} di {count}',
    groupedAnnouncement: 'Raggruppato per {column}',
    ungroupedAnnouncement: 'Raggruppamento per {column} rimosso',
  },
  nl: {
    noData: 'Geen gegevens',
    dragToGroup: 'Sleep een kolomkop hierheen om erop te groeperen',
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
    autoSize: 'Dubbelklik om aan de inhoud aan te passen',
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
    columnMovedAnnouncement: '{column} verplaatst naar positie {position} van {count}',
    groupedAnnouncement: 'Gegroepeerd op {column}',
    ungroupedAnnouncement: 'Groepering op {column} verwijderd',
  },
  ru: {
    noData: 'Нет данных',
    dragToGroup: 'Перетащите сюда заголовок столбца для группировки',
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
    autoSize: 'Дважды щёлкните, чтобы подогнать ширину',
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
    columnMovedAnnouncement: 'Столбец {column} перемещён на позицию {position} из {count}',
    groupedAnnouncement: 'Сгруппировано по {column}',
    ungroupedAnnouncement: 'Группировка по {column} снята',
  },
  pl: {
    noData: 'Brak danych',
    dragToGroup: 'Przeciągnij tutaj nagłówek kolumny, aby pogrupować',
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
    autoSize: 'Kliknij dwukrotnie, aby dopasować szerokość',
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
    columnMovedAnnouncement: '{column} przeniesiono na pozycję {position} z {count}',
    groupedAnnouncement: 'Pogrupowano według {column}',
    ungroupedAnnouncement: 'Usunięto grupowanie według {column}',
  },
  tr: {
    noData: 'Veri yok',
    dragToGroup: 'Gruplamak için bir sütun başlığını buraya sürükleyin',
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
    autoSize: 'İçeriğe sığdırmak için çift tıklayın',
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
    columnMovedAnnouncement: '{column} {count} içinde {position}. konuma taşındı',
    groupedAnnouncement: '{column} ile gruplandı',
    ungroupedAnnouncement: '{column} gruplaması kaldırıldı',
  },
  ja: {
    noData: 'データがありません',
    dragToGroup: '列ヘッダーをここにドラッグしてグループ化します',
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
    autoSize: 'ダブルクリックで幅を自動調整',
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
    columnMovedAnnouncement: '{column} を {count} 列中 {position} 番目に移動しました',
    groupedAnnouncement: '{column} でグループ化しました',
    ungroupedAnnouncement: '{column} のグループ化を解除しました',
  },
  ko: {
    noData: '데이터 없음',
    dragToGroup: '열 머리글을 여기로 끌어 그룹화하세요',
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
    autoSize: '두 번 클릭하여 너비 자동 맞춤',
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
    columnMovedAnnouncement: '{column}을(를) {count}개 중 {position}번째로 이동했습니다',
    groupedAnnouncement: '{column}(으)로 그룹화했습니다',
    ungroupedAnnouncement: '{column} 그룹화를 해제했습니다',
  },
  zh: {
    noData: '无数据',
    dragToGroup: '将列标题拖到此处进行分组',
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
    autoSize: '双击自动调整宽度',
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
    columnMovedAnnouncement: '已将 {column} 移到第 {position} 位（共 {count} 位）',
    groupedAnnouncement: '已按 {column} 分组',
    ungroupedAnnouncement: '已取消按 {column} 分组',
  },
  ar: {
    noData: 'لا توجد بيانات',
    dragToGroup: 'اسحب عنوان عمود إلى هنا للتجميع حسبه',
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
    autoSize: 'انقر نقرًا مزدوجًا لملاءمة العرض',
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
    columnMovedAnnouncement: 'تم نقل {column} إلى الموضع {position} من {count}',
    groupedAnnouncement: 'تم التجميع حسب {column}',
    ungroupedAnnouncement: 'تم إلغاء التجميع حسب {column}',
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
