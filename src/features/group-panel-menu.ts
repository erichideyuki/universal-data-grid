import { html, nothing, type ReactiveController, type ReactiveControllerHost, type TemplateResult } from 'lit';
import { map } from 'lit/directives/map.js';

import type { GridColumnDef } from '../grid-column-def.js';
import type { GridI18n } from '../grid-i18n.js';

export interface GroupPanelMenuHost extends ReactiveControllerHost {
  readonly renderRoot: HTMLElement | DocumentFragment;
  _isRtl(): boolean;
}

export type GroupPanelMenuAction = 'ungroupColumn' | 'ungroupAll' | 'expandAllGroups' | 'collapseAllGroups';

interface MenuAnchor {
  /** Coluna do chip (Desagrupar); nula no painel. */
  column: GridColumnDef | null;
  /** Elemento que recebe o foco de volta ao fechar. */
  returnFocus: HTMLElement | null;
  /** Ponto do clique direito; sem ele, abre sob `returnFocus`. */
  x?: number;
  y?: number;
}

/** Teclas que abrem um menu de contexto pelo teclado. */
export const isContextMenuKey = (event: KeyboardEvent): boolean =>
  event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey);

/**
 * Menu de contexto do painel de grupos (padrão "menu" da APG): setas,
 * Home/End, Enter/Espaço, Esc e Tab fecham; clique fora fecha. Popover
 * manual (camada do topo), posicionado no ponto do clique ou sob o chip.
 */
export class GroupPanelMenuController implements ReactiveController {
  readonly #host: GroupPanelMenuHost;
  #anchor: MenuAnchor | null = null;
  #shown = false;
  #restoreFocus: HTMLElement | null = null;

  constructor(host: GroupPanelMenuHost) {
    this.#host = host;
    host.addController(this);
  }

  get open(): boolean {
    return this.#anchor !== null;
  }

  get column(): GridColumnDef | null {
    return this.#anchor?.column ?? null;
  }

  show(anchor: MenuAnchor): void {
    this.#anchor = anchor;
    this.#shown = false;
    this.#host.requestUpdate();
  }

  hide(restoreFocus = false): void {
    if (!this.#anchor) {
      return;
    }

    this.#restoreFocus = restoreFocus ? this.#anchor.returnFocus : null;
    this.#anchor = null;
    this.#panel?.hidePopover?.();
    document.removeEventListener('pointerdown', this.#outsidePointerDown, true);
    this.#host.requestUpdate();
  }

  get #panel(): HTMLElement | null {
    return this.#host.renderRoot.querySelector<HTMLElement>('.group-panel-menu');
  }

  get #items(): HTMLElement[] {
    return [...this.#panel?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? []];
  }

  hostUpdated(): void {
    if (!this.#anchor) {
      const target = this.#restoreFocus;
      this.#restoreFocus = null;

      if (target?.isConnected) {
        target.focus();
      }

      return;
    }

    const panel = this.#panel;

    if (!panel || this.#shown) {
      return;
    }

    this.#shown = true;

    if (typeof panel.showPopover === 'function' && !panel.matches(':popover-open')) {
      panel.showPopover();
    }

    this.#position(panel, this.#anchor);
    document.addEventListener('pointerdown', this.#outsidePointerDown, true);
    this.#items[0]?.focus();
  }

  hostDisconnected(): void {
    document.removeEventListener('pointerdown', this.#outsidePointerDown, true);
    this.#anchor = null;
    this.#shown = false;
    this.#restoreFocus = null;
  }

  readonly onKeyDown = (event: KeyboardEvent): void => {
    const items = this.#items;
    const index = items.indexOf(event.composedPath()[0] as HTMLElement);
    let next: number | undefined;

    switch (event.key) {
      case 'ArrowDown':
        next = (index + 1) % items.length;
        break;
      case 'ArrowUp':
        next = (index - 1 + items.length) % items.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = items.length - 1;
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.hide(true);
        return;
      case 'Tab':
        event.preventDefault();
        this.hide(true);
        return;
      default:
        return;
    }

    event.preventDefault();
    items[next]?.focus();
  };

  #position(panel: HTMLElement, anchor: MenuAnchor): void {
    const margin = 8;
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    let left: number;
    let top: number;

    if (anchor.x !== undefined && anchor.y !== undefined) {
      left = this.#host._isRtl() ? anchor.x - width : anchor.x;
      top = anchor.y;
    } else {
      const rect = (anchor.returnFocus ?? (this.#host as unknown as HTMLElement)).getBoundingClientRect();
      left = this.#host._isRtl() ? rect.right - width : rect.left;
      top = rect.bottom + 4;
    }

    panel.style.left = `${Math.round(Math.max(margin, Math.min(left, viewportWidth - width - margin)))}px`;
    panel.style.top = `${Math.round(Math.max(margin, Math.min(top, viewportHeight - height - margin)))}px`;
  }

  readonly #outsidePointerDown = (event: PointerEvent): void => {
    const keep = event.composedPath().some(target =>
      target instanceof HTMLElement && target.classList.contains('group-panel-menu'));

    if (!keep) {
      this.hide();
    }
  };
}

export interface GroupPanelMenuContext {
  translation: GridI18n;
  /** Coluna do chip (mostra "Desagrupar"). */
  column: GridColumnDef | null;
  onAction: (action: GroupPanelMenuAction) => void;
  onKeyDown: (event: KeyboardEvent) => void;
}

/** O menu (sem estado): itens `menuitem` com foco móvel por setas. */
export const renderGroupPanelMenu = ({ translation, column, onAction, onKeyDown }: GroupPanelMenuContext): TemplateResult => {
  const actions: GroupPanelMenuAction[] = [
    ...column ? ['ungroupColumn' as const] : [],
    'ungroupAll',
    'expandAllGroups',
    'collapseAllGroups',
  ];

  return html`
    <div
      class="group-panel-menu"
      part="group-panel-menu"
      .popover=${'manual'}
      role="menu"
      aria-label=${translation.groupPanelMenu}
      @keydown=${onKeyDown}>
      ${map(actions, action => html`
        <button
          class="group-panel-menu-item"
          type="button"
          role="menuitem"
          tabindex="-1"
          @click=${() => onAction(action)}>${translation[action]}${action === 'ungroupColumn' && column?.label
            ? html`<span class="visually-hidden"> ${column.label}</span>`
            : nothing}</button>`)}
    </div>`;
};
