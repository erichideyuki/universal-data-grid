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
