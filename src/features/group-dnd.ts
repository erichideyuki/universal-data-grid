import type { DropEvent } from '@interactjs/actions/drop/DropEvent';
import type { InteractEvent } from '@interactjs/core/InteractEvent';
import interact from 'interactjs';

import type { DataGrid } from '../grid.js';
import { GridDragHelper, InteractRegistry, trackDragThreshold } from './drag-helper.js';
import { calcCursorRelativePosition, RelativePosition } from './drop-position.js';

export class GroupDragAndDropAdapter {
  readonly #elements = new InteractRegistry();
  readonly #grid: DataGrid;

  constructor(grid: DataGrid) {
    this.#grid = grid;
  }

  get size(): number {
    return this.#elements.size;
  }

  prune(): void {
    this.#elements.prune();
  }

  attachToGroupDropTarget(dropTarget: HTMLElement, indicatorOrder: number): void {
    if (!dropTarget || !this.#elements.add(dropTarget)) {
      return;
    }

    interact(dropTarget).dropzone({
      accept: '.move-container',

      ondragenter: () => {
        const container = this.#grid._groupContainerRef.value!;
        container.classList.add('drop-target');
        container.style.setProperty('--_drop-indicator-order', `${indicatorOrder}`);
      },

      ondragleave: () => {
        this.#grid._groupContainerRef.value?.classList.remove('drop-target');
      },

      ondropdeactivate: () => {
        this.#grid._groupContainerRef.value?.classList.remove('drop-target');
      },

      ondrop: (event: DropEvent) => {

        const movingColumn = this.#grid._nativeColumnMap.get(event.draggable.target as HTMLElement);

        if (!movingColumn) {
          return;
        }

        this.#grid._userGroupColumn(movingColumn, this.#grid._groupColumns.length);
      },
    });
  }

  attach(group: HTMLElement): void {
    if (!group || !this.#elements.add(group)) {
      return;
    }

    const interactable = GridDragHelper.set(group);
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
        const rect = original.getBoundingClientRect();

        const draggable = document.createElement('th') as HTMLElement;
        draggable.style.width = `${rect.width}px`;
        draggable.style.minWidth = draggable.style.width;
        draggable.textContent = original.textContent;

        const moveContainer = document.createElement('div');
        moveContainer.style.top = `${rect.top}px`;
        moveContainer.style.left = `${rect.left}px`;
        moveContainer.classList.add('move-container');
        // Só visual: fora da árvore de acessibilidade (spec 17).
        moveContainer.setAttribute('aria-hidden', 'true');
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

        this.#grid._groupContainerRef.value?.classList.add('drop-target');
      },

      ondragleave: () => {
        this.#grid._groupContainerRef.value?.classList.remove('drop-target');
      },

      ondropdeactivate: () => {
        this.#grid._groupContainerRef.value?.classList.remove('drop-target');
      },

      ondropmove: (event: DropEvent) => {
        if (event.target === event.draggable.target) {
          return;
        }

        const targetColumn = this.#grid._nativeColumnMap.get(event.target as HTMLElement);

        if (!targetColumn) {
          return;
        }

        let targetIndex = this.#grid._groupColumns.indexOf(targetColumn);

        if (calcCursorRelativePosition(event) === RelativePosition.After) {
          targetIndex++;
        }

        // `order` do flex: o navegador já espelha em RTL.
        this.#grid._groupContainerRef.value?.style.setProperty('--_drop-indicator-order', `${targetIndex}`);
      },

      ondrop: (event: DropEvent) => {

        const targetColumn = this.#grid._nativeColumnMap.get(event.target as HTMLElement);
        const movingColumn = this.#grid._nativeColumnMap.get(event.draggable.target as HTMLElement);

        if (event.target === event.draggable.target || !targetColumn || !movingColumn) {
          return;
        }

        let targetIndex = this.#grid._groupColumns.indexOf(targetColumn);

        if (calcCursorRelativePosition(event) === RelativePosition.After) {
          targetIndex++;
        }

        this.#grid._userGroupColumn(movingColumn, targetIndex);
      },
    });
  }

  detach(): void {
    this.#elements.clear();
  }
}
