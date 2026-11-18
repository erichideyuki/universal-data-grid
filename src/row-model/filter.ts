import type {
  GridColumnDataType,
  GridColumnDef,
  GridFilterCondition,
  GridFilterExpression,
  GridFilterOperation,
} from '../grid-column-def.js';
import { getBaseCollator } from './compare.js';
import { createTextMatcher, foldText, type TextMatchMode } from './fold.js';
import { toDate, toNumber } from './format.js';
import { cellValueReader, toDisplayText } from './value.js';

/** Todos os operadores, na ordem dos menus. */
export const FILTER_OPERATIONS: readonly GridFilterOperation[] = [
  'contains',
  'notcontains',
  'startswith',
  'endswith',
  '=',
  '<>',
  '<',
  '>',
  '<=',
  '>=',
  'between',
  'anyof',
  'noneof',
  'isblank',
  'isnotblank',
];

const OPERATION_SET = new Set<string>(FILTER_OPERATIONS);

export const isFilterOperation = (value: unknown): value is GridFilterOperation =>
  typeof value === 'string' && OPERATION_SET.has(value);

/** O que o avaliador precisa do grid — tudo sem DOM. */
export interface FilterContext {
  language: string | undefined;
  /** Colunas conhecidas: o `field` texto de uma condição é procurado pelo `path`. */
  columns: readonly GridColumnDef[];
  /** `dataType` efetivo (informado ou inferido). */
  dataTypeOf(column: GridColumnDef): GridColumnDataType | undefined;
  /** Texto exibido (`displayValue`/`format`), o mesmo da célula. */
  textOf(item: unknown, column: GridColumnDef): string;
  /**
   * Caracteres (já sem caixa/acento) que o texto exibido de um valor que
   * converte no `dataType` (número, data, booleano) pode ter; `undefined` =
   * qualquer um. Um termo com caractere fora dele não casa — a busca pula a
   * coluna sem formatar célula nenhuma.
   */
  alphabetOf?(column: GridColumnDef): ReadonlySet<string> | undefined;
  /**
   * Todo valor não vazio da coluna converte no `dataType` (ver
   * {@link allValuesConvert}; o grid guarda o resultado por `items`). Com o
   * alfabeto, deixa a busca descartar a coluna inteira.
   */
  allConvert?(column: GridColumnDef): boolean;
}

export type FilterPredicate = (item: unknown) => boolean;

/** Expressão inválida (operador desconhecido, forma errada). */
export class FilterExpressionError extends TypeError {
}

// ------------------------------------------------------------------ formas

const isConnector = (value: unknown): value is 'and' | 'or' =>
  value === 'and' || value === 'or';

/** `[path, operador, valor?]` (ou o atalho `[path, valor]` = `=`). */
export const isFilterCondition = (expression: unknown): expression is GridFilterCondition =>
  Array.isArray(expression)
  && expression.length >= 2
  && expression.length <= 3
  && typeof expression[0] === 'string'
  && expression[0] !== '!'
  && !isConnector(expression[1])
  && (expression.length === 3 ? isFilterOperation(expression[1]) : !Array.isArray(expression[1]));

const conditionParts = (condition: GridFilterCondition): [string, GridFilterOperation, unknown] =>
  condition.length === 2 && !isFilterOperation(condition[1])
    ? [condition[0], '=', condition[1]]
    : [condition[0], condition[1] as GridFilterOperation, condition[2]];

// ----------------------------------------------------------------- valores

const isBlankValue = (value: unknown): boolean =>
  value === null
  || value === undefined
  || value === ''
  || (typeof value === 'number' && Number.isNaN(value))
  || (value instanceof Date && Number.isNaN(value.getTime()));

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Dia local como inteiro `aaaammdd`. */
export const dayKey = (date: Date): number =>
  date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();

/** Chave de comparação no tipo da coluna; `undefined` = não converte. */
type KeyOf = (value: unknown) => number | string | boolean | undefined;

const numberKey: KeyOf = value => {
  const numeric = toNumber(value);
  return numeric === undefined ? undefined : Number(numeric);
};

const timeKey: KeyOf = value => toDate(value)?.getTime();

const dayKeyOf: KeyOf = value => {
  const date = toDate(value);
  return date ? dayKey(date) : undefined;
};

const booleanKey: KeyOf = value =>
  typeof value === 'boolean' ? value : value === 'true' ? true : value === 'false' ? false : undefined;

/**
 * Chave do VALOR DO FILTRO e da célula. Em `date` compara o dia; em
 * `datetime`, o instante — menos quando o valor do filtro é só data
 * (`"2024-03-05"`), que compara o dia (é o que o filtro do cabeçalho grava).
 */
const keyFunctions = (dataType: GridColumnDataType | undefined, target: unknown): KeyOf | undefined => {
  switch (dataType) {
    case 'number':
      return numberKey;
    case 'date':
      return dayKeyOf;
    case 'datetime':
      return typeof target === 'string' && ISO_DATE_ONLY.test(target) ? dayKeyOf : timeKey;
    case 'boolean':
      return booleanKey;
    default:
      return undefined;
  }
};

/** Memoriza `keyOf` para strings (datas ISO repetem muito; `toDate` analisa o texto). Transitório: um por compilação. */
const memoizeStrings = (keyOf: KeyOf): KeyOf => {
  const memo = new Map<string, ReturnType<KeyOf>>();

  return value => {
    if (typeof value !== 'string') {
      return keyOf(value);
    }

    if (memo.has(value)) {
      return memo.get(value);
    }

    const key = keyOf(value);

    if (memo.size < MEMO_LIMIT) {
      memo.set(value, key);
    }

    return key;
  };
};

/** Teto dos memorandos por compilação: colunas de valores únicos não ganham nada e gastariam memória. */
const MEMO_LIMIT = 4096;

/** O valor converte no tipo (o texto exibido é o formatado, de alfabeto conhecido)? */
type Converts = (value: unknown) => boolean;

const convertsTo = (dataType: GridColumnDataType | undefined): Converts | undefined => {
  if (dataType === 'number') {
    return value => toNumber(value) !== undefined;
  }

  if (dataType === 'date' || dataType === 'datetime') {
    const time = memoizeStrings(timeKey);

    return value => time(value) !== undefined;
  }

  return dataType === 'boolean' ? value => typeof value === 'boolean' : undefined;
};

/** Todo valor não vazio de `column` em `items` converte no tipo? (uma passada) */
export const allValuesConvert = (items: readonly unknown[], column: GridColumnDef, dataType: GridColumnDataType | undefined): boolean => {
  const converts = convertsTo(dataType);

  if (!converts) {
    return false;
  }

  const read = cellValueReader(column);

  for (const item of items) {
    const value = read(item);

    if (!isBlankValue(value) && !converts(value)) {
      return false;
    }
  }

  return true;
};

// --------------------------------------------------------------- compilação

interface Compiler {
  context: FilterContext;
  /** Colunas sintéticas para `path` sem coluna — uma por compilação. */
  synthetic: Map<string, GridColumnDef>;
  /** Leitor de valor por coluna (`path` quebrado uma vez). */
  readers: Map<GridColumnDef, (item: unknown) => unknown>;
}

type ValueReader = (item: unknown) => unknown;

const readerFor = (column: GridColumnDef, compiler: Compiler): ValueReader => {
  let read = compiler.readers.get(column);

  if (!read) {
    read = cellValueReader(column);
    compiler.readers.set(column, read);
  }

  return read;
};

/** Coluna do `path` (a primeira, se houver duas); sem coluna, lê o caminho do item. */
const resolveColumn = (field: string, compiler: Compiler): GridColumnDef => {
  const known = compiler.context.columns.find(column => column.path === field);

  if (known) {
    return known;
  }

  let column = compiler.synthetic.get(field);

  if (!column) {
    column = { path: field };
    compiler.synthetic.set(field, column);
  }

  return column;
};

/**
 * Texto em que as operações de texto procuram: o valor cru nas colunas de
 * texto sem `displayValue`/`format` (sem alocar), senão o texto exibido. O
 * resultado é memorizado por valor primitivo quando o texto não depende do
 * item (sem `displayValue` nem `format` função).
 */
const textTest = (
  column: GridColumnDef,
  compiler: Compiler,
  test: (text: string) => boolean,
  term?: string,
): FilterPredicate => {
  const read = readerFor(column, compiler);
  const { context } = compiler;
  const dataType = context.dataTypeOf(column);
  const dependsOnItem = !!column.displayValue || typeof column.format === 'function';

  if ((dataType === 'string' || dataType === undefined) && !dependsOnItem && !column.format) {
    // Memo por valor enquanto houver repetição (colunas de categorias). Cheio
    // o memo, se a maioria das consultas falhou (valores quase únicos), para
    // de consultar: a consulta custaria tanto quanto o teste.
    const memo = new Map<string, boolean>();
    let lookups = 0;
    let useMemo = true;

    return item => {
      const value = read(item);

      if (typeof value !== 'string') {
        return test(isBlankValue(value) ? column.emptyText ?? '' : toDisplayText(value));
      }

      if (!useMemo) {
        return test(value);
      }

      lookups++;
      let result = memo.get(value);

      if (result === undefined) {
        result = test(value);

        if (memo.size < MEMO_LIMIT) {
          memo.set(value, result);
        } else if (lookups < memo.size * 2) {
          useMemo = false;
        }
      }

      return result;
    };
  }

  // Termo com caractere que o texto formatado nunca tem: valores que
  // convertem não casam, sem formatar (a busca em 24 colunas pula as de número/data).
  const alphabet = term === undefined || dependsOnItem ? undefined : context.alphabetOf?.(column);
  const converts = convertsTo(dataType);

  if (alphabet && converts && !Array.from(foldText(term!)).every(char => alphabet.has(char))) {
    // O vazio mostra `emptyText`, que também está no alfabeto: nada casa.
    if (context.allConvert?.(column)) {
      return never;
    }

    return item => {
      const value = read(item);

      if (isBlankValue(value)) {
        return test(column.emptyText ?? '');
      }

      return converts(value) ? false : test(context.textOf(item, column));
    };
  }

  if (dependsOnItem) {
    return item => test(context.textOf(item, column));
  }

  const memo = new Map<unknown, boolean>();

  return item => {
    const value = read(item);
    const key = value instanceof Date ? value.getTime() : value;

    if (typeof key === 'object' && key !== null) {
      return test(context.textOf(item, column));
    }

    let result = memo.get(key);

    if (result === undefined) {
      result = test(context.textOf(item, column));
      memo.set(key, result);
    }

    return result;
  };
};

const TEXT_MODES: Partial<Record<GridFilterOperation, TextMatchMode>> = {
  contains: 'contains',
  notcontains: 'contains',
  startswith: 'startswith',
  endswith: 'endswith',
};

const always: FilterPredicate = () => true;
/** Nunca casa (coluna que a busca pode pular inteira). */
const never: FilterPredicate = () => false;

const every = (list: readonly FilterPredicate[]): FilterPredicate => item => {
  for (const predicate of list) {
    if (!predicate(item)) {
      return false;
    }
  }

  return true;
};

const some = (list: readonly FilterPredicate[]): FilterPredicate => item => {
  for (const predicate of list) {
    if (predicate(item)) {
      return true;
    }
  }

  return false;
};

const compileTextOperation = (column: GridColumnDef, operation: GridFilterOperation, value: unknown, compiler: Compiler): FilterPredicate => {
  const matcher = isBlankValue(value) ? null : createTextMatcher(toDisplayText(value), TEXT_MODES[operation]);

  // Termo vazio: sem condição (como digitar e apagar na linha de filtro).
  if (!matcher) {
    return always;
  }

  const negate = operation === 'notcontains';
  const term = toDisplayText(value);

  return textTest(column, compiler, text => matcher.test(text) !== negate, negate ? undefined : term);
};

const compileEquality = (column: GridColumnDef, value: unknown, compiler: Compiler): FilterPredicate => {
  const read = readerFor(column, compiler);

  if (isBlankValue(value)) {
    return item => isBlankValue(read(item));
  }

  const dataType = compiler.context.dataTypeOf(column);
  const rawKeyOf = keyFunctions(dataType, value);
  const keyOf = rawKeyOf && memoizeStrings(rawKeyOf);

  if (!keyOf) {
    const matcher = createTextMatcher(toDisplayText(value), 'equals');
    return matcher ? textTest(column, compiler, text => matcher.test(text)) : always;
  }

  const target = keyOf(value);

  return target === undefined
    ? () => false
    : item => keyOf(read(item)) === target;
};

const compileOrdering = (column: GridColumnDef, operation: GridFilterOperation, value: unknown, compiler: Compiler): FilterPredicate => {
  const read = readerFor(column, compiler);

  if (isBlankValue(value)) {
    return always;
  }

  const { context } = compiler;
  const dataType = context.dataTypeOf(column);
  const rawKeyOf = keyFunctions(dataType, value);
  const keyOf = rawKeyOf && memoizeStrings(rawKeyOf);
  let compare: (item: unknown) => number | undefined;

  if (keyOf) {
    const target = keyOf(value) as number;

    if (target === undefined) {
      return () => false;
    }

    compare = item => {
      const key = keyOf(read(item));
      return key === undefined ? undefined : Number(key) - Number(target);
    };
  } else {
    const collator = getBaseCollator(context.language);
    const target = toDisplayText(value);

    compare = item => {
      const cell = read(item);
      return isBlankValue(cell) ? undefined : collator.compare(toDisplayText(cell), target);
    };
  }

  switch (operation) {
    case '<':
      return item => (compare(item) ?? 0) < 0;

    case '<=':
      return item => {
        const result = compare(item); return result !== undefined && result <= 0;
      };

    case '>':
      return item => (compare(item) ?? 0) > 0;

    default:
      return item => {
        const result = compare(item); return result !== undefined && result >= 0;
      };
  }
};

const compileBetween = (column: GridColumnDef, value: unknown, compiler: Compiler): FilterPredicate => {
  const read = readerFor(column, compiler);
  const [start, end] = Array.isArray(value) ? value as unknown[] : [];
  const lower = isBlankValue(start) ? always : compileOrdering(column, '>=', start, compiler);
  const upper = isBlankValue(end) ? always : compileOrdering(column, '<=', end, compiler);

  if (lower === always && upper === always) {
    return always;
  }

  return item => !isBlankValue(read(item)) && lower(item) && upper(item);
};

const compileSet = (column: GridColumnDef, operation: 'anyof' | 'noneof', value: unknown, compiler: Compiler): FilterPredicate => {
  const read = readerFor(column, compiler);
  const values = Array.isArray(value) ? value as unknown[] : [];
  const dataType = compiler.context.dataTypeOf(column);
  const blanks = values.some(isBlankValue);
  const keys = new Set<unknown>();
  const cellKeyOfs = new Set<KeyOf>();

  for (const entry of values) {
    if (isBlankValue(entry)) {
      continue;
    }

    const keyOf = keyFunctions(dataType, entry) ?? ((v: unknown) => foldText(toDisplayText(v)));
    const key = keyOf(entry);

    if (key !== undefined) {
      keys.add(key);
      cellKeyOfs.add(keyOf);
    }
  }

  const keyOfs = [...cellKeyOfs];
  const memo = new Map<unknown, boolean>();

  const matches = (cell: unknown): boolean => {
    if (isBlankValue(cell)) {
      return blanks;
    }

    const primitive = typeof cell !== 'object';
    const cached = primitive ? memo.get(cell) : undefined;

    if (cached !== undefined) {
      return cached;
    }

    const result = keyOfs.some(keyOf => keys.has(keyOf(cell)));

    if (primitive) {
      memo.set(cell, result);
    }

    return result;
  };

  const negate = operation === 'noneof';

  return item => matches(read(item)) !== negate;
};

const compileCondition = (condition: GridFilterCondition, compiler: Compiler): FilterPredicate => {
  const [field, operation, value] = conditionParts(condition);

  if (!isFilterOperation(operation)) {
    throw new FilterExpressionError(`Unknown filter operation "${String(operation)}".`);
  }

  const column = resolveColumn(field, compiler);
  const read = readerFor(column, compiler);

  switch (operation) {
    case 'contains':
    case 'notcontains':
    case 'startswith':
    case 'endswith':
      return compileTextOperation(column, operation, value, compiler);
    case '=':
      return compileEquality(column, value, compiler);

    case '<>': {
      const equals = compileEquality(column, value, compiler);
      return item => !equals(item);
    }

    case '<':
    case '<=':
    case '>':
    case '>=':
      return compileOrdering(column, operation, value, compiler);
    case 'between':
      return compileBetween(column, value, compiler);
    case 'anyof':
    case 'noneof':
      return compileSet(column, operation, value, compiler);
    case 'isblank':
      return item => isBlankValue(read(item));
    case 'isnotblank':
      return item => !isBlankValue(read(item));
  }
};

/**
 * Grupo `[a, 'and', b, 'or', c]`: `and` liga mais forte que `or`; dois
 * itens seguidos sem conector valem `and`.
 */
const compileGroup = (group: readonly unknown[], compiler: Compiler): FilterPredicate => {
  const alternatives: FilterPredicate[][] = [[]];
  let expectOperand = true;

  for (const entry of group) {
    if (isConnector(entry)) {
      if (expectOperand) {
        throw new FilterExpressionError(`Misplaced "${entry}" in filter expression.`);
      }

      if (entry === 'or') {
        alternatives.push([]);
      }

      expectOperand = true;
      continue;
    }

    alternatives[alternatives.length - 1].push(compileNode(entry, compiler));
    expectOperand = false;
  }

  if (expectOperand && group.length) {
    throw new FilterExpressionError('Filter expression ends with a connector.');
  }

  const clauses = alternatives
    .filter(list => list.length)
    .map(list => list.filter(predicate => predicate !== always))
    .map(list => list.includes(never)
      ? never
      : list.length === 1 ? list[0] : list.length === 0 ? always : every(list));

  if (!clauses.length || clauses.includes(always)) {
    return always;
  }

  const possible = clauses.filter(clause => clause !== never);

  if (!possible.length) {
    return never;
  }

  return possible.length === 1 ? possible[0] : some(possible);
};

const compileNode = (node: unknown, compiler: Compiler): FilterPredicate => {
  if (!Array.isArray(node)) {
    throw new FilterExpressionError('Filter expression must be an array.');
  }

  if (node[0] === '!') {
    const inner = compileNode(node[1], compiler);
    return inner === always ? never : inner === never ? always : item => !inner(item);
  }

  return isFilterCondition(node)
    ? compileCondition(node, compiler)
    : compileGroup(node, compiler);
};

/**
 * Compila a expressão num predicado (uma vez por mudança de filtro; avaliar
 * linha a linha fica barato). `null` quando não há filtro efetivo.
 * Lança {@link FilterExpressionError} para expressão malformada.
 */
export const compileFilter = (
  expression: GridFilterExpression | null | undefined,
  context: FilterContext,
): FilterPredicate | null => {

  if (!expression || (Array.isArray(expression) && !expression.length)) {
    return null;
  }

  const predicate = compileNode(expression, { context, synthetic: new Map(), readers: new Map() });

  return predicate === always ? null : predicate;
};

/** Junta expressões com `and`, ignorando as vazias. */
export const combineFilters = (
  ...expressions: (GridFilterExpression | null | undefined)[]
): GridFilterExpression | null => {
  const present = expressions.filter((expression): expression is GridFilterExpression => !!expression && expression.length > 0);

  if (present.length < 2) {
    return present[0] ?? null;
  }

  return present.flatMap((expression, index) => index ? ['and' as const, expression] : [expression]);
};

// ------------------------------------------------------------- aplicação

/** Máscara de `items` que passam (1 = passa). */
export const filterMask = (items: readonly unknown[], predicate: FilterPredicate, mask = new Uint8Array(items.length), start = 0, end = items.length): Uint8Array => {
  for (let index = start; index < end; index++) {
    mask[index] = predicate(items[index]) ? 1 : 0;
  }

  return mask;
};

/**
 * Itens na ordem `order` (índices de `items`; `null` = ordem original) que
 * passam pela máscara (`null` = todos). Sem ordem nem máscara devolve o
 * próprio `items`.
 */
export const applyMask = <T>(items: readonly T[], order: Int32Array | null, mask: Uint8Array | null): readonly T[] => {
  if (!mask) {
    if (!order) {
      return items;
    }

    const sorted = new Array<T>(order.length);

    for (let i = 0; i < order.length; i++) {
      sorted[i] = items[order[i]];
    }

    return sorted;
  }

  const result: T[] = [];

  if (order) {
    for (const index of order) {
      if (mask[index]) {
        result.push(items[index]);
      }
    }
  } else {
    for (let index = 0; index < items.length; index++) {
      if (mask[index]) {
        result.push(items[index]);
      }
    }
  }

  return result;
};

/** Itens que passam, na ordem de `items` (nunca muta `items`). */
export const filterItems = <T>(items: readonly T[], predicate: FilterPredicate | null): readonly T[] =>
  predicate ? items.filter(item => predicate(item)) : items;

// ----------------------------------------------------------------- busca

/**
 * Expressão da busca: `contains` em qualquer das colunas, ligadas por `or`.
 * `null` sem texto ou sem colunas.
 */
export const searchExpression = (text: string, columns: readonly GridColumnDef[]): GridFilterExpression | null => {
  const conditions: GridFilterCondition[] = !text.trim() ? [] : columns.filter(column => column.path).map(column => [column.path!, 'contains', text]);

  if (!conditions.length) {
    return null;
  }

  return conditions.length === 1
    ? conditions[0]
    : conditions.flatMap((condition, index) => index ? ['or' as const, condition] : [condition]);
};

// ------------------------------------------- sincronia com a interface

/**
 * Partes de uma expressão ligadas por `and` no nível de cima. Uma expressão
 * com `or` no topo (ou negada) é uma parte só, que a interface não edita.
 */
export const splitConjuncts = (expression: GridFilterExpression | null | undefined): GridFilterExpression[] => {
  if (!expression?.length) {
    return [];
  }

  if (isFilterCondition(expression) || (expression as readonly unknown[])[0] === '!') {
    return [expression];
  }

  const group = expression as readonly unknown[];

  if (group.includes('or')) {
    return [expression];
  }

  return group.filter(entry => !isConnector(entry)) as GridFilterExpression[];
};

const sameField = (field: string, column: GridColumnDef): boolean =>
  !!column.path && field === column.path;

/** Tipo de condição de coluna: a da linha de filtro ou a do filtro do cabeçalho (`anyof`/`noneof`). */
export type ColumnFilterKind = 'row' | 'header';

const kindOf = (operation: GridFilterOperation): ColumnFilterKind =>
  operation === 'anyof' || operation === 'noneof' ? 'header' : 'row';

/** Condição da coluna (no nível de cima da expressão) para a linha de filtro ou o cabeçalho. */
export const findColumnCondition = (
  expression: GridFilterExpression | null | undefined,
  column: GridColumnDef,
  kind: ColumnFilterKind,
): [GridFilterOperation, unknown] | undefined => {
  for (const part of splitConjuncts(expression)) {
    if (!isFilterCondition(part)) {
      continue;
    }

    const [field, operation, value] = conditionParts(part);

    if (isFilterOperation(operation) && sameField(field, column) && kindOf(operation) === kind) {
      return [operation, value];
    }
  }

  return undefined;
};

/** A coluna tem alguma condição no nível de cima (ícone de funil ativo)? */
export const hasColumnCondition = (expression: GridFilterExpression | null | undefined, column: GridColumnDef): boolean =>
  splitConjuncts(expression).some(part => isFilterCondition(part) && sameField(conditionParts(part)[0], column));

/**
 * Troca a condição da coluna (do `kind`) por `condition` — ou só tira, com
 * `null`. O resto da expressão fica como estava. Devolve uma expressão nova
 * (`null` se ficou vazia); nunca muta a de entrada.
 */
export const replaceColumnCondition = (
  expression: GridFilterExpression | null | undefined,
  column: GridColumnDef,
  kind: ColumnFilterKind | 'all',
  condition: GridFilterCondition | null,
): GridFilterExpression | null => {
  const parts = splitConjuncts(expression).filter(part => {
    if (!isFilterCondition(part)) {
      return true;
    }

    const [field, operation] = conditionParts(part);

    return !sameField(field, column) || (kind !== 'all' && isFilterOperation(operation) && kindOf(operation) !== kind);
  });

  if (condition) {
    parts.push(condition);
  }

  return combineFilters(...parts);
};

/** Cópia profunda dos arrays da expressão (colunas e valores não-array ficam por referência). */
export const cloneExpression = <T>(expression: T): T =>
  Array.isArray(expression) ? expression.map(cloneExpression) as T : expression;
