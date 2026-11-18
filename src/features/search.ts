import { html, nothing, type ReactiveController, type ReactiveControllerHost, type TemplateResult } from 'lit';
import { live } from 'lit/directives/live.js';
import { map } from 'lit/directives/map.js';

import type { GridI18n } from '../grid-i18n.js';
import { splitMatches } from '../row-model/fold.js';

/** Espera da digitação antes de aplicar (linha de filtro e busca). */
export const FILTER_DEBOUNCE_MS = 300;

/**
 * Timers de digitação por chave, todos soltos no `hostDisconnected` (spec
 * 14): um grid removido no meio da digitação não fica preso a um timer.
 */
export class Debouncer<K> implements ReactiveController {
  readonly #timers = new Map<K, ReturnType<typeof setTimeout>>();

  constructor(host: ReactiveControllerHost) {
    host.addController(this);
  }

  get size(): number {
    return this.#timers.size;
  }

  has(key: K): boolean {
    return this.#timers.has(key);
  }

  run(key: K, callback: () => void, delay = FILTER_DEBOUNCE_MS): void {
    this.cancel(key);
    this.#timers.set(key, setTimeout(() => {
      this.#timers.delete(key);
      callback();
    }, delay));
  }

  /** Executa agora o que estava esperando (Enter). */
  cancel(key: K): void {
    const timer = this.#timers.get(key);

    if (timer !== undefined) {
      clearTimeout(timer);
      this.#timers.delete(key);
    }
  }

  clear(): void {
    this.#timers.forEach(timer => clearTimeout(timer));
    this.#timers.clear();
  }

  hostDisconnected(): void {
    this.clear();
  }
}

export interface SearchHost extends ReactiveControllerHost {
  readonly searchText: string;
  _userSearch(text: string): void;
}

/** Campo de busca: aplica 300 ms depois da última tecla, ou já no Enter. */
export class SearchController implements ReactiveController {
  readonly #host: SearchHost;
  readonly #debouncer: Debouncer<'search'>;
  /** Texto digitado ainda não aplicado (o campo mostra ele, não `searchText`). */
  #draft: string | undefined;

  constructor(host: SearchHost) {
    this.#host = host;
    this.#debouncer = new Debouncer(host);
    host.addController(this);
  }

  get timers(): number {
    return this.#debouncer.size;
  }

  get value(): string {
    return this.#draft ?? this.#host.searchText;
  }

  readonly onInput = (event: Event): void => {
    const text = (event.target as HTMLInputElement).value;

    this.#draft = text;
    this.#debouncer.run('search', () => this.#apply(text));
  };

  readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter') {
      this.#debouncer.cancel('search');
      this.#apply((event.target as HTMLInputElement).value);
    }
  };

  #apply(text: string): void {
    this.#draft = undefined;
    this.#host._userSearch(text);
  }

  /** Mudança por API: descarta o texto digitado e o timer pendente. */
  discardDraft(): void {
    this.#debouncer.cancel('search');
    this.#draft = undefined;
  }

  hostDisconnected(): void {
    this.#draft = undefined;
  }
}

// Ícone Material Symbols (Apache 2.0): search.
const SEARCH_PATH = 'M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-'
  + '38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z';

const searchIcon = html`
  <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" height="1.25em" width="1.25em" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
    <path d=${SEARCH_PATH}/>
  </svg>`;

/** Ícone de lupa (compartilhado com o botão de operador `contains`). */
export { searchIcon };

export const renderSearchPanel = (controller: SearchController, translation: GridI18n): TemplateResult => html`
  <label class="search-panel">
    ${searchIcon}
    <input
      class="search-input"
      part="search-input"
      type="search"
      autocomplete="off"
      spellcheck="false"
      placeholder=${translation.searchPlaceholder}
      aria-label=${translation.searchPlaceholder}
      .value=${live(controller.value)}
      @input=${controller.onInput}
      @keydown=${controller.onKeyDown}>
  </label>`;

/**
 * Texto com os trechos da busca em `<mark>` — tudo por binding de texto do
 * Lit (nada de HTML do usuário).
 */
export const renderHighlighted = (text: string, matcher: RegExp | null): TemplateResult | string => {
  const parts = splitMatches(text, matcher);

  if (parts.length === 1) {
    return text;
  }

  return html`${map(parts, (part, index) => index % 2
    ? html`<mark class="search-highlight" part="search-highlight">${part}</mark>`
    : part || nothing)}`;
};
