import type { ReactiveController, ReactiveControllerHost } from 'lit';

import type { GridColumnDef, GridFilterExpression } from '../grid-column-def.js';
import {
  cloneExpression,
  combineFilters,
  compileFilter,
  type FilterContext,
  FilterExpressionError,
  type FilterPredicate,
  filterMask,
  searchExpression,
} from '../row-model/filter.js';

/**
 * Acima disto o filtro roda em fatias entre quadros (a digitação continua
 * fluindo); abaixo, de uma vez (100 mil linhas filtram em bem menos de
 * 100 ms numa máquina comum).
 */
export const SYNC_FILTER_LIMIT = 200_000;

/** Tempo máximo de cada fatia antes de devolver a vez ao navegador. */
const SLICE_MS = 8;
/** Linhas entre cada consulta ao relógio dentro da fatia. */
const CLOCK_EVERY = 2048;

export interface FilteringHost extends ReactiveControllerHost {
  /** Contexto do avaliador (colunas, tipos, texto exibido) no estado atual. */
  _filterContext(): FilterContext;
  /** Colunas em que a busca procura (visíveis e filtráveis). */
  _searchColumns(): GridColumnDef[];
}

/** Congela os arrays da cópia interna (o getter devolve ela sem copiar de novo). */
const freezeExpression = <T>(expression: T): T => {
  if (Array.isArray(expression)) {
    expression.forEach(freezeExpression);
    Object.freeze(expression);
  }

  return expression;
};

/** Iguais em estrutura (as expressões são arrays de primitivos e listas). */
export const sameExpression = (a: unknown, b: unknown): boolean => {
  if (a === b) {
    return true;
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }

  return a.every((entry, index) => sameExpression(entry, b[index]));
};

/**
 * Estado do filtro (`filterValue` + `searchText`) e a máscara de linhas que
 * passam, alinhada a `items`. A máscara é recalculada quando o filtro, os
 * itens, as colunas ou o idioma mudam; mudanças de filtro em listas grandes
 * rodam em fatias (`MessageChannel`) e a anterior segue na tela até a nova
 * terminar. Timer e trabalho pendente são soltos no `hostDisconnected`.
 */
export class FilteringController implements ReactiveController {
  readonly #host: FilteringHost;
  #filterValue: GridFilterExpression | null = null;
  #searchText = '';

  /** Máscara válida para `#maskItems` (`null` = sem filtro). */
  #mask: Uint8Array | null = null;
  #maskItems: readonly unknown[] | null = null;
  #dirty = true;
  /** Itens/colunas/idioma mudaram: a máscara velha não vale nem provisoriamente. */
  #invalid = true;
  #job: { channel: MessageChannel; resolve: () => void; promise: Promise<void> } | undefined;
  #warnedInvalid = false;
  /** Avisado quando uma fatia termina (o grid refaz as linhas). */
  onCommit: (() => void) | undefined;

  constructor(host: FilteringHost) {
    this.#host = host;
    host.addController(this);
  }

  get filterValue(): GridFilterExpression | null {
    return this.#filterValue;
  }

  get searchText(): string {
    return this.#searchText;
  }

  /** Troca o estado; devolve se mudou. Copia a expressão (nunca guarda a do hospedeiro). */
  set(filterValue: GridFilterExpression | null | undefined, searchText: string | null | undefined): boolean {
    const nextValue = filterValue?.length ? freezeExpression(cloneExpression(filterValue)) : null;
    const nextSearch = searchText ?? '';

    if (sameExpression(nextValue, this.#filterValue) && nextSearch === this.#searchText) {
      return false;
    }

    this.#filterValue = nextValue;
    this.#searchText = nextSearch;
    this.#warnedInvalid = false;
    this.#dirty = true;
    this.#host.requestUpdate();

    return true;
  }

  /** Itens, colunas (path/valor/visibilidade) ou idioma mudaram. */
  invalidate(): void {
    this.#dirty = true;
    this.#invalid = true;
  }

  /** A busca procura nas colunas visíveis: mudou o conjunto, refaz. */
  searchColumnsChanged(): void {
    if (this.#searchText.trim()) {
      this.invalidate();
    }
  }

  get active(): boolean {
    return !!this.#filterValue || !!this.#searchText.trim();
  }

  /** `filterValue` `and` busca (cópia; o que a frente 08 manda ao servidor). */
  combined(): GridFilterExpression | null {
    return cloneExpression(combineFilters(this.#filterValue, searchExpression(this.#searchText, this.#host._searchColumns())));
  }

  /** Há uma fatia em andamento (`updateComplete` espera por ela). */
  get pending(): Promise<void> | undefined {
    return this.#job?.promise;
  }

  /**
   * Máscara atual para `items`. Pode devolver a anterior enquanto uma
   * filtragem em fatias corre (`stale`). `null` = sem filtro.
   */
  maskFor(items: readonly unknown[]): Uint8Array | null {
    if (!this.#dirty && this.#maskItems === items) {
      return this.#mask;
    }

    if (this.#maskItems !== items) {
      this.#invalid = true;
    }

    this.#dirty = false;
    this.#cancelJob();

    const predicate = this.#compile();

    if (!predicate) {
      this.#setMask(null, items);
      return null;
    }

    if (items.length <= SYNC_FILTER_LIMIT || this.#invalid) {
      this.#setMask(filterMask(items, predicate), items);
      return this.#mask;
    }

    this.#startJob(items, predicate);

    return this.#mask;
  }

  hostDisconnected(): void {
    this.#cancelJob();
    // Volta a calcular ao reconectar (a fatia cancelada não terminou).
    this.#dirty = true;
  }

  #setMask(mask: Uint8Array | null, items: readonly unknown[]): void {
    this.#mask = mask;
    this.#maskItems = items;
    this.#invalid = false;
  }

  #compile(): FilterPredicate | null {
    const expression = combineFilters(this.#filterValue, searchExpression(this.#searchText, this.#host._searchColumns()));

    try {
      return compileFilter(expression, this.#host._filterContext());
    } catch (error) {
      if (!(error instanceof FilterExpressionError)) {
        throw error;
      }

      if (!this.#warnedInvalid) {
        this.#warnedInvalid = true;
        console.warn(`<u-grid>: invalid filterValue ignored. ${error.message}`);
      }

      return null;
    }
  }

  #startJob(items: readonly unknown[], predicate: FilterPredicate): void {
    const mask = new Uint8Array(items.length);
    let resolve!: () => void;
    const promise = new Promise<void>(done => {
      resolve = done;
    });
    // MessageChannel e não `setTimeout(0)`: timers aninhados esperam ≥ 4 ms
    // cada (um terço do tempo parado entre fatias de 8 ms).
    const channel = new MessageChannel();
    const job = { channel, resolve, promise };
    let index = 0;

    const slice = () => {
      if (this.#job !== job) {
        return;
      }

      const start = performance.now();

      while (index < items.length) {
        const end = Math.min(items.length, index + CLOCK_EVERY);

        filterMask(items, predicate, mask, index, end);
        index = end;

        if (performance.now() - start > SLICE_MS) {
          break;
        }
      }

      if (index < items.length) {
        channel.port2.postMessage(null);
        return;
      }

      channel.port1.close();
      this.#job = undefined;
      this.#setMask(mask, items);
      this.onCommit?.();
      this.#host.requestUpdate();
      resolve();
    };

    this.#job = job;
    channel.port1.onmessage = slice;
    channel.port2.postMessage(null);
  }

  #cancelJob(): void {
    const job = this.#job;

    if (!job) {
      return;
    }

    this.#job = undefined;
    job.channel.port1.close();
    job.resolve();
  }
}
