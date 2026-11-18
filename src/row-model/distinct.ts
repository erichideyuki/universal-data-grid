import type { GridColumnDataType, GridColumnDef } from '../grid-column-def.js';
import { createComparer } from './compare.js';
import { dayKey } from './filter.js';
import { foldText } from './fold.js';
import { getDateTimeFormat, toDate } from './format.js';
import { cellValueReader, toDisplayText } from './value.js';

/** Um valor distinto da coluna (filtro do cabeçalho). */
export interface DistinctValue {
  /** Valor gravado no `anyof` (data: `"aaaa-mm-dd"`; vazio: `null`). */
  value: unknown;
  /** Texto exibido (o da célula). */
  text: string;
  count: number;
}

/** Nó da árvore de datas: ano → mês → dia (os dias são `DistinctValue`). */
export interface DistinctDateNode {
  /** `"2024"` ou `"2024-03"`. */
  key: string;
  /** Texto do ano / nome do mês no idioma. */
  text: string;
  count: number;
  children: (DistinctDateNode | DistinctValue)[];
}

export interface DistinctValues {
  /** Lista plana (sem datas) ou dias (com datas), já ordenada; sem vazios. */
  values: DistinctValue[];
  /** Árvore ano/mês/dia em colunas de data; `undefined` nas outras. */
  tree?: DistinctDateNode[];
  /** Quantos itens vazios (`(Blanks)`), 0 se nenhum. */
  blanks: number;
}

export interface DistinctContext {
  language: string | undefined;
  dataType: GridColumnDataType | undefined;
  textOf(item: unknown, column: GridColumnDef): string;
}

const DAY: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };
const MONTH: Intl.DateTimeFormatOptions = { month: 'long' };

const pad = (value: number): string => String(value).padStart(2, '0');

const isBlank = (value: unknown): boolean =>
  value === null || value === undefined || value === ''
  || (typeof value === 'number' && Number.isNaN(value))
  || (value instanceof Date && Number.isNaN(value.getTime()));

/**
 * Valores distintos de `column` em `items`, com contagem. Texto agrupa sem
 * caixa/acento (como o `anyof` compara) e mostra a 1ª grafia vista; datas
 * agrupam por dia e montam a árvore ano → mês → dia. Uma passada por
 * `items`; `textOf` só é chamado uma vez por valor distinto.
 */
export const distinctValues = (items: readonly unknown[], column: GridColumnDef, context: DistinctContext): DistinctValues => {
  const { dataType } = context;
  const isDate = dataType === 'date' || dataType === 'datetime';
  const groups = new Map<unknown, { value: unknown; item: unknown; count: number; sortKey: unknown }>();
  let blanks = 0;
  const read = cellValueReader(column);

  for (const item of items) {
    const raw = read(item);

    if (isBlank(raw)) {
      blanks++;
      continue;
    }

    let key: unknown;
    let value: unknown = raw;
    let sortKey: unknown = raw;

    if (isDate) {
      const date = toDate(raw);

      if (!date) {
        key = `?${toDisplayText(raw)}`;
      } else {
        key = dayKey(date);
        value = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
        sortKey = key;
      }
    } else if (typeof raw === 'string') {
      key = foldText(raw);
    } else {
      key = typeof raw === 'object' ? toDisplayText(raw) : raw;
    }

    const group = groups.get(key);

    if (group) {
      group.count++;
    } else {
      groups.set(key, { value, item, count: 1, sortKey });
    }
  }

  const compare = createComparer(context.language, isDate ? 'number' : dataType);
  const sorted = [...groups.values()].sort((a, b) => compare(a.sortKey, b.sortKey));
  const values: DistinctValue[] = sorted.map(group => ({
    value: group.value,
    text: isDate && column.displayValue === undefined && typeof column.format !== 'function'
      ? dayText(group.value as string, context.language)
      : context.textOf(group.item, column),
    count: group.count,
  }));

  return isDate
    ? { values, tree: dateTree(values, context.language), blanks }
    : { values, blanks };
};

const dayText = (iso: string, language: string | undefined): string => {
  const [year, month, day] = iso.split('-').map(Number);

  if (!day) {
    return iso;
  }

  return getDateTimeFormat(language, DAY).format(new Date(year, month - 1, day));
};

const monthText = (year: number, month: number, language: string | undefined): string => getDateTimeFormat(language, MONTH).format(new Date(year, month - 1, 1));

const dateTree = (days: readonly DistinctValue[], language: string | undefined): DistinctDateNode[] => {
  const years: DistinctDateNode[] = [];
  let year: DistinctDateNode | undefined;
  let month: DistinctDateNode | undefined;

  for (const day of days) {
    const iso = day.value as string;

    if (!(/^\d{4}-\d{2}-\d{2}$/).test(iso)) {
      continue;
    }

    const yearKey = iso.slice(0, 4);
    const monthKey = iso.slice(0, 7);

    if (year?.key !== yearKey) {
      year = { key: yearKey, text: yearKey, count: 0, children: [] };
      years.push(year);
      month = undefined;
    }

    if (month?.key !== monthKey) {
      month = { key: monthKey, text: monthText(Number(yearKey), Number(iso.slice(5, 7)), language), count: 0, children: [] };
      year.children.push(month);
    }

    month.children.push(day);
    month.count += day.count;
    year.count += day.count;
  }

  return years;
};
