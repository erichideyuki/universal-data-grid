import type { GridColumnDef } from '../grid-column-def.js';
import { createComparer } from '../row-model/compare.js';
import { compileFilter, filterItems } from '../row-model/filter.js';
import { buildGroups } from '../row-model/group.js';
import { sortItems } from '../row-model/sort.js';
import { summarize, type SummarySpec } from '../row-model/summary.js';
import { getValueByPath } from '../row-model/value.js';
import type {
  GridDataSource,
  GridLoadGroupResult,
  GridLoadOptions,
  GridLoadResult,
  GridLoadSummary,
} from './data-source.js';

/**
 * Fonte de dados sobre um array, no mesmo contrato da remota: aplica
 * `filter`, `groupPath`, `sort`, `group`, resumos e `skip`/`take` com as
 * funções do row model. É a referência executável do contrato (o "servidor"
 * dos testes) e mostra ao hospedeiro o que cada campo de `GridLoadOptions`
 * significa. Não muta o array.
 */
export class LocalDataSource<TItem = unknown> implements GridDataSource<TItem> {
  readonly #items: readonly TItem[];
  readonly #columns = new Map<string, GridColumnDef>();
  readonly #language: string | undefined;

  constructor(items: readonly TItem[], options: { language?: string } = {}) {
    this.#items = items;
    this.#language = options.language;
  }

  #column(path: string): GridColumnDef {
    let column = this.#columns.get(path);

    if (!column) {
      column = { path };
      this.#columns.set(path, column);
    }

    return column;
  }

  #summaries(list: readonly GridLoadSummary[]): SummarySpec[] {
    return list.map(({ path, type }) => ({ column: this.#column(path), type }));
  }

  load(options: GridLoadOptions, signal?: AbortSignal): Promise<GridLoadResult<TItem>> {
    signal?.throwIfAborted();
    return Promise.resolve(this.query(options));
  }

  /** O mesmo de `load`, síncrono. */
  query(options: GridLoadOptions): GridLoadResult<TItem> {
    let items = this.#items;

    const predicate = compileFilter(options.filter, {
      language: this.#language,
      columns: [],
      dataTypeOf: () => undefined,
      textOf: (item, column) => {
        const value = getValueByPath(item, column.path);
        return value === null || value === undefined ? '' : String(value);
      },
    });

    items = filterItems(items, predicate);

    const groupPath = options.groupPath ?? [];
    const levels = options.group;

    if (groupPath.length) {
      items = items.filter(item => groupPath.every((value, level) =>
        sameValue(getValueByPath(item, levels[level]?.path), value)));
    }

    items = sortItems(items, options.sort.map(({ path, order }) => ({ column: this.#column(path), order })), this.#language);

    const result: GridLoadResult<TItem> = { data: [] };
    const level = groupPath.length;

    if (options.requireTotalCount) {
      result.totalCount = items.length;
    }

    if (options.totalSummary.length) {
      result.summary = summarize(items, this.#summaries(options.totalSummary));
    }

    if (level < levels.length) {
      const { path, order } = levels[level];
      const nodes = buildGroups(
        items,
        [this.#column(path)],
        () => createComparer(this.#language),
        [order],
        this.#summaries(options.groupSummary),
      );
      const groups: GridLoadGroupResult<TItem>[] = nodes.map(node => ({
        key: node.value,
        count: node.items.length,
        items: null,
        summary: options.groupSummary.length ? node.summaries : undefined,
      }));

      if (options.requireGroupCount) {
        result.groupCount = groups.length;
      }

      result.data = slice(groups, options.skip, options.take);
      return result;
    }

    result.data = slice(items, options.skip, options.take);
    return result;
  }
}

const slice = <T>(list: readonly T[], skip = 0, take?: number): readonly T[] =>
  skip || take !== undefined ? list.slice(skip, take === undefined ? undefined : skip + take) : list;

/** Igualdade exata do `groupPath` (datas pelo tempo; `null` e `undefined` são o grupo vazio). */
export const sameValue = (a: unknown, b: unknown): boolean => {
  if (a === null || a === undefined) {
    return b === null || b === undefined;
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  return Object.is(a, b);
};
