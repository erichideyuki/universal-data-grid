/**
 * Nome acessível da tabela a partir do `<u-grid>` (spec 10/17):
 * `aria-label`/`aria-labelledby` postos no hospedeiro nomeiam a `<table
 * role="grid|treegrid">` do shadow root.
 *
 * IDREF não atravessa o shadow root. Os ids do `aria-labelledby` são
 * resolvidos na raiz do hospedeiro (documento, ou o shadow root do grid
 * externo para o aninhado) e os alvos vão para a tabela de dois jeitos:
 * `ariaLabelledByElements` (referência de elemento, válida do shadow root
 * para fora: o navegador calcula o accname de verdade e acompanha o texto)
 * e, como reserva (SSR, navegador sem a reflexão), o texto copiado num
 * `aria-label` — o `aria-labelledby` vence o `aria-label` no accname.
 *
 * Um `MutationObserver` acompanha o texto dos alvos (para a cópia) e, na
 * raiz, `childList` + atributo `id` (alvo que aparece, sai, troca de id ou
 * cujo ancestral foi trocado; o callback só compara `getElementById`).
 * Alvo que é o próprio hospedeiro ou ancestral dele daria como nome o grid
 * inteiro e acordaria o observador a cada render: dele vale só o
 * `aria-label`. Tudo solto no `disconnect` (spec 14).
 */

/** Atributos do hospedeiro que nomeiam a tabela. */
export const HOST_LABEL_ATTRIBUTES = ['aria-label', 'aria-labelledby'] as const;

const TARGET_OPTIONS: MutationObserverInit = {
  subtree: true,
  childList: true,
  characterData: true,
  attributes: true,
  attributeFilter: ['aria-label', 'aria-hidden', 'alt', 'hidden'],
};

/** Alvo que contém o grid: só o `aria-label` dele. */
const CONTAINER_OPTIONS: MutationObserverInit = { attributes: true, attributeFilter: ['aria-label'] };

const ROOT_OPTIONS: MutationObserverInit = { subtree: true, childList: true, attributes: true, attributeFilter: ['id'] };

const SKIPPED = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT']);

const collapse = (text: string): string => text.replace(/\s+/g, ' ').trim();

const isRendered = (element: Element): boolean =>
  typeof element.checkVisibility !== 'function' || element.checkVisibility({ visibilityProperty: true });

/**
 * Texto de um nó como o accname o junta (aproximação): descendente
 * `aria-hidden`/não renderizado fica fora (a não ser que o alvo inteiro
 * esteja oculto: aí conta tudo), `aria-label` e `alt` de descendente valem
 * por ele, e shadow root aberto e `<slot>` são percorridos (árvore achatada).
 */
const flatText = (node: Node, visibleOnly: boolean): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.nodeValue ?? '';
  }

  if (!(node instanceof Element)) {
    return '';
  }

  if (SKIPPED.has(node.tagName) || node.getAttribute('aria-hidden') === 'true' || (visibleOnly && !isRendered(node))) {
    return '';
  }

  const label = collapse(node.getAttribute('aria-label') ?? '');

  if (label) {
    return ` ${label} `;
  }

  if (node.tagName === 'IMG') {
    return ` ${node.getAttribute('alt') ?? ''} `;
  }

  if (node.tagName === 'BR') {
    return ' ';
  }

  const assigned = node instanceof HTMLSlotElement ? node.assignedNodes({ flatten: true }) : [];
  const children = assigned.length ? assigned : [...(node.shadowRoot ?? node).childNodes];

  return children.map(child => flatText(child, visibleOnly)).join('');
};

/** Texto de um alvo do `aria-labelledby`: o `aria-label` dele, senão o conteúdo. */
const textOf = (target: Element): string => {
  const label = collapse(target.getAttribute('aria-label') ?? '');

  if (label) {
    return label;
  }

  // Alvo oculto referenciado direto conta inteiro (accname).
  const visibleOnly = isRendered(target);

  return collapse([...(target.shadowRoot ?? target).childNodes].map(child => flatText(child, visibleOnly)).join(''));
};

interface IdRoot {
  getElementById(id: string): Element | null;
}

export class HostLabel {
  readonly #host: HTMLElement;
  readonly #onChange: () => void;
  #name = '';
  #ids: string[] = [];
  #targets: (Element | null)[] = [];
  #elements: readonly Element[] = [];
  #targetObserver: MutationObserver | undefined;
  #rootObserver: MutationObserver | undefined;
  #root: (Node & IdRoot) | undefined;
  #warnedContainer = false;

  constructor(host: HTMLElement, onChange: () => void) {
    this.#host = host;
    this.#onChange = onChange;
  }

  /** Texto copiado para o `aria-label` da tabela (vazio = sem `aria-label`). */
  get name(): string {
    return this.#name;
  }

  /** Alvos para o `ariaLabelledByElements` da tabela (sem o hospedeiro e seus ancestrais). */
  get elements(): readonly Element[] {
    return this.#elements;
  }

  /** Observadores ativos (teste de vazamento, `_memoryStats`). */
  get observers(): number {
    return (this.#targetObserver ? 1 : 0) + (this.#rootObserver ? 1 : 0);
  }

  /** Conectou (raiz nova) ou mudou um dos atributos. Seguro no SSR (sem DOM: só o `aria-label`). */
  update(): void {
    const ids = collapse(this.#host.getAttribute('aria-labelledby') ?? '').split(' ')
      .filter(Boolean);
    const root = this.#host.isConnected ? this.#host.getRootNode() as Node & Partial<IdRoot> : undefined;

    this.#ids = ids;
    this.#root = ids.length && typeof root?.getElementById === 'function' && typeof MutationObserver === 'function'
      ? root as Node & IdRoot
      : undefined;
    this.#targets = this.#root ? ids.map(id => this.#root!.getElementById(id)) : [];
    this.#observe();
    this.#refresh();
  }

  disconnect(): void {
    this.#targetObserver?.disconnect();
    this.#targetObserver = undefined;
    this.#rootObserver?.disconnect();
    this.#rootObserver = undefined;
    this.#ids = [];
    this.#targets = [];
    this.#elements = [];
    this.#root = undefined;
  }

  /** O alvo é o hospedeiro ou o contém (na mesma raiz). */
  #contains(target: Element): boolean {
    return target === this.#host || target.contains(this.#host);
  }

  #observe(): void {
    this.#targetObserver?.disconnect();
    this.#rootObserver?.disconnect();

    const found = this.#targets.filter((target): target is Element => !!target);

    if (found.length) {
      this.#targetObserver ??= new MutationObserver(this.#onTargetMutation);

      for (const target of found) {
        this.#targetObserver.observe(target, this.#contains(target) ? CONTAINER_OPTIONS : TARGET_OPTIONS);
      }
    } else {
      this.#targetObserver = undefined;
    }

    if (this.#root) {
      this.#rootObserver ??= new MutationObserver(this.#onRootMutation);
      this.#rootObserver.observe(this.#root, ROOT_OPTIONS);
    } else {
      this.#rootObserver = undefined;
    }
  }

  /** Texto de um alvo mudou: só recalcula o nome. */
  readonly #onTargetMutation = (): void => {
    this.#refresh();
  };

  /** Algo entrou ou saiu da raiz: refaz só se algum id passou a apontar para outro elemento (ou nenhum). */
  readonly #onRootMutation = (): void => {
    const root = this.#root;

    if (root && this.#ids.some((id, index) => root.getElementById(id) !== this.#targets[index])) {
      this.update();
    }
  };

  #refresh(): void {
    const own = (target: Element | null): string => {
      if (!target) {
        return '';
      }

      return this.#contains(target) ? collapse(target.getAttribute('aria-label') ?? '') : textOf(target);
    };

    if (!this.#warnedContainer && this.#targets.some(target => target && this.#contains(target))) {
      this.#warnedContainer = true;
      console.warn('<u-grid>: aria-labelledby points to the grid or an element that contains it; only its aria-label is used.');
    }

    // `aria-labelledby` vence o `aria-label` (accname); alvo vazio cai no `aria-label`.
    const name = collapse(this.#targets.map(own).join(' ')) || collapse(this.#host.getAttribute('aria-label') ?? '');
    const elements = this.#targets.filter((target): target is Element => !!target && !this.#contains(target));
    const sameElements = elements.length === this.#elements.length && elements.every((element, index) => element === this.#elements[index]);

    if (name !== this.#name || !sameElements) {
      this.#name = name;
      this.#elements = elements;
      this.#onChange();
    }
  }
}
