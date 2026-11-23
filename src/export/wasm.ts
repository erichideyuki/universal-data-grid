/**
 * Carregamento dos motores WebAssembly da exportação (PDF, spec 26; xlsx,
 * spec 29): compila o `.wasm` uma vez por URL, com `compileStreaming` quando
 * o servidor manda `application/wasm`. Sem imports do grid.
 */

/** Módulos compilados por URL (uma ou duas entradas na prática). */
const compiled = new Map<string, Promise<WebAssembly.Module>>();

/** `file:` no Node (o `fetch` do Node não lê `file:`). O especificador fica numa variável para os bundlers não o seguirem. */
export const readFileUrl = async (url: string): Promise<Uint8Array> => {
  const specifier = 'node:fs/promises';
  const fs = await import(/* @vite-ignore */ specifier) as { readFile(path: URL): Promise<Uint8Array> };
  return new Uint8Array(await fs.readFile(new URL(url)));
};

/** Compila o `.wasm` (uma vez por URL). */
export const compileEngine = (url: string): Promise<WebAssembly.Module> => {
  let module = compiled.get(url);

  if (!module) {
    module = (async () => {
      if (url.startsWith('file:')) {
        return WebAssembly.compile((await readFileUrl(url)) as Uint8Array<ArrayBuffer>);
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`could not load ${url} (${response.status})`);
      }

      return typeof WebAssembly.compileStreaming === 'function' && response.headers.get('content-type')?.includes('wasm')
        ? WebAssembly.compileStreaming(response)
        : WebAssembly.compile(await response.arrayBuffer());
    })();
    module.catch(() => compiled.delete(url));
    compiled.set(url, module);
  }

  return module;
};
