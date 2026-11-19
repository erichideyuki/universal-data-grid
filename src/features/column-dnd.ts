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

        // Fora da tabela o clone perde o CSS de `th` da grade: leva o tamanho e
        // a aparência calculados da célula (mesma largura e altura, com rowspan).
        const rect = original.getBoundingClientRect();
        const computed = getComputedStyle(original);
        Object.assign(clone.style, {
          display: 'flex',
          alignItems: computed.verticalAlign === 'bottom' ? 'flex-end' : 'center',
          justifyContent: computed.textAlign === 'center' ? 'center' : computed.textAlign === 'end' || computed.textAlign === 'right' ? 'flex-end' : 'flex-start',
          boxSizing: 'border-box',
          width: `${rect.width}px`,
          minWidth: `${rect.width}px`,
          maxWidth: `${rect.width}px`,
          height: `${rect.height}px`,
          padding: computed.padding,
          font: computed.font,
          color: computed.color,
          overflow: 'hidden',
          whiteSpace: computed.whiteSpace,
        });

        const moveContainer = document.createElement('div');
        moveContainer.style.top = rect.top + 'px';
        moveContainer.style.left = rect.left + 'px';
        moveContainer.classList.add('move-container');
        // Só visual: fora da árvore de acessibilidade e sem focáveis (spec 17). Sem
        // \`inert\`: o fantasma precisa continuar recebendo o clique que termina o arrasto.
        moveContainer.setAttribute('aria-hidden', 'true');
        // Nada focável sob `aria-hidden` (axe aria-hidden-focus): o th e os botões clonados ficam fora do Tab.
        [clone, ...clone.querySelectorAll('[tabindex], button, input, a[href]')].forEach(element => element.setAttribute('tabindex', '-1'));
        moveContainer.appendChild(clone);

        this.#grid._containerRef.value!.appendChild(moveContainer);
        interaction.start({ name: 'drag' }, event.interactable, moveContainer);
      });

    interact(column).dropzone({
      accept: '.move-container',

      ondragenter: (event: DropEvent) => {
        if (!this.#accepts(event)) {
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
        if (!this.#accepts(event)) {
          this.#grid._containerRef.value?.classList.remove('drop-target');
          return;
        }

        this.#grid._containerRef.value?.classList.add('drop-target');

        const container = this.#grid._containerRef.value!;
        const containerRect = container.getBoundingClientRect();
        const position = calcCursorRelativePosition(event);
        const left = dropIndicatorEdge(event.target as HTMLElement, position) - containerRect.left;

        container.style.setProperty('--_drop-indicator-left', `${Math.floor(left)}px`);
      },

      ondrop: (event: DropEvent) => {

        const targetColumn = this.#grid._nativeColumnMap.get(event.target as HTMLElement);
        const movingColumn = this.#grid._nativeColumnMap.get(event.draggable.target as HTMLElement);

        if (!this.#accepts(event) || !targetColumn || !movingColumn) {
          return;
        }

        const position = calcCursorRelativePosition(event);

        // Índice entre as irmãs (mesma banda ou nível de cima, frente 13).
        let targetIndex = this.#grid._siblingIndexOf(targetColumn);

        if (position === RelativePosition.After) {
          targetIndex++;
        }

        this.#grid._userMoveColumn(movingColumn, targetIndex);
      },
    });
  }

  /**
   * Soltar em outro cabeçalho do MESMO bloco (fixas no início, livres, fixas
   * no fim) e da mesma banda (frente 13: banda só entre irmãs, coluna não sai
   * da própria banda). Chip de grupo pode cair em qualquer lugar (desagrupa).
   */
  #accepts(event: DropEvent): boolean {
    if (event.target === event.draggable.target) {
      return false;
    }

    const targetColumn = this.#grid._nativeColumnMap.get(event.target as HTMLElement);
    const movingColumn = this.#grid._nativeColumnMap.get(event.draggable.target as HTMLElement);

    if (!targetColumn || !movingColumn || !this.#grid._isRegularColumn(movingColumn)) {
      return true;
    }

    return this.#grid._canDropColumn(movingColumn, targetColumn);
  }

  detach(): void {
    this.#headers.clear();
  }
}
