import { DropEvent } from '@interactjs/actions/drop/DropEvent';
import type { InteractEvent } from '@interactjs/core/InteractEvent';
import interact from 'interactjs';

import { calcCursorRelativePosition } from './calc-cursor-relative-position';
import { UmDataGrid } from './grid';
import { GridDragHelper } from './grid-drag-helper';
import { RelativePosition } from './relative-position';

export class GroupDragAndDropAdapter {
  readonly #groups: HTMLElement[] = [];

  constructor(private readonly _grid: UmDataGrid) {
  }

  attachToGroupDropTarget(dropTarget: HTMLElement, indicatorOrder: number): void {
    this.#groups.push(dropTarget);

    interact(dropTarget).dropzone({
      accept: '.move-container',

      ondragenter: () => {
        this._grid._groupContainerRef.value!.classList.add('drop-target');
        this._grid._groupContainerRef.value!.style.setProperty('--_drop-indicator-order', `${indicatorOrder}`);
      },

      ondragleave: () => {
        this._grid._groupContainerRef.value!.classList.remove('drop-target');
      },

      ondropdeactivate: () => {
        this._grid._groupContainerRef.value!.classList.remove('drop-target');
      },

      ondrop: (event: DropEvent) => {

        const movingColumn = this._grid._nativeColumnMap.get(event.draggable.target as HTMLElement);

        if (!movingColumn) {
          return;
        }

        const targetIndex = this._grid._groupColumns.length;

        this._grid.groupColumn(movingColumn, targetIndex);
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

        // if the pointer was moved while being held down
        // and an interaction hasn't started yet
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

        this._grid._containerRef.value!.appendChild(moveContainer);
        interaction.start({ name: 'drag' }, event.interactable, moveContainer);
      });

    interact(group).dropzone({
      accept: '.move-container',

      ondragenter: (event: DropEvent) => {
        if (event.target === event.draggable.target) {
          return;
        }

        this._grid._groupContainerRef.value!.classList.add('drop-target');
      },

      ondragleave: () => {
        this._grid._groupContainerRef.value!.classList.remove('drop-target');
      },

      ondropdeactivate: () => {
        this._grid._groupContainerRef.value!.classList.remove('drop-target');
      },

      ondropmove: (event: DropEvent) => {
        if (event.target === event.draggable.target) {
          return;
        }

        const position = calcCursorRelativePosition(event);

        const targetColumn = this._grid._nativeColumnMap.get(event.target as HTMLElement)!;
        let targetIndex = this._grid._groupColumns.indexOf(targetColumn);

        if (position === RelativePosition.After) {
          targetIndex++;
        }

        this._grid._groupContainerRef.value!.style.setProperty('--_drop-indicator-order', `${targetIndex}`);
      },

      ondrop: (event: DropEvent) => {

        const targetColumn = this._grid._nativeColumnMap.get(event.target as HTMLElement);
        const movingColumn = this._grid._nativeColumnMap.get(event.draggable.target as HTMLElement);

        if (event.target === event.draggable.target || !targetColumn || !movingColumn) {
          return;
        }

        const position = calcCursorRelativePosition(event);

        let targetIndex = this._grid._groupColumns.indexOf(targetColumn);

        if (position === RelativePosition.After) {
          targetIndex++;
        }

        this._grid.groupColumn(movingColumn, targetIndex);
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
