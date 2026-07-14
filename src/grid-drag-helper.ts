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
