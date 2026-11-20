import type { ReactiveController, ReactiveControllerHost } from 'lit';

import { ScrollPort } from '../render/virtualizer.js';

/** O que o controller precisa do grid. */
export interface ScrollPortHost extends ReactiveControllerHost, HTMLElement {
  scrollContainer: string | null;
  scrollContainerElement: HTMLElement | Window | null;
}

export interface ScrollPortCallbacks {
  /** Rolagem da porta externa (janela de colunas, sombras, painel de carga). */
  scroll: () => void;
  /** A porta externa mudou de tamanho ou o grid se moveu dentro dela sem rolagem. */
  moved: () => void;
}

/** Tempo máximo de espera pelo `scrollend` (navegador sem o evento, rolagem interrompida). */
const SCROLL_END_TIMEOUT = 2000;

/** `<html>`/`scrollingElement` = a janela (o `<body>` só no modo quirks, quando é o `scrollingElement`). */
const isViewportElement = (element: Element): boolean => {
  const document = element.ownerDocument;
  return element === document.documentElement || element === document.scrollingElement;
};

/** Pai na árvore "composta": o pai, ou o host da shadow root. */
const composedParent = (node: Node): Element | null => {
  if (node.parentElement) {
    return node.parentElement;
  }

  const root = node.parentNode;
  return root instanceof ShadowRoot ? root.host : null;
};

/**
 * Rolagem por um contêiner externo (spec 27): resolve o contêiner pedido
 * (`scroll-container` / `scrollContainerElement`), avisa no console quando
 * ele não serve, liga o modo pela folha de estilo da instância e ouve a
 * porta (rolagem, tamanho, linhas que se movem sem rolagem). Tudo é solto ao
 * trocar de contêiner e no `hostDisconnected` (spec 14).
 */
export class ScrollPortController implements ReactiveController {
  readonly #host: ScrollPortHost;
  readonly #callbacks: ScrollPortCallbacks;

  #port: ScrollPort | null = null;
  /** Já resolveu ao menos uma vez desde a conexão (antes disso, vale o pedido). */
  #resolved = false;
  readonly #warned = new Set<string>();
  #sheet: CSSStyleSheet | undefined;
  #sheetText = '';
  #resizeObserver: ResizeObserver | undefined;
  #intersectionObserver: IntersectionObserver | undefined;
  readonly #observedRows = new Set<Element>();
  /** Esperas de `scrollend` em curso: o temporizador de reserva de cada uma. */
  readonly #scrollEndWaits = new Map<() => void, ReturnType<typeof setTimeout>>();

  constructor(host: ScrollPortHost, callbacks: ScrollPortCallbacks) {
    this.#host = host;
    this.#callbacks = callbacks;
    host.addController(this);
  }

  hostConnected(): void {
    this.resolve();
  }

  hostDisconnected(): void {
    this.#detach();
    this.#resolved = false;
  }

  /** Porta externa resolvida (`null` = rolagem interna). */
  get port(): ScrollPort | null {
    return this.#port;
  }

  /**
   * Modo externo no render: resolvido, ou pedido e ainda não resolvido (SSR,
   * 1º render antes da conexão) — o servidor e a hidratação desenham igual.
   */
  get external(): boolean {
    return this.#resolved ? this.#port !== null : this.#requested();
  }

  #requested(): boolean {
    const { scrollContainer, scrollContainerElement } = this.#host;
    return !!scrollContainerElement || !!scrollContainer?.trim();
  }

  #warn(key: string, message: string): void {
    if (!this.#warned.has(key)) {
      this.#warned.add(key);
      console.warn(`<u-grid>: ${message}`);
    }
  }

  /** Resolve o contêiner pedido; chamado na conexão e quando as duas propriedades mudam. */
  resolve(): void {
    const host = this.#host;

    if (!host.isConnected) {
      return;
    }

    const source = this.#find();
    this.#resolved = true;

    if (source !== (this.#port?.source ?? null)) {
      this.#detach();

      if (source) {
        this.#attach(new ScrollPort(source));
      }

      host.requestUpdate();
    }

    this.#syncSheet();
  }

  #find(): HTMLElement | Window | null {
    const host = this.#host;
    const element = host.scrollContainerElement;
    const view = host.ownerDocument.defaultView;

    if (element) {
      if (!(element instanceof HTMLElement)) {
        return element;
      }

      if (isViewportElement(element)) {
        return view;
      }

      if (!this.#isAncestor(element)) {
        this.#warn('element', 'scrollContainerElement must be an ancestor of the grid; using the grid\'s own scrolling.');
        return null;
      }

      this.#checkBetween(element);
      return element;
    }

    const id = host.scrollContainer;

    if (id === null || id === undefined) {
      return null;
    }

    const wanted = id.trim();

    if (!wanted) {
      this.#warn('empty', 'scroll-container is empty; using the grid\'s own scrolling.');
      return null;
    }

    if (wanted === 'window') {
      this.#checkBetween(null);
      return view;
    }

    for (let node = composedParent(host); node; node = composedParent(node)) {
      if (node.id === wanted) {
        if (isViewportElement(node)) {
          this.#checkBetween(null);
          return view;
        }

        this.#checkBetween(node as HTMLElement);
        return node as HTMLElement;
      }
    }

    this.#warn(`id:${wanted}`, `scroll-container="${wanted}": no ancestor with this id; using the grid's own scrolling.`);
    return null;
  }

  #isAncestor(element: Element): boolean {
    for (let node = composedParent(this.#host); node; node = composedParent(node)) {
      if (node === element) {
        return true;
      }
    }

    return false;
  }

  /** Ancestral entre o grid e o contêiner que corta/rola: o `sticky` gruda nele, não no contêiner. */
  #checkBetween(container: HTMLElement | null): void {
    const document = this.#host.ownerDocument;

    for (let node = composedParent(this.#host); node && node !== container; node = composedParent(node)) {
      if (node === document.documentElement || node === document.body) {
        break;
      }

      const style = getComputedStyle(node);

      if (![style.overflowX, style.overflowY].every(value => value === 'visible' || value === 'clip')) {
        this.#warn('between', 'an ancestor between the grid and its scroll container has overflow set; sticky headers will stick to it instead.');
        return;
      }
    }
  }

  /**
   * Folha da instância: o modo externo vindo só da propriedade (`height:
   * auto` no host) e, com o atributo, a anulação quando ele não resolveu (o
   * grid não pode ficar sem altura e sem rolagem).
   */
  #syncSheet(): void {
    const root = this.#host.shadowRoot;
    const attribute = this.#host.hasAttribute('scroll-container');
    const text = this.#port && !attribute
      ? ':host { height: auto; overflow-anchor: none; }'
      : !this.#port && attribute
        ? ':host([scroll-container]) { height: 100%; overflow-anchor: auto; }'
        : '';

    if (!root || text === this.#sheetText || typeof CSSStyleSheet === 'undefined' || !('adoptedStyleSheets' in root)) {
      return;
    }

    this.#sheetText = text;
    const sheets = root.adoptedStyleSheets.filter(sheet => sheet !== this.#sheet);

    if (text) {
      this.#sheet ??= new CSSStyleSheet();
      this.#sheet.replaceSync(text);
      sheets.push(this.#sheet);
    }

    root.adoptedStyleSheets = sheets;
  }

  #attach(port: ScrollPort): void {
    this.#port = port;
    port.target.addEventListener('scroll', this.#onScroll, { passive: true });

    if (port.isWindow) {
      port.target.addEventListener('resize', this.#onMoved, { passive: true });
    } else if (typeof ResizeObserver !== 'undefined') {
      this.#resizeObserver = new ResizeObserver(this.#onMoved);
      this.#resizeObserver.observe(port.element);
    }

    if (typeof IntersectionObserver !== 'undefined') {
      // O conteúdo acima do grid muda de altura sem rolagem: as linhas
      // renderizadas entram/saem da porta e o grid relê a posição.
      this.#intersectionObserver = new IntersectionObserver(this.#onIntersect, {
        root: port.isWindow ? null : port.element,
        threshold: [0, 1],
      });
    }
  }

  #detach(): void {
    const port = this.#port;

    if (port) {
      port.target.removeEventListener('scroll', this.#onScroll);
      port.target.removeEventListener('resize', this.#onMoved);
    }

    this.#resizeObserver?.disconnect();
    this.#resizeObserver = undefined;
    this.#intersectionObserver?.disconnect();
    this.#intersectionObserver = undefined;
    this.#observedRows.clear();

    // Esperas em curso terminam já (soltam os próprios listeners e o quadro).
    for (const done of [...this.#scrollEndWaits.keys()]) {
      done();
    }

    this.#port = null;
  }

  readonly #onScroll = (): void => {
    this.#callbacks.scroll();
  };

  readonly #onMoved = (): void => {
    this.#callbacks.moved();
  };

  /** Ignora a 1ª entrega de cada alvo (o `observe` sempre entrega uma). */
  readonly #seen = new WeakSet<Element>();

  readonly #onIntersect = (entries: IntersectionObserverEntry[]): void => {
    let moved = false;

    for (const entry of entries) {
      if (this.#seen.has(entry.target)) {
        moved = true;
      } else {
        this.#seen.add(entry.target);
      }
    }

    if (moved) {
      this.#callbacks.moved();
    }
  };

  /** Observa as linhas renderizadas do corpo (só as novas; solta as que saíram). */
  observeRows(rows: Iterable<Element>): void {
    const observer = this.#intersectionObserver;

    if (!observer) {
      return;
    }

    const wanted = new Set(rows);

    for (const row of this.#observedRows) {
      if (!wanted.has(row)) {
        observer.unobserve(row);
        this.#observedRows.delete(row);
      }
    }

    for (const row of wanted) {
      if (!this.#observedRows.has(row)) {
        observer.observe(row);
        this.#observedRows.add(row);
      }
    }
  }

  /** Quantas linhas estão observadas agora (diagnóstico, testes de vazamento). */
  get observedRows(): number {
    return this.#observedRows.size;
  }

  /** Esperas de `scrollend` em curso (diagnóstico, spec 14). */
  get scrollEndWaits(): number {
    return this.#scrollEndWaits.size;
  }

  /** Chama `callback` quando a rolagem da porta acabar (ou no tempo limite). */
  afterScrollEnd(callback: () => void): void {
    const port = this.#port;

    if (!port) {
      callback();
      return;
    }

    let moving = false;
    let frame = 0;

    const scrolled = (): void => {
      moving = true;
    };

    const done = (): void => {
      const timer = this.#scrollEndWaits.get(done);

      if (timer === undefined) {
        return;
      }

      clearTimeout(timer);
      cancelAnimationFrame(frame);
      this.#scrollEndWaits.delete(done);
      port.target.removeEventListener('scrollend', done);
      port.target.removeEventListener('scroll', scrolled);
      callback();
    };

    this.#scrollEndWaits.set(done, setTimeout(done, SCROLL_END_TIMEOUT));
    port.target.addEventListener('scrollend', done);
    port.target.addEventListener('scroll', scrolled, { passive: true });
    // Nada a rolar (o destino já estava à vista): não vem `scrollend`.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (!moving) {
          done();
        }
      });
    });
  }

  /** `scroll-padding` do contêiner (o que o hospedeiro gruda nele), em px. */
  padding(): { top: number; bottom: number } {
    const port = this.#port;

    if (!port) {
      return { top: 0, bottom: 0 };
    }

    const style = getComputedStyle(port.element);
    const top = parseFloat(style.scrollPaddingTop);
    const bottom = parseFloat(style.scrollPaddingBottom);

    return { top: Number.isFinite(top) ? top : 0, bottom: Number.isFinite(bottom) ? bottom : 0 };
  }
}
