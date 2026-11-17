import { type Context, type ContextCallback, ContextEvent, ContextProvider, createContext } from '@lit/context';

/**
 * Set of user facing strings rendered by the grid. Column labels are provided
 * by the consumer and are therefore not part of this contract.
 */
export interface GridI18n {
  noData: string;
  dragToGroup: string;
  groupLabelSeparator: string;
  /** Ascending direction, used in `sortedAnnouncement` and in the group chip label. */
  sortAscending: string;
  /** Descending direction, used in `sortedAnnouncement` and in the group chip label. */
  sortDescending: string;
  /** Screen reader announcement after removing a column from the sorting. `{column}` = column label. */
  clearSorting: string;
  /** Screen reader announcement after sorting. `{column}` = column label, `{order}` = direction. */
  sortedAnnouncement: string;
  /** Text of `true` in `boolean` columns (cells and group rows). */
  trueText: string;
  /** Text of `false` in `boolean` columns (cells and group rows). */
  falseText: string;
  /** Botão e título do seletor de colunas. */
  columnChooser: string;
  /** Dica da caixa marcada (e do alvo de soltar no seletor). */
  hideColumn: string;
  /** Dica da caixa desmarcada. */
  showColumn: string;
  pinStart: string;
  pinEnd: string;
  unpin: string;
  /** Dica da alça de redimensionar (duplo clique = auto-ajuste). */
  autoSize: string;
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
  en: {
    noData: 'No data',
    dragToGroup: 'Drag a column header here to group by it',
    groupLabelSeparator: ': ',
    sortAscending: 'ascending',
    sortDescending: 'descending',
    clearSorting: 'Sorting removed from {column}',
    sortedAnnouncement: 'Sorted by {column}, {order}',
    trueText: 'True',
    falseText: 'False',
    columnChooser: 'Column chooser',
    hideColumn: 'Hide column',
    showColumn: 'Show column',
    pinStart: 'Pin to start',
    pinEnd: 'Pin to end',
    unpin: 'Unpin',
    autoSize: 'Double-click to auto-size',
  },
  es: {
    noData: 'Sin datos',
    dragToGroup: 'Arrastre el encabezado de una columna aquí para agrupar',
    groupLabelSeparator: ': ',
    sortAscending: 'ascendente',
    sortDescending: 'descendente',
    clearSorting: 'Se quitó el orden de {column}',
    sortedAnnouncement: 'Ordenado por {column}, {order}',
    trueText: 'Verdadero',
    falseText: 'Falso',
    columnChooser: 'Selector de columnas',
    hideColumn: 'Ocultar columna',
    showColumn: 'Mostrar columna',
    pinStart: 'Fijar al inicio',
    pinEnd: 'Fijar al final',
    unpin: 'Desfijar',
    autoSize: 'Doble clic para ajustar al contenido',
  },
  pt: {
    noData: 'Sem dados',
    dragToGroup: 'Arraste o cabeçalho de uma coluna aqui para agrupar',
    groupLabelSeparator: ': ',
    sortAscending: 'crescente',
    sortDescending: 'decrescente',
    clearSorting: 'Ordenação removida de {column}',
    sortedAnnouncement: 'Ordenado por {column}, {order}',
    trueText: 'Verdadeiro',
    falseText: 'Falso',
    columnChooser: 'Seletor de colunas',
    hideColumn: 'Ocultar coluna',
    showColumn: 'Mostrar coluna',
    pinStart: 'Fixar no início',
    pinEnd: 'Fixar no fim',
    unpin: 'Desafixar',
    autoSize: 'Clique duplo para ajustar ao conteúdo',
  },
  fr: {
    noData: 'Aucune donnée',
    dragToGroup: 'Faites glisser l’en-tête d’une colonne ici pour la regrouper',
    groupLabelSeparator: ' : ',
    sortAscending: 'croissant',
    sortDescending: 'décroissant',
    clearSorting: 'Tri retiré de {column}',
    sortedAnnouncement: 'Trié par {column}, {order}',
    trueText: 'Vrai',
    falseText: 'Faux',
    columnChooser: 'Sélecteur de colonnes',
    hideColumn: 'Masquer la colonne',
    showColumn: 'Afficher la colonne',
    pinStart: 'Épingler au début',
    pinEnd: 'Épingler à la fin',
    unpin: 'Désépingler',
    autoSize: 'Double-cliquez pour ajuster au contenu',
  },
  de: {
    noData: 'Keine Daten',
    dragToGroup: 'Ziehen Sie eine Spaltenüberschrift hierher, um danach zu gruppieren',
    groupLabelSeparator: ': ',
    sortAscending: 'aufsteigend',
    sortDescending: 'absteigend',
    clearSorting: 'Sortierung von {column} entfernt',
    sortedAnnouncement: 'Sortiert nach {column}, {order}',
    trueText: 'Wahr',
    falseText: 'Falsch',
    columnChooser: 'Spaltenauswahl',
    hideColumn: 'Spalte ausblenden',
    showColumn: 'Spalte einblenden',
    pinStart: 'Am Anfang fixieren',
    pinEnd: 'Am Ende fixieren',
    unpin: 'Fixierung aufheben',
    autoSize: 'Doppelklicken, um die Breite anzupassen',
  },
  it: {
    noData: 'Nessun dato',
    dragToGroup: 'Trascina qui l’intestazione di una colonna per raggrupparla',
    groupLabelSeparator: ': ',
    sortAscending: 'crescente',
    sortDescending: 'decrescente',
    clearSorting: 'Ordinamento rimosso da {column}',
    sortedAnnouncement: 'Ordinato per {column}, {order}',
    trueText: 'Vero',
    falseText: 'Falso',
    columnChooser: 'Selettore colonne',
    hideColumn: 'Nascondi colonna',
    showColumn: 'Mostra colonna',
    pinStart: 'Blocca all’inizio',
    pinEnd: 'Blocca alla fine',
    unpin: 'Sblocca',
    autoSize: 'Doppio clic per adattare al contenuto',
  },
  nl: {
    noData: 'Geen gegevens',
    dragToGroup: 'Sleep een kolomkop hierheen om erop te groeperen',
    groupLabelSeparator: ': ',
    sortAscending: 'oplopend',
    sortDescending: 'aflopend',
    clearSorting: 'Sortering verwijderd van {column}',
    sortedAnnouncement: 'Gesorteerd op {column}, {order}',
    trueText: 'Waar',
    falseText: 'Onwaar',
    columnChooser: 'Kolomkiezer',
    hideColumn: 'Kolom verbergen',
    showColumn: 'Kolom weergeven',
    pinStart: 'Vastzetten aan het begin',
    pinEnd: 'Vastzetten aan het einde',
    unpin: 'Losmaken',
    autoSize: 'Dubbelklik om aan de inhoud aan te passen',
  },
  ru: {
    noData: 'Нет данных',
    dragToGroup: 'Перетащите сюда заголовок столбца для группировки',
    groupLabelSeparator: ': ',
    sortAscending: 'по возрастанию',
    sortDescending: 'по убыванию',
    clearSorting: 'Сортировка по столбцу {column} отменена',
    sortedAnnouncement: 'Отсортировано по столбцу {column}, {order}',
    trueText: 'Истина',
    falseText: 'Ложь',
    columnChooser: 'Выбор столбцов',
    hideColumn: 'Скрыть столбец',
    showColumn: 'Показать столбец',
    pinStart: 'Закрепить в начале',
    pinEnd: 'Закрепить в конце',
    unpin: 'Открепить',
    autoSize: 'Дважды щёлкните, чтобы подогнать ширину',
  },
  pl: {
    noData: 'Brak danych',
    dragToGroup: 'Przeciągnij tutaj nagłówek kolumny, aby pogrupować',
    groupLabelSeparator: ': ',
    sortAscending: 'rosnąco',
    sortDescending: 'malejąco',
    clearSorting: 'Usunięto sortowanie według {column}',
    sortedAnnouncement: 'Posortowano według {column}, {order}',
    trueText: 'Prawda',
    falseText: 'Fałsz',
    columnChooser: 'Wybór kolumn',
    hideColumn: 'Ukryj kolumnę',
    showColumn: 'Pokaż kolumnę',
    pinStart: 'Przypnij na początku',
    pinEnd: 'Przypnij na końcu',
    unpin: 'Odepnij',
    autoSize: 'Kliknij dwukrotnie, aby dopasować szerokość',
  },
  tr: {
    noData: 'Veri yok',
    dragToGroup: 'Gruplamak için bir sütun başlığını buraya sürükleyin',
    groupLabelSeparator: ': ',
    sortAscending: 'artan',
    sortDescending: 'azalan',
    clearSorting: '{column} sıralaması kaldırıldı',
    sortedAnnouncement: '{column} sütununa göre sıralandı, {order}',
    trueText: 'Doğru',
    falseText: 'Yanlış',
    columnChooser: 'Sütun seçici',
    hideColumn: 'Sütunu gizle',
    showColumn: 'Sütunu göster',
    pinStart: 'Başa sabitle',
    pinEnd: 'Sona sabitle',
    unpin: 'Sabitlemeyi kaldır',
    autoSize: 'İçeriğe sığdırmak için çift tıklayın',
  },
  ja: {
    noData: 'データがありません',
    dragToGroup: '列ヘッダーをここにドラッグしてグループ化します',
    groupLabelSeparator: '：',
    sortAscending: '昇順',
    sortDescending: '降順',
    clearSorting: '{column} の並べ替えを解除しました',
    sortedAnnouncement: '{column} で並べ替えました（{order}）',
    trueText: '真',
    falseText: '偽',
    columnChooser: '列の選択',
    hideColumn: '列を非表示',
    showColumn: '列を表示',
    pinStart: '先頭に固定',
    pinEnd: '末尾に固定',
    unpin: '固定を解除',
    autoSize: 'ダブルクリックで幅を自動調整',
  },
  ko: {
    noData: '데이터 없음',
    dragToGroup: '열 머리글을 여기로 끌어 그룹화하세요',
    groupLabelSeparator: ': ',
    sortAscending: '오름차순',
    sortDescending: '내림차순',
    clearSorting: '{column} 정렬을 해제했습니다',
    sortedAnnouncement: '{column} 기준 {order} 정렬됨',
    trueText: '참',
    falseText: '거짓',
    columnChooser: '열 선택기',
    hideColumn: '열 숨기기',
    showColumn: '열 표시',
    pinStart: '시작 부분에 고정',
    pinEnd: '끝 부분에 고정',
    unpin: '고정 해제',
    autoSize: '두 번 클릭하여 너비 자동 맞춤',
  },
  zh: {
    noData: '无数据',
    dragToGroup: '将列标题拖到此处进行分组',
    groupLabelSeparator: '：',
    sortAscending: '升序',
    sortDescending: '降序',
    clearSorting: '已取消按 {column} 排序',
    sortedAnnouncement: '已按 {column} {order}排序',
    trueText: '是',
    falseText: '否',
    columnChooser: '列选择器',
    hideColumn: '隐藏列',
    showColumn: '显示列',
    pinStart: '固定到开头',
    pinEnd: '固定到末尾',
    unpin: '取消固定',
    autoSize: '双击自动调整宽度',
  },
  ar: {
    noData: 'لا توجد بيانات',
    dragToGroup: 'اسحب عنوان عمود إلى هنا للتجميع حسبه',
    groupLabelSeparator: ': ',
    sortAscending: 'تصاعدي',
    sortDescending: 'تنازلي',
    clearSorting: 'تمت إزالة الفرز حسب {column}',
    sortedAnnouncement: 'تم الفرز حسب {column}، {order}',
    trueText: 'صحيح',
    falseText: 'خطأ',
    columnChooser: 'منتقي الأعمدة',
    hideColumn: 'إخفاء العمود',
    showColumn: 'إظهار العمود',
    pinStart: 'تثبيت في البداية',
    pinEnd: 'تثبيت في النهاية',
    unpin: 'إلغاء التثبيت',
    autoSize: 'انقر نقرًا مزدوجًا لملاءمة العرض',
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

/** Quantos pedidos de idioma esperam provedor (diagnóstico/testes, spec 14). */
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
