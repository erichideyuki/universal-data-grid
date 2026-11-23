import type { ReactiveController, ReactiveControllerHost } from 'lit';

/** Faixas do eixo `block` (spec 30) presentes no render atual. */
export interface HorizontalBands {
  /** Faixa do corpo: a única rolagem horizontal nativa. */
  body: HTMLElement | null | undefined;
  /** Tabela do corpo: a largura dela dá o espaçador da barra própria. */
  table: HTMLElement | null | undefined;
  /** Faixa do cabeçalho (`overflow-x: hidden`). */
  head: HTMLElement | null | undefined;
  /** Faixas das linhas fixas de cima e de baixo. */
  fixedTop?: HTMLElement | null | undefined;
  fixedBottom?: HTMLElement | null | undefined;
  /** Faixa dos totais. */
  foot: HTMLElement | null | undefined;
  /** Barra horizontal própria (no rodapé grudado) e o espaçador dela. */
  bar: HTMLElement | null | undefined;
  spacer: HTMLElement | null | undefined;
}

export interface HorizontalSyncCallbacks {
  /** O `scrollLeft` do corpo mudou (janela de colunas, sombras). */
  scrolled: () => void;
  /** O corpo, a tabela dele ou a barra mudaram de tamanho (a barra pode ter aparecido/sumido). */
  resized: () => void;
}

type Slot = Exclude<keyof HorizontalBands, 'table' | 'spacer'>;

/** Linhas por "linha" de roda (`deltaMode` 1) e px por página (`deltaMode` 2: a largura do corpo). */
const LINE_PIXELS = 40;

/**
 * Rolagem horizontal das faixas do eixo `block` (spec 30): o corpo rola
 * nativo; cabeçalho, rodapé e a barra própria copiam o `scrollLeft` dele
 * e, nos dois sentidos, repassam ao corpo o que o navegador rolar neles
 * (`focus()`, Ctrl+F, cursor num campo, arrastar a barra). Roda horizontal
 * (ou Shift+roda) sobre cabeçalho/rodapé vai para o corpo. Tudo (listeners e
 * o `ResizeObserver`) é solto ao trocar de faixa e no `hostDisconnected`
 * (spec 14).
 */
export class HorizontalSyncController implements ReactiveController {
  readonly #callbacks: HorizontalSyncCallbacks;
  readonly #bound = new Map<Slot, { element: HTMLElement; abort: AbortController }>();
  /** Último valor que escrevemos em cada faixa: o `scroll` que volta com ele é eco. */
  readonly #expected = new WeakMap<HTMLElement, number>();
  #table: HTMLElement | null = null;
  #spacer: HTMLElement | null = null;
  #resizeObserver: ResizeObserver | undefined;
  /** Medida adiada para o próximo quadro (fora do callback do `ResizeObserver`). */
  #frame = 0;
  #overflow = false;

  constructor(host: ReactiveControllerHost, callbacks: HorizontalSyncCallbacks) {
    this.#callbacks = callbacks;
    host.addController(this);
  }

  hostDisconnected(): void {
    this.detach();
  }

  /** Faixa do corpo ligada agora (`null` fora do eixo `block`). */
  get body(): HTMLElement | null {
    return this.#bound.get('body')?.element ?? null;
  }

  /** O corpo transborda na horizontal (a barra própria aparece). */
  get overflow(): boolean {
    return this.#overflow;
  }

  /** Listeners ligados agora (diagnóstico, spec 14). */
  get listeners(): number {
    return this.#bound.size + (this.#resizeObserver ? 1 : 0) + (this.#frame ? 1 : 0);
  }

  /** Liga às faixas do render atual; só refaz o que mudou. */
  attach(bands: HorizontalBands): void {
    const slots: Slot[] = ['body', 'head', 'fixedTop', 'fixedBottom', 'foot', 'bar'];

    if (!bands.body) {
      this.detach();
      return;
    }

    for (const slot of slots) {
      const element = bands[slot] ?? null;
      const current = this.#bound.get(slot);

      if (current?.element === element) {
        continue;
      }

      current?.abort.abort();
      this.#bound.delete(slot);

      if (element) {
        const abort = new AbortController();
        element.addEventListener('scroll', this.#onScroll, { passive: true, signal: abort.signal });

        // Faixas além do corpo: a roda horizontal vai ao corpo (que leva as outras junto).
        if (slot !== 'body' && slot !== 'bar') {
          element.addEventListener('wheel', this.#onWheel, { passive: false, signal: abort.signal });
        }

        this.#bound.set(slot, { element, abort });
        // Faixa nova (o cabeçalho voltou, os totais apareceram): entra na posição do corpo.
        this.#align(element);
      }
    }

    this.#spacer = bands.spacer ?? null;
    this.#observe(bands.body, bands.table ?? null);
  }

  /** Solta tudo (fora do eixo `block`, desconexão). */
  detach(): void {
    for (const { abort } of this.#bound.values()) {
      abort.abort();
    }

    this.#bound.clear();
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = undefined;
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    this.#table = null;
    this.#spacer = null;
    this.#overflow = false;
  }

  /**
   * Copia o `scrollLeft` de `source` (o corpo, ou uma faixa que o navegador
   * rolou) para o corpo e daí para as outras, já — sem esperar o `scroll`.
   */
  syncFrom(source: HTMLElement): void {
    const body = this.body;

    if (!body) {
      return;
    }

    if (source !== body) {
      this.#write(body, source.scrollLeft);
    }

    for (const { element } of this.#bound.values()) {
      if (element !== body && element !== source) {
        this.#write(element, body.scrollLeft);
      }
    }

    // A faixa que puxou pode passar do fim do corpo (larguras diferentes num quadro): volta junto.
    if (source !== body && Math.abs(source.scrollLeft - body.scrollLeft) >= 1) {
      this.#write(source, body.scrollLeft);
    }

    this.#callbacks.scrolled();
  }

  /** Mede de novo a barra própria (largura da tabela e se transborda). */
  measure(): void {
    const body = this.body;

    if (!body) {
      return;
    }

    const width = this.#table?.offsetWidth ?? body.scrollWidth;
    const overflow = body.scrollWidth > body.clientWidth + 1;
    const bar = this.#bound.get('bar')?.element;

    if (this.#spacer) {
      this.#spacer.style.inlineSize = `${width}px`;
    }

    if (bar?.hidden === overflow) {
      bar.hidden = !overflow;
    }

    this.#overflow = overflow;

    for (const { element } of this.#bound.values()) {
      if (element !== body) {
        this.#align(element);
      }
    }
  }

  #align(element: HTMLElement): void {
    const body = this.body;

    if (body && element !== body && Math.abs(element.scrollLeft - body.scrollLeft) >= 1) {
      this.#write(element, body.scrollLeft);
    }
  }

  #write(element: HTMLElement, value: number): void {
    element.scrollLeft = value;
    // O navegador prende o valor ao intervalo da faixa: o eco vem com o valor lido.
    this.#expected.set(element, element.scrollLeft);
  }

  #observe(body: HTMLElement, table: HTMLElement | null): void {
    if (typeof ResizeObserver === 'undefined') {
      this.#table = table;
      this.measure();
      return;
    }

    // Mostrar/ocultar a barra muda a altura do grid (observado pelo próprio grid): a escrita vai
    // para o próximo quadro, senão o navegador acusa "ResizeObserver loop".
    this.#resizeObserver ??= new ResizeObserver(() => {
      if (!this.#frame) {
        this.#frame = requestAnimationFrame(() => {
          this.#frame = 0;
          this.measure();
          this.#callbacks.resized();
        });
      }
    });

    // Sem saber o que já estava observado: reobservar o mesmo elemento é inócuo.
    if (this.#table !== table) {
      if (this.#table) {
        this.#resizeObserver.unobserve(this.#table);
      }

      if (table) {
        this.#resizeObserver.observe(table);
      }

      this.#table = table;
    }

    this.#resizeObserver.observe(body);
  }

  readonly #onScroll = (event: Event): void => {
    const source = event.currentTarget as HTMLElement;
    const expected = this.#expected.get(source);

    if (expected !== undefined) {
      this.#expected.delete(source);

      // Eco da nossa própria escrita: nada a repassar.
      if (Math.abs(expected - source.scrollLeft) < 1) {
        return;
      }
    }

    this.syncFrom(source);
  };

  readonly #onWheel = (event: WheelEvent): void => {
    const body = this.body;
    // Shift+roda: o Chromium no Windows já troca o eixo; outros mandam `deltaY`.
    const delta = event.deltaX || (event.shiftKey ? event.deltaY : 0);

    if (!body || !delta || event.ctrlKey) {
      return;
    }

    const scale = event.deltaMode === 1 ? LINE_PIXELS : event.deltaMode === 2 ? body.clientWidth : 1;
    event.preventDefault();
    this.#write(body, body.scrollLeft + delta * scale);
    this.syncFrom(body);
  };
}
