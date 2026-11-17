import type { Interactable } from '@interactjs/core/Interactable';
import type { InteractEvent } from '@interactjs/core/InteractEvent';
import interact from 'interactjs';

/**
 * Distância (px) que o ponteiro precisa andar para um cabeçalho/chip virar
 * arrasto. Abaixo disso o gesto é clique (ordenar), não arrasto.
 */
export const DRAG_START_DISTANCE = 4;

type DragThresholdTest = (event: InteractEvent) => boolean;

/**
 * Guarda onde o ponteiro desceu no elemento e devolve o teste "já andou o
 * bastante para ser arrasto?" para o `move` do mesmo elemento.
 */
export const trackDragThreshold = (interactable: Interactable): DragThresholdTest => {
  let start = { x: 0, y: 0 };

  interactable.on('down', (event: InteractEvent) => {
    start = { x: event.clientX, y: event.clientY };
  });

  return event => Math.hypot(event.clientX - start.x, event.clientY - start.y) >= DRAG_START_DISTANCE;
};

export class GridDragHelper {
  static set(element: HTMLElement): Interactable {
    const position = { x: 0, y: 0 };

    return interact(element).draggable({
      manualStart: true,
      listeners: {
        start: () => {
          position.x = 0;
          position.y = 0;
        },
        move: (event: InteractEvent) => {
          position.x += event.dx;
          position.y += event.dy;

          event.target.style.transform = `translate(${position.x}px, ${position.y}px)`;
        },
        end: (event: InteractEvent) => {
          const target = event.target as HTMLElement;
          target.remove();
        },
      },
    });
  }
}

/** O que usamos das `Interaction`s internas do interactjs 1.10 (sem tipo público). */
interface InteractionInternals {
  interacting(): boolean;
  destroy(): void;
  element: unknown;
  downEvent: { target?: unknown } | null;
  downPointer: { target?: unknown } | null;
  pointers: { downTarget?: unknown }[] | null;
  _latestPointer: { eventTarget?: unknown } | null;
}

interface InteractScope {
  interactions?: { list: InteractionInternals[] };
  fire(name: string, arg: object): unknown;
}

const interactScope = (): InteractScope | undefined =>
  (interact as unknown as { scope?: InteractScope }).scope;

/** `node` está em `owner`, no light DOM ou dentro do shadow root dele. */
const belongsTo = (node: unknown, owner: HTMLElement): boolean =>
  node instanceof Node
  && (owner.contains(node) || !!owner.shadowRoot?.contains(node));

const referencesOwner = (interaction: InteractionInternals, owner: HTMLElement): boolean =>
  [
    interaction.element,
    interaction.downEvent?.target,
    interaction.downPointer?.target,
    interaction._latestPointer?.eventTarget,
    ...(interaction.pointers ?? []).map(pointer => pointer.downTarget),
  ].some(node => belongsTo(node, owner));

/**
 * O interactjs guarda num array global (`scope.interactions.list`) a última
 * `Interaction` de cada ponteiro, com o evento de `pointerdown` (alvo = o
 * grid). Ela fica lá até o próximo `pointerdown` na página e segura o grid
 * removido. Chamado no `disconnectedCallback`, depois do `unset` dos
 * elementos: descarta as interações paradas que apontam para `owner` (o
 * interactjs cria outra quando precisar).
 */
export const releaseInteractions = (owner: HTMLElement): void => {
  const scope = interactScope();
  const list = scope?.interactions?.list;

  if (!scope || !list) {
    return;
  }

  for (let i = list.length - 1; i >= 0; i--) {
    const interaction = list[i];

    if (interaction.interacting() || !referencesOwner(interaction, owner)) {
      continue;
    }

    scope.fire('interactions:destroy', { interaction });
    interaction.destroy();
    list.splice(i, 1);
  }
};

/**
 * Conjunto de elementos registrados no interactjs. Registrar de novo o mesmo
 * elemento não faz nada; elementos que saíram do DOM são soltos no `prune`.
 */
export class InteractRegistry {
  readonly #elements = new Set<HTMLElement>();

  get size(): number {
    return this.#elements.size;
  }

  /** Devolve `false` se o elemento já estava registrado. */
  add(element: HTMLElement): boolean {
    if (this.#elements.has(element)) {
      return false;
    }

    this.#elements.add(element);
    return true;
  }

  prune(): void {
    for (const element of this.#elements) {
      if (!element.isConnected) {
        interact(element).unset();
        this.#elements.delete(element);
      }
    }
  }

  clear(): void {
    for (const element of this.#elements) {
      interact(element).unset();
    }

    this.#elements.clear();
  }
}
