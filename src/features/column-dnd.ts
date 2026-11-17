import type { DropEvent } from '@interactjs/actions/drop/DropEvent';
import type { InteractEvent } from '@interactjs/core/InteractEvent';
import interact from 'interactjs';

import type { DataGrid } from '../grid.js';
import { GridDragHelper, InteractRegistry, trackDragThreshold } from './drag-helper.js';
import { calcCursorRelativePosition, dropIndicatorEdge, RelativePosition } from './drop-position.js';

export class ColumnDragAndDropAdapter {
  readonly #headers = new InteractRegistry();
  readonly #grid: DataGrid;

  constructor(grid: DataGrid) {
    this.#grid = grid;
  }

  get size(): number {
    return this.#headers.size;
  }

  prune(): void {
    this.#headers.prune();
  }

  attach(column: HTMLElement): void {
    if (!column || !this.#headers.add(column)) {
      return;
    }

    const interactable = GridDragHelper.set(column);
    const movedEnough = trackDragThreshold(interactable);

    interactable
      .on('move', (event: InteractEvent) => {
        const interaction = event.interaction;

        if (!(interaction.pointerIsDown && !interaction.interacting()) || !movedEnough(event)) {
          return;
        }

        // O clique que termina este arrasto não pode ordenar.
        this.#grid._dragStarted();

        const original = event.currentTarget;
        const clone = event.currentTarget.cloneNode(true) as HTMLElement;

        const rect = original.getBoundingClientRect();
        clone.style.width = rect.width + 'px';
        clone.style.minWidth = clone.style.width;

        const moveContainer = document.createElement('div');
        moveContainer.style.top = rect.top + 'px';
        moveContainer.style.left = rect.left + 'px';
        moveContainer.classList.add('move-container');
        moveContainer.appendChild(clone);

        this.#grid._containerRef.value!.appendChild(moveContainer);
        interaction.start({ name: 'drag' }, event.interactable, moveContainer);
      });

    interact(column).dropzone({
      accept: '.move-container',

      ondragenter: (event: DropEvent) => {
        if (event.target === event.draggable.target) {
          return;
        }

        this.#grid._containerRef.value?.classList.add('drop-target');
      },

      ondragleave: () => {
        this.#grid._containerRef.value?.classList.remove('drop-target');
      },

      ondropdeactivate: () => {
        this.#grid._containerRef.value?.classList.remove('drop-target');
      },

      ondropmove: (event: DropEvent) => {
        if (event.target === event.draggable.target) {
          return;
        }

        const container = this.#grid._containerRef.value!;
        const containerRect = container.getBoundingClientRect();
        const position = calcCursorRelativePosition(event);
        const left = dropIndicatorEdge(event.target as HTMLElement, position) - containerRect.left;

        container.style.setProperty('--_drop-indicator-left', `${Math.floor(left)}px`);
      },

      ondrop: (event: DropEvent) => {

        const targetColumn = this.#grid._nativeColumnMap.get(event.target as HTMLElement);
        const movingColumn = this.#grid._nativeColumnMap.get(event.draggable.target as HTMLElement);

        if (event.target === event.draggable.target || !targetColumn || !movingColumn) {
          return;
        }

        const position = calcCursorRelativePosition(event);

        let targetIndex = this.#grid._regularColumns.indexOf(targetColumn);

        if (position === RelativePosition.After) {
          targetIndex++;
        }

        this.#grid.moveColumn(movingColumn, targetIndex);
      },
    });
  }

  detach(): void {
    this.#headers.clear();
  }
}
