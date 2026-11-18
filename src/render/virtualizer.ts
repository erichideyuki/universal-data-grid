/* eslint-disable no-bitwise -- árvore de Fenwick: `i & -i` é o bit menos significativo. */
import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * Altura física máxima do corpo rolável. Navegadores limitam a altura de um
 * elemento (Chromium ~33,5 M px, Firefox ~17,9 M px): acima disso a lista é
 * ESCALADA (ver {@link RowVirtualizer}). 15 M px ≈ 312 mil linhas de 48 px.
 */
export const MAX_SCROLL_HEIGHT = 15_000_000;

/** Linhas renderizadas antes de conhecer a altura da janela (1º render, SSR). */
export const INITIAL_RENDER_ROWS = 30;

export interface VirtualWindow {
  /** 1ª linha renderizada. */
  first: number;
  /** Fim (exclusivo). */
  end: number;
  /** Deslocamento (px, coordenadas FÍSICAS do corpo) da 1ª linha renderizada. */
  offset: number;
}

export interface RowVirtualizerOptions {
  getScrollElement: () => HTMLElement | null;
  /** Altura estimada (e, sem `wrap`, exata) de cada linha. */
  rowHeight: () => number;
  /** Linhas a mais acima e abaixo da janela. */
  overscan: number;
  /**
   * Onde começa o corpo (px, no conteúdo do contêiner rolável): o que vem
   * antes (barra, cabeçalho) não é linha. Lido na rolagem e no redimensionar.
   */
  getScrollMargin?: () => number;
  /** Altura do que fica grudado no topo por cima das linhas (cabeçalho `sticky`). */
  getStickyHeight?: () => number;
}

/**
 * Virtualizador de linhas do grid (spec 16), no lugar do
 * `@tanstack/lit-virtual`, cujo custo é O(linhas) a cada mudança (um objeto
 * de medida e uma chave por linha) e cuja altura passa do limite do
 * navegador acima de ~700 mil linhas.
 *
 * Altura fixa (sem `wrap`): tudo é aritmética, O(1) por linha da janela.
 * Alturas medidas (`wrap`): árvore de Fenwick com a altura de cada linha
 * (só existe nesse modo), O(log n) para posição ↔ índice.
 *
 * Linhas de altura própria (detalhe do master-detail, frente 10): camada
 * ESPARSA por cima das duas anteriores — índices crescentes e a diferença de
 * altura de cada uma numa árvore de Fenwick de k posições, O(log k). Sem
 * nenhuma, nada muda (altura fixa segue aritmética pura).
 *
 * Escala: com altura virtual acima de {@link MAX_SCROLL_HEIGHT}, o corpo
 * físico fica nesse limite. Saltos (arrastar a barra, Home/End) mapeiam a
 * posição física proporcionalmente; passos pequenos (roda, setas, Page
 * Up/Down: até uma janela) andam 1:1, para a leitura não pular linhas. O
 * começo e o fim físicos são sempre o começo e o fim da lista.
 */
export class RowVirtualizer implements ReactiveController {
  readonly #host: ReactiveControllerHost;
  readonly #options: RowVirtualizerOptions;

  #count = 0;
  #rowHeight = 0;
  /** Altura da janela visível; 0 até medir. */
  #viewport = 0;
  #margin = 0;
  /** Posição física (`scrollTop`) e virtual atuais. */
  #physical = 0;
  #virtual = 0;
  /** Posição virtual pedida por `scrollToIndex` para a próxima rolagem física. */
  #pending: { physical: number; virtual: number } | undefined;

  /** Alturas medidas (`wrap`): árvore de Fenwick (1-based) e altura por linha. */
  #tree: Float64Array | undefined;
  #sizes: Float64Array | undefined;
  #measured = 0;

  /**
   * Linhas de altura própria (esparsas): índices crescentes, altura de cada
   * uma e a árvore de Fenwick (1-based) da diferença para a altura base.
   */
  #variableIndices: Int32Array = new Int32Array(0);
  #variableSizes: Float64Array = new Float64Array(0);
  #variableTree: Float64Array | undefined;

  #scroller: HTMLElement | undefined;
  #resizeObserver: ResizeObserver | undefined;
  /** Janela do último render (para só pedir render quando ela muda). */
  #rendered: VirtualWindow | undefined;

  constructor(host: ReactiveControllerHost, options: RowVirtualizerOptions) {
    this.#host = host;
    this.#options = options;
    host.addController(this);
  }

  // --------------------------------------------------------------- ciclo

  hostConnected(): void {
    this.#attach();
  }

  hostUpdated(): void {
    this.#attach();
  }

  hostDisconnected(): void {
    this.#scroller?.removeEventListener('scroll', this.#onScroll);
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = undefined;
    this.#scroller = undefined;
  }

  #attach(): void {
    const scroller = this.#options.getScrollElement() ?? undefined;

    if (!scroller || scroller === this.#scroller) {
      return;
    }

    this.hostDisconnected();
    this.#scroller = scroller;
    scroller.addEventListener('scroll', this.#onScroll, { passive: true });

    if (typeof ResizeObserver !== 'undefined') {
      this.#resizeObserver = new ResizeObserver(() => {
        const viewport = scroller.clientHeight;

        const margin = this.#options.getScrollMargin?.() ?? 0;

        if (viewport !== this.#viewport || margin !== this.#margin) {
          this.#viewport = viewport;
          this.#margin = margin;
          this.#syncFromScroll(scroller.scrollTop);
          this.#host.requestUpdate();
        }
      });
      this.#resizeObserver.observe(scroller);
    }
  }

  // ------------------------------------------------------------- tamanhos

  /** Número de linhas. */
  get count(): number {
    return this.#count;
  }

  set count(count: number) {
    if (count === this.#count) {
      return;
    }

    this.#count = count;
    // Alturas medidas são por índice: com outras linhas, medir de novo.
    this.#dropSizes();
    this.#clamp();
  }

  /** Esquece as alturas medidas (troca de linhas, de `rowHeight`, de colunas). */
  measure(): void {
    this.#dropSizes();
    this.#clamp();
  }

  /** Quantas linhas têm altura medida diferente da estimada (diagnóstico, spec 14). */
  get measuredSizes(): number {
    return this.#measured;
  }

  /**
   * Linhas de altura própria (linhas de detalhe): `indices` crescentes e a
   * altura (estimada ou já medida) de cada uma. Substitui as anteriores — o
   * grid chama depois de refazer as linhas. Custo O(k).
   */
  setVariableRows(indices: Int32Array, sizes: Float64Array): void {
    this.#variableIndices = indices;
    this.#variableSizes = sizes;
    this.#rebuildVariableTree();
    this.#clamp();
  }

  /** Quantas linhas de altura própria há. */
  get variableRows(): number {
    return this.#variableIndices.length;
  }

  #rebuildVariableTree(): void {
    const count = this.#variableIndices.length;

    if (!count) {
      this.#variableTree = undefined;
      return;
    }

    const tree = new Float64Array(count + 1);

    for (let i = 1; i <= count; i++) {
      tree[i] += this.#variableSizes[i - 1] - this.#baseSize(this.#variableIndices[i - 1]);
      const parent = i + (i & -i);

      if (parent <= count) {
        tree[parent] += tree[i];
      }
    }

    this.#variableTree = tree;
  }

  /** Posição de `index` entre as linhas de altura própria (`-1` = não é uma). */
  #variableSlot(index: number): number {
    const indices = this.#variableIndices;
    const below = this.#variableBelow(index);

    return below < indices.length && indices[below] === index ? below : -1;
  }

  /** Quantas linhas de altura própria vêm antes de `index`. */
  #variableBelow(index: number): number {
    const indices = this.#variableIndices;
    let low = 0;
    let high = indices.length;

    while (low < high) {
      const middle = (low + high) >>> 1;

      if (indices[middle] < index) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }

    return low;
  }

  /** Soma das diferenças de altura das `slots` primeiras linhas de altura própria. */
  #variablePrefix(slots: number): number {
    const tree = this.#variableTree;

    if (!tree) {
      return 0;
    }

    let sum = 0;

    for (let i = slots; i > 0; i -= i & -i) {
      sum += tree[i];
    }

    return sum;
  }

  #setVariableSize(slot: number, size: number): void {
    const tree = this.#variableTree!;
    const delta = size - this.#variableSizes[slot];

    this.#variableSizes[slot] = size;

    for (let i = slot + 1; i < tree.length; i += i & -i) {
      tree[i] += delta;
    }
  }

  /** Altura virtual da lista inteira. */
  get virtualSize(): number {
    const base = this.#tree ? this.#prefix(this.#count) : this.#count * this.#height();

    return base + this.#variablePrefix(this.#variableIndices.length);
  }

  /** Altura do corpo físico (o que vai no estilo do `<tbody>`). */
  getTotalSize(): number {
    return Math.min(this.virtualSize, MAX_SCROLL_HEIGHT);
  }

  /** Início virtual da linha `index`. */
  startOf(index: number): number {
    const base = this.#tree ? this.#prefix(index) : index * this.#height();

    return this.#variableTree ? base + this.#variablePrefix(this.#variableBelow(index)) : base;
  }

  /** Altura base (fixa ou medida por `wrap`) da linha `index`. */
  #baseSize(index: number): number {
    return this.#sizes?.[index] ?? this.#height();
  }

  /** Altura da linha `index`. */
  sizeOf(index: number): number {
    if (this.#variableTree) {
      const slot = this.#variableSlot(index);

      if (slot >= 0) {
        return this.#variableSizes[slot];
      }
    }

    return this.#baseSize(index);
  }

  /**
   * Mede as linhas renderizadas (`data-index`): as de altura própria sempre;
   * as demais só com `all` (`wrap`). Devolve `true` se alguma altura mudou
   * (e pede novo render). Linha que muda ACIMA da janela visível não move o
   * que está na tela: a posição de rolagem acompanha a diferença.
   */
  measureRows(rows: Iterable<HTMLElement>, all = true): boolean {
    let changed = false;
    let above = 0;
    const top = this.#virtual - this.#margin;

    for (const row of rows) {
      const index = Number(row.getAttribute('data-index') ?? Number.NaN);

      if (!(index >= 0 && index < this.#count)) {
        continue;
      }

      const slot = this.#variableTree ? this.#variableSlot(index) : -1;

      if (slot < 0 && !all) {
        continue;
      }

      const size = row.getBoundingClientRect().height;
      const previous = this.sizeOf(index);

      if (size > 0 && Math.abs(size - previous) > 0.5) {
        if (this.startOf(index) + previous <= top) {
          above += size - previous;
        }

        if (slot >= 0) {
          this.#setVariableSize(slot, size);
        } else {
          this.#setSize(index, size);
        }

        changed = true;
      }
    }

    if (changed) {
      if (above) {
        this.#shift(above);
      }

      this.#clamp();
      this.#host.requestUpdate();
    }

    return changed;
  }

  /** Desloca a posição (o conteúdo acima cresceu `delta`): o que está na tela fica parado. */
  #shift(delta: number): void {
    const scroller = this.#scroller;

    if (!scroller) {
      return;
    }

    if (this.scaled) {
      // Na escala a posição física fica; a virtual anda.
      this.#virtual = Math.max(0, this.#virtual + delta);
      return;
    }

    const target = Math.max(0, this.#physical + delta);

    this.#physical = target;
    this.#virtual = target;
    this.#pending = { physical: target, virtual: target };
    scroller.scrollTop = target;
  }

  #height(): number {
    const height = this.#options.rowHeight();

    if (height !== this.#rowHeight) {
      this.#rowHeight = height;
      this.#dropSizes();
      // As diferenças esparsas são sobre a altura base.
      this.#rebuildVariableTree();
    }

    return height;
  }

  #dropSizes(): void {
    this.#tree = undefined;
    this.#sizes = undefined;
    this.#measured = 0;
  }

  #setSize(index: number, size: number): void {
    const height = this.#height();

    if (!this.#tree) {
      const count = this.#count;
      const tree = new Float64Array(count + 1);

      // Construção O(n): cada nó soma no pai.
      for (let i = 1; i <= count; i++) {
        tree[i] += height;
        const parent = i + (i & -i);

        if (parent <= count) {
          tree[parent] += tree[i];
        }
      }

      this.#tree = tree;
      this.#sizes = new Float64Array(count).fill(height);
    }

    const sizes = this.#sizes!;
    const delta = size - sizes[index];

    if (sizes[index] === height) {
      this.#measured++;
    } else if (size === height) {
      this.#measured--;
    }

    sizes[index] = size;

    for (let i = index + 1; i <= this.#count; i += i & -i) {
      this.#tree[i] += delta;
    }
  }

  /** Soma das alturas das linhas [0, index). */
  #prefix(index: number): number {
    const tree = this.#tree!;
    let sum = 0;

    for (let i = Math.min(index, this.#count); i > 0; i -= i & -i) {
      sum += tree[i];
    }

    return sum;
  }

  /** Linha que contém a posição virtual `offset`. */
  indexAt(offset: number): number {
    const count = this.#count;

    if (count === 0) {
      return 0;
    }

    if (this.#variableTree) {
      // Busca binária pela posição (O(log n · log k)): maior `index` com início ≤ offset.
      let low = 0;
      let high = count - 1;

      while (low < high) {
        const middle = Math.floor((low + high + 1) / 2);

        if (this.startOf(middle) <= offset) {
          low = middle;
        } else {
          high = middle - 1;
        }
      }

      return low;
    }

    if (!this.#tree) {
      return Math.min(count - 1, Math.max(0, Math.floor(offset / this.#height())));
    }

    // Descida na árvore: maior `index` com prefixo ≤ offset.
    const tree = this.#tree;
    let index = 0;
    let remaining = offset;

    for (let step = 2 ** Math.floor(Math.log2(count)); step >= 1; step /= 2) {
      const next = index + step;

      if (next <= count && tree[next] <= remaining) {
        index = next;
        remaining -= tree[next];
      }
    }

    return Math.min(count - 1, index);
  }

  // -------------------------------------------------------------- rolagem

  /** Escala ativa: a lista virtual é maior que o corpo físico. */
  get scaled(): boolean {
    return this.virtualSize > MAX_SCROLL_HEIGHT;
  }

  readonly #onScroll = (): void => {
    const scroller = this.#scroller;

    if (!scroller) {
      return;
    }

    this.#margin = this.#options.getScrollMargin?.() ?? 0;
    this.#syncFromScroll(scroller.scrollTop);

    const window = this.getWindow();
    const rendered = this.#rendered;

    if (!window || window.first !== rendered?.first || window.end !== rendered.end || window.offset !== rendered.offset) {
      this.#host.requestUpdate();
    }
  };

  /** Maior `scrollTop` físico (o que vem antes do corpo também rola). */
  #maxPhysical(): number {
    return Math.max(0, this.getTotalSize() + this.#margin - this.#viewport);
  }

  #maxVirtual(): number {
    return Math.max(0, this.virtualSize + this.#margin - this.#viewport);
  }

  /** Atualiza a posição virtual a partir da física (ver a classe). */
  #syncFromScroll(physical: number): void {
    const previous = this.#physical;
    this.#physical = physical;

    if (this.#pending && Math.abs(this.#pending.physical - physical) < 1) {
      this.#virtual = this.#pending.virtual;
      this.#pending = undefined;
      return;
    }

    this.#pending = undefined;

    if (!this.scaled) {
      this.#virtual = physical;
      return;
    }

    const maxPhysical = this.#maxPhysical();
    const maxVirtual = this.#maxVirtual();
    const delta = physical - previous;

    if (physical <= 0) {
      this.#virtual = 0;
    } else if (physical >= maxPhysical - 1) {
      this.#virtual = maxVirtual;
    } else if (Math.abs(delta) <= Math.max(this.#viewport, this.#height())) {
      this.#virtual = Math.min(maxVirtual, Math.max(0, this.#virtual + delta));
    } else {
      this.#virtual = maxPhysical ? physical / maxPhysical * maxVirtual : 0;
    }
  }

  /** Mantém as posições válidas depois de mudar o tamanho da lista. */
  #clamp(): void {
    if (!this.scaled) {
      this.#virtual = Math.min(this.#physical, this.#maxPhysical());
      return;
    }

    this.#virtual = Math.min(Math.max(0, this.#virtual), this.#maxVirtual());
  }

  /**
   * Janela de linhas a renderizar e o deslocamento físico da 1ª;
   * `undefined` antes de conhecer a altura da janela.
   */
  getWindow(): VirtualWindow | undefined {
    const count = this.#count;

    if (!this.#viewport || !count) {
      return undefined;
    }

    const { overscan } = this.#options;
    // Topo da janela visível em coordenadas do corpo (virtuais).
    const top = Math.max(0, this.#virtual - this.#margin);
    const first = Math.max(0, this.indexAt(top) - overscan);
    const end = Math.min(count, this.indexAt(top + this.#viewport) + 1 + overscan);
    // Na escala, a janela física está em `physical`; a virtual, em `virtual`.
    const shift = this.scaled ? this.#virtual - this.#physical : 0;

    return { first, end, offset: this.startOf(first) - shift };
  }

  /** Janela efetiva do render (com o recurso do 1º render) — o grid chama no `render`. */
  renderWindow(): VirtualWindow {
    const window = this.getWindow() ?? { first: 0, end: Math.min(this.#count, INITIAL_RENDER_ROWS), offset: 0 };

    this.#rendered = window;
    return window;
  }

  /**
   * Rola até a linha `index`: `auto` só rola se ela não estiver inteira na
   * janela; `start`/`center`/`end` alinham.
   */
  scrollToIndex(index: number, { align = 'auto' }: { align?: 'auto' | 'start' | 'center' | 'end' } = {}): void {
    const scroller = this.#scroller;

    if (!scroller || !this.#count) {
      return;
    }

    const row = Math.min(this.#count - 1, Math.max(0, index));
    const margin = this.#options.getScrollMargin?.() ?? this.#margin;
    const sticky = this.#options.getStickyHeight?.() ?? 0;
    // Linha em coordenadas do conteúdo rolável; a área útil fica abaixo do cabeçalho grudado.
    const start = this.startOf(row) + margin - sticky;
    const end = this.startOf(row) + this.sizeOf(row) + margin;
    const viewport = this.#viewport || scroller.clientHeight;
    const current = this.#virtual;
    let target = current;

    if (align === 'start' || (align === 'auto' && start < current)) {
      target = start;
    } else if (align === 'end' || (align === 'auto' && end > current + viewport)) {
      target = end - viewport;
    } else if (align === 'center') {
      target = (start + end - viewport) / 2;
    }

    target = Math.min(Math.max(0, target), this.#maxVirtual());

    if (Math.abs(target - current) < 0.5) {
      return;
    }

    if (!this.scaled) {
      scroller.scrollTop = target;
      return;
    }

    // Andar pouco mantém o passo 1:1; saltar usa a posição proporcional.
    const maxVirtual = this.#maxVirtual();
    const near = Math.abs(target - current) <= viewport;
    const physical = near
      ? Math.min(this.#maxPhysical(), Math.max(0, this.#physical + target - current))
      : maxVirtual ? target / maxVirtual * this.#maxPhysical() : 0;

    this.#pending = { physical, virtual: target };
    scroller.scrollTop = physical;
    // A janela já vale no próximo render (o evento de rolagem vem depois).
    this.#physical = physical;
    this.#virtual = target;
    this.#host.requestUpdate();
  }
}
