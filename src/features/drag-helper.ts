import type { Interactable } from '@interactjs/core/Interactable';
import type { InteractEvent } from '@interactjs/core/InteractEvent';
import interact from 'interactjs';

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
