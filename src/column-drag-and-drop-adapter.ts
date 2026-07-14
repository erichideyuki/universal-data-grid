import type { DropEvent } from '@interactjs/actions/drop/DropEvent';
import type { InteractEvent } from '@interactjs/core/InteractEvent';
import interact from 'interactjs';

import { calcCursorRelativePosition } from './calc-cursor-relative-position';
import { DataGrid } from './grid';
import { GridDragHelper } from './grid-drag-helper';
import { RelativePosition } from './relative-position';

export class ColumnDragAndDropAdapter {
  readonly #draggableHeaders: HTMLElement[] = [];
  readonly #grid: DataGrid;

  constructor(grid: DataGrid) {
    this.#grid = grid;
  }

  attach(column: HTMLElement): void {
    if (!column || this.#draggableHeaders.includes(column)) {
      return;
    }

    this.#draggableHeaders.push(column);
    GridDragHelper
      .set(column)
      .on('move', (event: InteractEvent) => {
        const interaction = event.interaction;

        if (!(interaction.pointerIsDown && !interaction.interacting())) {
          return;
        }

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

        this.#grid._containerRef.value!.classList.add('drop-target');
      },

      ondragleave: () => {
        this.#grid._containerRef.value!.classList.remove('drop-target');
      },

      ondropdeactivate: () => {
        this.#grid._containerRef.value!.classList.remove('drop-target');
      },

      ondropmove: (event: DropEvent) => {
        if (event.target === event.draggable.target) {
          return;
        }

        const container = this.#grid._containerRef.value!;
        const containerRect = container.getBoundingClientRect();

        const position = calcCursorRelativePosition(event);

        const targetRect = event.target.getBoundingClientRect();

        const left = position === RelativePosition.After
          ? targetRect.right - containerRect.left
          : targetRect.left - containerRect.left;

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
    for (const draggableColumn of this.#draggableHeaders) {
      interact(draggableColumn).unset();
    }

    this.#draggableHeaders.length = 0;
  }
}
