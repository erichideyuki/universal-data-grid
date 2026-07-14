import type { DropEvent } from '@interactjs/actions/drop/DropEvent';
import type { InteractEvent } from '@interactjs/core/InteractEvent';
import interact from 'interactjs';

import { calcCursorRelativePosition } from './calc-cursor-relative-position';
import { DataGrid } from './grid';
import { GridDragHelper } from './grid-drag-helper';
import { RelativePosition } from './relative-position';

export class GroupDragAndDropAdapter {
  readonly #groups: HTMLElement[] = [];
  readonly #grid: DataGrid;

  constructor(grid: DataGrid) {
    this.#grid = grid;
  }

  attachToGroupDropTarget(dropTarget: HTMLElement, indicatorOrder: number): void {
    this.#groups.push(dropTarget);

    interact(dropTarget).dropzone({
      accept: '.move-container',

      ondragenter: () => {
        this.#grid._groupContainerRef.value!.classList.add('drop-target');
        this.#grid._groupContainerRef.value!.style.setProperty('--_drop-indicator-order', `${indicatorOrder}`);
      },

      ondragleave: () => {
        this.#grid._groupContainerRef.value!.classList.remove('drop-target');
      },

      ondropdeactivate: () => {
        this.#grid._groupContainerRef.value!.classList.remove('drop-target');
      },

      ondrop: (event: DropEvent) => {

        const movingColumn = this.#grid._nativeColumnMap.get(event.draggable.target as HTMLElement);

        if (!movingColumn) {
          return;
        }

        const targetIndex = this.#grid._groupColumns.length;

        this.#grid.groupColumn(movingColumn, targetIndex);
      },
    });
  }

  attach(group: HTMLElement): void {
    if (!group || this.#groups.includes(group)) {
      return;
    }

    this.#groups.push(group);
    GridDragHelper
      .set(group)
      .on('move', (event: InteractEvent) => {
        const interaction = event.interaction;

        if (!(interaction.pointerIsDown && !interaction.interacting())) {
          return;
        }

        const original = event.currentTarget;
        const rect = original.getBoundingClientRect();

        const draggable = document.createElement('th') as HTMLElement;
        draggable.style.width = `${rect.width}px`;
        draggable.style.minWidth = draggable.style.width;
        draggable.textContent = original.textContent;

        const moveContainer = document.createElement('div');
        moveContainer.style.top = `${rect.top}px`;
        moveContainer.style.left = `${rect.left}px`;
        moveContainer.classList.add('move-container');
        moveContainer.appendChild(draggable);

        this.#grid._containerRef.value!.appendChild(moveContainer);
        interaction.start({ name: 'drag' }, event.interactable, moveContainer);
      });

    interact(group).dropzone({
      accept: '.move-container',

      ondragenter: (event: DropEvent) => {
        if (event.target === event.draggable.target) {
          return;
        }

        this.#grid._groupContainerRef.value!.classList.add('drop-target');
      },

      ondragleave: () => {
        this.#grid._groupContainerRef.value!.classList.remove('drop-target');
      },

      ondropdeactivate: () => {
        this.#grid._groupContainerRef.value!.classList.remove('drop-target');
      },

      ondropmove: (event: DropEvent) => {
        if (event.target === event.draggable.target) {
          return;
        }

        const position = calcCursorRelativePosition(event);

        const targetColumn = this.#grid._nativeColumnMap.get(event.target as HTMLElement)!;
        let targetIndex = this.#grid._groupColumns.indexOf(targetColumn);

        if (position === RelativePosition.After) {
          targetIndex++;
        }

        this.#grid._groupContainerRef.value!.style.setProperty('--_drop-indicator-order', `${targetIndex}`);
      },

      ondrop: (event: DropEvent) => {

        const targetColumn = this.#grid._nativeColumnMap.get(event.target as HTMLElement);
        const movingColumn = this.#grid._nativeColumnMap.get(event.draggable.target as HTMLElement);

        if (event.target === event.draggable.target || !targetColumn || !movingColumn) {
          return;
        }

        const position = calcCursorRelativePosition(event);

        let targetIndex = this.#grid._groupColumns.indexOf(targetColumn);

        if (position === RelativePosition.After) {
          targetIndex++;
        }

        this.#grid.groupColumn(movingColumn, targetIndex);
      },
    });
  }

  detach(): void {
    for (const elements of this.#groups) {
      interact(elements).unset();
    }

    this.#groups.length = 0;
  }
}
