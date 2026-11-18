import { html, isServer, noChange, nothing, type TemplateResult } from 'lit';
import { AsyncDirective } from 'lit/async-directive.js';
import { type ChildPart, directive, type PartInfo, PartType } from 'lit/directive.js';

import { demoteRendererContent } from '../features/cell-content-focus.js';
import type { GridRenderResult } from '../grid-column-def.js';

/** O que o grid passa para cada conteúdo de renderer. */
export interface RendererContent {
  /** Elemento hospedeiro (o `<u-grid>`): o ramo `HTMLElement` vai para o light DOM dele. */
  host: HTMLElement;
  /** Nome do slot do ramo `HTMLElement`, estável pela identidade (chave da linha, id da coluna). */
  slotName: string;
  /** Rodar o renderer de novo só quando algum destes muda (comparação `===`, posição a posição). */
  deps: readonly unknown[];
  /** Função do hospedeiro (identidade do aviso de erro, uma vez por função). */
  renderer: (...args: never[]) => unknown;
  /** Chama o renderer; `signal()` cria o `AbortSignal` sob demanda. */
  invoke: (signal: () => AbortSignal) => GridRenderResult;
  /**
   * Tirar o conteúdo interativo da ordem de Tab (spec 17, A12; padrão).
   * `false` onde a célula não está na navegação (estado vazio): o Tab é o
   * único caminho até ele.
   */
  demote?: boolean;
}

/** Renderers que já lançaram (um `console.error` por função). */
const reported = new WeakSet();

const reportRendererError = (renderer: object, error: unknown): void => {
  if (!reported.has(renderer)) {
    reported.add(renderer);
    console.error('[u-grid] A renderer threw; the content was left empty.', error);
  }
};

/** O placeholder do ramo `HTMLElement` — o MESMO template no servidor e no cliente (hidratação). */
const slotTemplate = (name: string): TemplateResult => html`<slot name=${name}></slot>`;

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && typeof (value as Node).nodeType === 'number';

const sameDeps = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * Conteúdo de um renderer do hospedeiro (célula, cabeçalho, grupo, detalhe,
 * vazio). `TemplateResult`/texto vão direto na parte (shadow DOM do grid; no
 * SSR também). `HTMLElement` vai num `<div slot>` no light DOM do grid,
 * projetado pelo `<slot>` que fica na parte.
 *
 * Re-executa o renderer só quando `deps` mudam (ou a parte volta a ser
 * conectada). Ao descartar o conteúdo (deps novas, parte removida da janela
 * virtual, grid desconectado) aborta o `signal` dado ao renderer e tira o
 * `div` do light DOM — nada fica retido pelo grid (spec 14).
 */
class RendererContentDirective extends AsyncDirective {
  #deps: readonly unknown[] | undefined;
  #args: RendererContent | undefined;
  #controller: AbortController | undefined;
  #container: HTMLElement | undefined;
  #part: ChildPart | undefined;

  constructor(partInfo: PartInfo) {
    super(partInfo);

    if (partInfo.type !== PartType.CHILD) {
      throw new Error('rendererContent() só pode ser usado como conteúdo.');
    }
  }

  /** SSR (o `@lit-labs/ssr` só chama `render`). */
  render(args: RendererContent): unknown {
    return this.#produce(args, isServer);
  }

  override update(part: ChildPart, [args]: [RendererContent]): unknown {
    this.#args = args;
    this.#part = part;

    if (this.#deps && sameDeps(this.#deps, args.deps)) {
      // O `div` do ramo `HTMLElement` pode ter ficado para trás se o
      // hospedeiro mexeu nos filhos do grid (framework reconciliando).
      if (this.#container && this.#container.parentNode !== args.host) {
        args.host.appendChild(this.#container);
      }

      return noChange;
    }

    this.#release();
    this.#deps = args.deps;

    const value = this.#produce(args, false);

    if (args.demote !== false) {
      this.#demoteAfterCommit();
    }

    return value;
  }

  /**
   * Um ponto de Tab por grid (spec 17, A12): o conteúdo interativo do
   * template sai da ordem de Tab depois que o Lit o põe na parte (Enter/F2
   * entram nele). O ramo `HTMLElement` é rebaixado ao ser montado.
   */
  #demoteAfterCommit(): void {
    queueMicrotask(() => {
      const part = this.#part;

      if (!this.isConnected || !part?.startNode) {
        return;
      }

      for (let node = part.startNode.nextSibling; node && node !== part.endNode; node = node.nextSibling) {
        if (node instanceof Element) {
          demoteRendererContent(node);
        }
      }
    });
  }

  #produce(args: RendererContent, server: boolean): unknown {
    let result: GridRenderResult;

    try {
      result = args.invoke(() => (this.#controller ??= new AbortController()).signal);
    } catch (error) {
      if (server) {
        // Renderer que monta DOM (sem `document` no servidor): o cliente o
        // roda de novo na hidratação, no ramo do slot.
        return slotTemplate(args.slotName);
      }

      reportRendererError(args.renderer, error);
      return nothing;
    }

    if (result === null || result === undefined || result === nothing) {
      return nothing;
    }

    if (isNode(result)) {
      if (server) {
        return slotTemplate(args.slotName);
      }

      const container = this.#container ??= args.host.ownerDocument.createElement('div');

      container.slot = args.slotName;
      container.replaceChildren(result);

      if (args.demote !== false) {
        demoteRendererContent(result);
      }

      if (container.parentNode !== args.host) {
        args.host.appendChild(container);
      }

      return slotTemplate(args.slotName);
    }

    return result;
  }

  /** Descarta o conteúdo atual: aborta o `signal` e tira o `div` do light DOM. */
  #release(): void {
    this.#controller?.abort();
    this.#controller = undefined;
    this.#container?.remove();
    this.#container = undefined;
    this.#deps = undefined;
  }

  protected override disconnected(): void {
    this.#release();
  }

  protected override reconnected(): void {
    // Grid movido no DOM (ou linha reconectada): o conteúdo foi descartado no
    // `disconnected`; renderiza de novo.
    const args = this.#args;

    if (args) {
      this.#deps = args.deps;
      this.setValue(this.#produce(args, false));

      if (args.demote !== false) {
        this.#demoteAfterCommit();
      }
    }
  }
}

export const rendererContent = directive(RendererContentDirective);
