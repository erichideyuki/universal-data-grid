/**
 * Acesso ao `localStorage`/`sessionStorage` do estado do grid (frente 11).
 *
 * Tudo dentro de `try`: o acesso pode lançar (iframe isolado, modo privado,
 * cota cheia) e o conteúdo é controlável pelo usuário e por extensões —
 * `JSON.parse` só aqui, nunca `eval`, e o resultado ainda passa por
 * `parseGridState` antes de valer.
 */
import type { GridStateStorage } from './grid-state.js';

/** Storage do navegador escolhido por `state-storage`. */
export type WebStorageKind = 'local' | 'session';

/** Configuração resolvida de `stateStorage` + `stateStorageKey`. */
export type StorageConfig =
  | { kind: WebStorageKind; key: string }
  | { kind: 'custom'; storage: GridStateStorage };

/**
 * Resolve `stateStorage`/`stateStorageKey`; `undefined` = desligado.
 * `warn` recebe o motivo quando a configuração é inválida.
 */
export const resolveStorage = (
  value: unknown,
  key: string | null | undefined,
  warn: (message: string) => void,
): StorageConfig | undefined => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  if (value === 'local' || value === 'session') {
    if (!key) {
      warn(`state-storage="${value}" needs a "state-storage-key"; state storing is off.`);
      return undefined;
    }

    return { kind: value, key };
  }

  if (typeof value === 'object') {
    const storage = value as Partial<GridStateStorage>;

    if (typeof storage.load === 'function' && typeof storage.save === 'function') {
      return { kind: 'custom', storage: value as GridStateStorage };
    }
  }

  warn('"stateStorage" must be "local", "session" or an object with load() and save(); state storing is off.');
  return undefined;
};

const webStorage = (kind: WebStorageKind): Storage | undefined => {
  // `window.localStorage` lança SecurityError em iframes isolados (quem chama está num `try`).
  if (typeof window === 'undefined') {
    return undefined;
  }

  const storage: unknown = kind === 'local' ? window.localStorage : window.sessionStorage;
  return storage ? storage as Storage : undefined;
};

/** Lê e analisa o JSON guardado; `{ value: null }` = nada guardado. */
export const readWebStorage = (kind: WebStorageKind, key: string): { value: unknown } | { error: string } => {
  let text: string | null;

  try {
    text = webStorage(kind)?.getItem(key) ?? null;
  } catch (error) {
    return { error: `could not read the ${kind} storage (${String(error)})` };
  }

  if (text === null) {
    return { value: null };
  }

  try {
    return { value: JSON.parse(text) as unknown };
  } catch {
    return { error: 'the saved state is not valid JSON' };
  }
};

/** Grava o texto; devolve o motivo da falha (cota, acesso negado). */
export const writeWebStorage = (kind: WebStorageKind, key: string, text: string): string | undefined => {
  try {
    webStorage(kind)?.setItem(key, text);
    return undefined;
  } catch (error) {
    return `could not write the ${kind} storage (${String(error)})`;
  }
};
