/** Tipo do dado da coluna; sem `dataType`, vem do 1º valor não nulo. */
export type GridColumnDataType = 'string' | 'number' | 'date' | 'datetime' | 'boolean';

/** Alinhamento lógico: `start`/`end` acompanham a direção (RTL). */
export type GridColumnAlignment = 'start' | 'center' | 'end';

/** Booleano como texto (`trueText`/`falseText`) ou ícone de check só leitura. */
export type GridColumnBooleanDisplay = 'text' | 'icon';

export type GridColumnFormatter = (value: unknown, item: any) => string;

export type GridColumnFormat = Intl.NumberFormatOptions | Intl.DateTimeFormatOptions | GridColumnFormatter;

export interface GridColumnDef {
  width?: number | null;
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
}
