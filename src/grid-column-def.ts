export type GridSortOrder = 'asc' | 'desc';

/** Uma coluna da ordenação atual e a direção dela (`getSorting()`). */
export interface GridSort {
  column: GridColumnDef;
  order: GridSortOrder;
}

/**
 * Comparador próprio de uma coluna, em ordem crescente (a direção é aplicada
 * pelo grid). Recebe os valores das células e os itens das linhas.
 */
export type GridColumnComparator = (a: any, b: any, itemA: any, itemB: any) => number;

/** Tipo do dado da coluna; sem `dataType`, vem do 1º valor não nulo. */
export type GridColumnDataType = 'string' | 'number' | 'date' | 'datetime' | 'boolean';

/** Alinhamento lógico: `start`/`end` acompanham a direção (RTL). */
export type GridColumnAlignment = 'start' | 'center' | 'end';

/** Booleano como texto (`trueText`/`falseText`) ou ícone de check só leitura. */
export type GridColumnBooleanDisplay = 'text' | 'icon';

export type GridColumnFormatter = (value: unknown, item: any) => string;

export type GridColumnFormat = Intl.NumberFormatOptions | Intl.DateTimeFormatOptions | GridColumnFormatter;

/** Lado em que uma coluna fica fixa (lógico: espelha em RTL). */
export type GridColumnFixed = 'start' | 'end' | null;

export interface GridColumnDef {
  width?: number | null;
  /** Largura mínima em px (também ao redimensionar/auto-ajustar). */
  minWidth?: number | null;
  /** Nível de agrupamento INICIAL; depois o usuário reagrupa por arrasto. */
  groupIndex?: number | null;
  label?: string;
  path?: string;
  dataType?: GridColumnDataType | null;
  format?: GridColumnFormat | null;
  alignment?: GridColumnAlignment | null;
  /** Valor da célula (agrupar/ordenar/filtrar). Padrão: ler `path`. */
  valueGetter?: ((item: any) => unknown) | null;
  /** Texto exibido (célula e grupo); tem precedência sobre `format`. */
  displayValue?: ((value: unknown, item: any) => string) | null;
  /** Booleano como texto (padrão) ou ícone; o ícone tem o texto como nome acessível. */
  booleanDisplay?: GridColumnBooleanDisplay | null;
  /** Quebra o texto em várias linhas em vez de reticências. */
  wrap?: boolean;
  /** Texto para valor vazio (`null`/`undefined`). */
  emptyText?: string | null;
  renderer?: ((item: any) => HTMLElement) | null;
  /** Permite ordenar pelo cabeçalho. Padrão: `true` se a coluna tiver `path`, `valueGetter` ou `comparator`. */
  sortable?: boolean | null;
  /** Ordenação INICIAL; depois o estado é do grid (`sortBy`, `getSorting`). */
  sortOrder?: GridSortOrder | null;
  /** Prioridade da ordenação inicial entre colunas (menor primeiro). */
  sortIndex?: number | null;
  comparator?: GridColumnComparator | null;
  /** `false` impede redimensionar esta coluna mesmo com `column-resizing`. */
  resizable?: boolean | null;
  /** Largura máxima em px ao redimensionar/auto-ajustar. */
  maxWidth?: number | null;
  /** Fixa a coluna no início ou no fim da área rolável. */
  fixed?: GridColumnFixed;
  /** Visibilidade INICIAL (padrão `true`); depois o usuário muda no seletor. */
  visible?: boolean | null;
  /** `false` tira a coluna do seletor (o usuário não consegue ocultá-la). */
  showInChooser?: boolean | null;
}

/** A coluna pode ser ordenada pelo usuário? */
export const isColumnSortable = (column: GridColumnDef): boolean =>
  column.sortable ?? (!!column.path || !!column.valueGetter || !!column.comparator);
