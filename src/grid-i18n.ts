import { ContextProvider, createContext } from '@lit/context';

/**
 * Set of user facing strings rendered by the grid. Column labels are provided
 * by the consumer and are therefore not part of this contract.
 */
export interface GridI18n {
  noData: string;
  dragToGroup: string;
  groupLabelSeparator: string;
}

export const DEFAULT_GRID_LANGUAGE = 'en';

/**
 * Built-in translations keyed by lowercase language code. Region specific
 * entries (e.g. `pt-br`) can be added through {@link setGridTranslation} and
 * take precedence over their base language.
 */
export const gridTranslations: Record<string, GridI18n> = {
  en: { noData: 'No data', dragToGroup: 'Drag a column header here to group by it', groupLabelSeparator: ': ' },
  es: { noData: 'Sin datos', dragToGroup: 'Arrastre el encabezado de una columna aquí para agrupar', groupLabelSeparator: ': ' },
  pt: { noData: 'Sem dados', dragToGroup: 'Arraste o cabeçalho de uma coluna aqui para agrupar', groupLabelSeparator: ': ' },
  fr: { noData: 'Aucune donnée', dragToGroup: 'Faites glisser l’en-tête d’une colonne ici pour la regrouper', groupLabelSeparator: ' : ' },
  de: { noData: 'Keine Daten', dragToGroup: 'Ziehen Sie eine Spaltenüberschrift hierher, um danach zu gruppieren', groupLabelSeparator: ': ' },
  it: { noData: 'Nessun dato', dragToGroup: 'Trascina qui l’intestazione di una colonna per raggrupparla', groupLabelSeparator: ': ' },
  nl: { noData: 'Geen gegevens', dragToGroup: 'Sleep een kolomkop hierheen om erop te groeperen', groupLabelSeparator: ': ' },
  ru: { noData: 'Нет данных', dragToGroup: 'Перетащите сюда заголовок столбца для группировки', groupLabelSeparator: ': ' },
  pl: { noData: 'Brak danych', dragToGroup: 'Przeciągnij tutaj nagłówek kolumny, aby pogrupować', groupLabelSeparator: ': ' },
  tr: { noData: 'Veri yok', dragToGroup: 'Gruplamak için bir sütun başlığını buraya sürükleyin', groupLabelSeparator: ': ' },
  ja: { noData: 'データがありません', dragToGroup: '列ヘッダーをここにドラッグしてグループ化します', groupLabelSeparator: '：' },
  ko: { noData: '데이터 없음', dragToGroup: '열 머리글을 여기로 끌어 그룹화하세요', groupLabelSeparator: ': ' },
  zh: { noData: '无数据', dragToGroup: '将列标题拖到此处进行分组', groupLabelSeparator: '：' },
  ar: { noData: 'لا توجد بيانات', dragToGroup: 'اسحب عنوان عمود إلى هنا للتجميع حسبه', groupLabelSeparator: ': ' },
};

/**
 * Lit context carrying the default language for every grid in the subtree.
 * Uses a shared symbol so duplicate module copies resolve to the same context.
 */
export const gridLanguageContext = createContext<string | undefined>(Symbol.for('u-grid-language'));

const findTranslation = (language: string | undefined): GridI18n | undefined => {

  if (!language) {
    return undefined;
  }

  const normalized = language.toLowerCase();

  return gridTranslations[normalized] ?? gridTranslations[normalized.split('-')[0]];
};

/**
 * Resolves the translation for a language code, falling back to the base
 * language and finally to {@link DEFAULT_GRID_LANGUAGE}.
 */
export const resolveGridTranslation = (language?: string): GridI18n =>
  findTranslation(language) ?? gridTranslations[DEFAULT_GRID_LANGUAGE];

/**
 * Overrides part (or all) of a built-in translation. Missing keys keep their
 * previous value, so a partial object is enough.
 */
export const setGridTranslation = (language: string, translation: Partial<GridI18n>): void => {

  const key = language.toLowerCase();
  const base = gridTranslations[key] ?? findTranslation(language) ?? gridTranslations[DEFAULT_GRID_LANGUAGE];

  gridTranslations[key] = { ...base, ...translation };
};

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
