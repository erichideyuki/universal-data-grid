/**
 * Contrato entre o site e os exemplos.
 *
 * - Página: `docs/pages/<id>.ts`, `export default { ... } satisfies DocPage`.
 * - Exemplo: `docs/examples/<página>/<exemplo>.ts`, com `export const meta`
 *   (`ExampleMeta`) e `export default` uma função `mount(host)` que monta a
 *   demo dentro de `host` e devolve a limpeza (timers, listeners globais).
 *   O site chama a limpeza e esvazia `host` ao sair da página — nada pode
 *   continuar vivo depois (regra de memória do projeto).
 *
 * Textos de `intro`/`description` aceitam só `code` e **negrito**.
 */
export interface DocPage {
  title: string;
  /** Uma ou duas frases no topo da página. */
  intro: string;
  /** Âncora da seção no API.md, a referência completa (`#sorting`). */
  readme?: string;
  /** Ids dos exemplos, na ordem (arquivos em `docs/examples/<página>/`). */
  examples: readonly string[];
}

export interface ExampleMeta {
  title: string;
  description: string;
}

export type ExampleCleanup = () => void;

export type ExampleMount = (host: HTMLElement) => ExampleCleanup | void | Promise<ExampleCleanup | void>;
