import { ContextProvider, ContextRoot, createContext } from '@lit/context';

/**
 * Set of user facing strings rendered by the grid. Column labels are provided
 * by the consumer and are therefore not part of this contract.
 */
export interface GridI18n {
  noData: string;
  dragToGroup: string;
  groupLabelSeparator: string;
  /** Text of `true` in `boolean` columns (cells and group rows). */
  trueText: string;
  /** Text of `false` in `boolean` columns (cells and group rows). */
  falseText: string;
}

export const DEFAULT_GRID_LANGUAGE = 'en';

/**
 * Built-in translations keyed by lowercase language code. Region specific
 * entries (e.g. `pt-br`) can be added through {@link setGridTranslation} and
 * take precedence over their base language.
 *
 * Objeto sem protótipo: `language="constructor"` ou
 * `setGridTranslation('__proto__', …)` não alcançam `Object.prototype`.
 */
export const gridTranslations: Record<string, GridI18n> = Object.assign(Object.create(null) as Record<string, GridI18n>, {
  en: { noData: 'No data', dragToGroup: 'Drag a column header here to group by it', groupLabelSeparator: ': ', trueText: 'True', falseText: 'False' },
  es: { noData: 'Sin datos', dragToGroup: 'Arrastre el encabezado de una columna aquí para agrupar', groupLabelSeparator: ': ', trueText: 'Verdadero', falseText: 'Falso' },
  pt: { noData: 'Sem dados', dragToGroup: 'Arraste o cabeçalho de uma coluna aqui para agrupar', groupLabelSeparator: ': ', trueText: 'Verdadeiro', falseText: 'Falso' },
  fr: { noData: 'Aucune donnée', dragToGroup: 'Faites glisser l’en-tête d’une colonne ici pour la regrouper', groupLabelSeparator: ' : ', trueText: 'Vrai', falseText: 'Faux' },
  de: { noData: 'Keine Daten', dragToGroup: 'Ziehen Sie eine Spaltenüberschrift hierher, um danach zu gruppieren', groupLabelSeparator: ': ', trueText: 'Wahr', falseText: 'Falsch' },
  it: { noData: 'Nessun dato', dragToGroup: 'Trascina qui l’intestazione di una colonna per raggrupparla', groupLabelSeparator: ': ', trueText: 'Vero', falseText: 'Falso' },
  nl: { noData: 'Geen gegevens', dragToGroup: 'Sleep een kolomkop hierheen om erop te groeperen', groupLabelSeparator: ': ', trueText: 'Waar', falseText: 'Onwaar' },
  ru: { noData: 'Нет данных', dragToGroup: 'Перетащите сюда заголовок столбца для группировки', groupLabelSeparator: ': ', trueText: 'Истина', falseText: 'Ложь' },
  pl: { noData: 'Brak danych', dragToGroup: 'Przeciągnij tutaj nagłówek kolumny, aby pogrupować', groupLabelSeparator: ': ', trueText: 'Prawda', falseText: 'Fałsz' },
  tr: { noData: 'Veri yok', dragToGroup: 'Gruplamak için bir sütun başlığını buraya sürükleyin', groupLabelSeparator: ': ', trueText: 'Doğru', falseText: 'Yanlış' },
  ja: { noData: 'データがありません', dragToGroup: '列ヘッダーをここにドラッグしてグループ化します', groupLabelSeparator: '：', trueText: '真', falseText: '偽' },
  ko: { noData: '데이터 없음', dragToGroup: '열 머리글을 여기로 끌어 그룹화하세요', groupLabelSeparator: ': ', trueText: '참', falseText: '거짓' },
  zh: { noData: '无数据', dragToGroup: '将列标题拖到此处进行分组', groupLabelSeparator: '：', trueText: '是', falseText: '否' },
  ar: { noData: 'لا توجد بيانات', dragToGroup: 'اسحب عنوان عمود إلى هنا للتجميع حسبه', groupLabelSeparator: ': ', trueText: 'صحيح', falseText: 'خطأ' },
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

/*
 * ContextRoot buffers unsatisfied context requests and re-dispatches them when
 * a matching provider shows up later. Without it, {@link setGridLanguage}
 * called after a grid is already connected would never reach that grid (its
 * context request bubbled before any provider existed). Attached once at
 * module load; guarded for SSR.
 */
const CONTEXT_ROOT_ATTACHED = Symbol.for('u-grid-context-root');

// Uma só vez por página, mesmo com duas cópias do pacote carregadas.
if (typeof document !== 'undefined' && !(window as unknown as Record<symbol, unknown>)[CONTEXT_ROOT_ATTACHED]) {

  (window as unknown as Record<symbol, unknown>)[CONTEXT_ROOT_ATTACHED] = true;

  const attach = (): void => new ContextRoot().attach(document.body);

  if (document.body) {
    attach();
  } else {
    document.addEventListener('DOMContentLoaded', attach, { once: true });
  }
}

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
