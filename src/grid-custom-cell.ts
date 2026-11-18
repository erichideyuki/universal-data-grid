import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { demoteRendererContent } from './features/cell-content-focus.js';
import type { GridColumnDef } from './grid-column-def.js';

/**
 * Ponte entre a célula (shadow DOM do grid) e o elemento devolvido pelo
 * `renderer` do hospedeiro (light DOM do grid, projetado por slot).
 * Re-executa o renderer sempre que a linha ou a coluna da célula mudam.
 * Elemento interno do grid (não é API pública; fica fora do CEM). Sem
 * a marca de interno: o `HTMLElementTagNameMap` abaixo precisa da classe nas `.d.ts`.
 */
@customElement('u-grid-custom-cell')
export class DataGridCustomCell extends LitElement {
  @property({ attribute: false }) grid: HTMLElement | null = null;
  @property({ attribute: false }) column: GridColumnDef | null = null;
  @property({ attribute: false }) item: any = null;
  @property({ attribute: false }) slotName: string | null = null;

  #container: HTMLElement | null = null;
  #renderedColumn: GridColumnDef | null = null;
  #renderedItem: unknown = undefined;

  override connectedCallback() {
    super.connectedCallback();
    this.#sync();
  }

  override updated() {
    this.#sync();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();

    // O repeat move linhas no DOM (desconecta e reconecta na mesma tarefa):
    // só remove o conteúdo se a célula realmente saiu.
    queueMicrotask(() => {
      if (!this.isConnected) {
        this.#container?.remove();
        this.#container = null;
        this.#renderedColumn = null;
        this.#renderedItem = undefined;
      }
    });
  }

  #sync(): void {
    const { grid, column, slotName } = this;

    if (!this.isConnected || !grid || !column?.renderer || !slotName) {
      return;
    }

    this.#container ??= document.createElement('div');

    if (this.#container.slot !== slotName) {
      this.#container.slot = slotName;
    }

    if (this.#container.parentNode !== grid) {
      grid.appendChild(this.#container);
    }

    if (this.#renderedColumn === column && this.#renderedItem === this.item) {
      return;
    }

    const content = column.renderer(this.item);
    this.#container.replaceChildren(...content ? [content] : []);

    // Um ponto de Tab por grid: o conteúdo interativo só por Enter/F2 (spec 17, A12).
    if (content) {
      demoteRendererContent(content);
    }

    this.#renderedColumn = column;
    this.#renderedItem = this.item;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'u-grid-custom-cell': DataGridCustomCell;
  }
}
