import type { GridColumnDef } from '../grid-column-def.js';

/**
 * Lê `path` (com pontos: `address.city`) de um item. Sem `path` devolve
 * `undefined` — colunas só com `renderer` não têm valor.
 */
export const getValueByPath = (item: unknown, path: string | undefined): unknown => {

  if (!path) {
    return undefined;
  }

  let value: any = item;

  for (const key of path.split('.')) {
    if (value === null || value === undefined) {
      return undefined;
    }

    value = value[key];
  }

  return value;
};

/**
 * Único ponto que lê o valor de uma célula (base de ordenar/agrupar/exibir):
 * `valueGetter` quando houver, senão `path`.
 */
export const getCellValue = (item: unknown, column: GridColumnDef): unknown =>
  column.valueGetter
    ? column.valueGetter(item)
    : getValueByPath(item, column.path);

/** Texto cru de um valor, sem formatação (a formatada está em `format.ts`). */
export const toDisplayText = (value: unknown): string =>
  value === null || value === undefined
    ? ''
    : String(value);
