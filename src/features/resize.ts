import type { GridColumnDef } from '../grid-column-def.js';

export type GridResizeMode = 'next-column' | 'widget';

/** Passo do Alt+←/→ (e das setas na alça), em px. */
export const RESIZE_KEYBOARD_STEP = 16;

/** Mínimo quando a coluna não define `minWidth`. */
export const DEFAULT_MIN_COLUMN_WIDTH = 40;

export interface WidthBounds {
  width: number;
  min: number;
  max: number;
}

export const clampWidth = (width: number, min: number, max: number): number =>
  Math.round(Math.min(Math.max(width, min), Math.max(min, max)));

/**
 * Larguras depois de arrastar a borda final da coluna `delta` px (lógicos:
 * positivo = alarga). Com `next` (modo `next-column`) a vizinha cede ou ganha
 * o mesmo tanto, respeitando os limites das duas, e a soma se conserva.
 */
export const resizeWidths = (
  delta: number,
  column: WidthBounds,
  next?: WidthBounds,
): { width: number; nextWidth?: number } => {

  const width = clampWidth(column.width + delta, column.min, column.max);

  if (!next) {
    return { width };
  }

  const nextWidth = clampWidth(next.width - (width - column.width), next.min, next.max);

  return {
    width: column.width + (next.width - nextWidth),
    nextWidth,
  };
};

const isInline = (element: Element): boolean =>
  getComputedStyle(element).display.startsWith('inline');

/**
 * Largura natural do conteúdo de uma célula (sem o corte do `overflow`),
 * somando o padding. Texto e elementos inline são medidos pelo `Range`; os
 * de bloco, pelo conteúdo deles. Slots contam pelo que projetam.
 */
export const measureContentWidth = (cell: HTMLElement, ignore = '.resize-handle'): number => {
  const range = document.createRange();
  let left = Infinity;
  let right = -Infinity;

  const include = (rects: DOMRectList | DOMRect[]): void => {
    for (const rect of rects) {
      if (rect.width > 0) {
        left = Math.min(left, rect.left);
        right = Math.max(right, rect.right);
      }
    }
  };

  const visit = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      range.selectNodeContents(node);
      include(range.getClientRects());
      return;
    }

    if (!(node instanceof Element) || node.matches(ignore)) {
      return;
    }

    if (node instanceof HTMLSlotElement) {
      node.assignedNodes({ flatten: true }).forEach(visit);
      return;
    }

    if (node !== cell && isInline(node) && node.childNodes.length) {
      include([node.getBoundingClientRect()]);
      return;
    }

    node.childNodes.forEach(visit);
  };

  visit(cell);

  const style = getComputedStyle(cell);
  const padding = (parseFloat(style.paddingInlineStart) || 0) + (parseFloat(style.paddingInlineEnd) || 0);
  const content = right > left ? right - left : 0;

  return Math.ceil(content + padding);
};

export interface GridColumnResizeEventDetail {
  column: GridColumnDef;
  width: number;
  previousWidth: number;
  /** Só no modo `next-column`: a vizinha que cedeu (ou ganhou) largura. */
  nextColumn?: GridColumnDef;
  nextColumnWidth?: number;
}

/** O que o controlador precisa do grid (mantém o arquivo sem importar o grid). */
export interface ResizeHost {
  readonly resizeMode: GridResizeMode;
  _boundsOf(column: GridColumnDef): WidthBounds;
  /** Vizinha que acompanha no modo `next-column` (ou nenhuma). */
  _resizeNeighbor(column: GridColumnDef): GridColumnDef | undefined;
  /** Converte as larguras automáticas das colunas visíveis em px do usuário. */
  _freezeWidths(): void;
  _setUserWidths(widths: ReadonlyMap<GridColumnDef, number>): void;
  _isRtl(): boolean;
  _setResizing(active: boolean): void;
  _dispatchColumnResize(detail: GridColumnResizeEventDetail): void;
}

interface ResizeSession {
  column: GridColumnDef;
  next?: GridColumnDef;
  start: WidthBounds;
  startNext?: WidthBounds;
  startX: number;
  pointerId: number;
  handle: HTMLElement;
  delta: number;
  changed: boolean;
}

/**
 * Redimensionamento pela alça do cabeçalho: arrasto com captura do ponteiro,
 * teclado (Alt+←/→ no cabeçalho; setas na própria alça) e o evento de fim.
 */
export class ColumnResizeController {
  readonly #host: ResizeHost;
  #session: ResizeSession | undefined;

  constructor(host: ResizeHost) {
    this.#host = host;
  }

  get active(): boolean {
    return !!this.#session;
  }

  readonly pointerDown = (event: PointerEvent, column: GridColumnDef): void => {
    if (event.button !== 0 || this.#session) {
      return;
    }

    // Sem isto o interactjs veria o pointerdown e começaria a arrastar a coluna.
    event.stopPropagation();
    event.preventDefault();

    const handle = event.currentTarget as HTMLElement;
    const { start, next, startNext } = this.#begin(column);

    this.#session = {
      column,
      next,
      start,
      startNext,
      startX: event.clientX,
      pointerId: event.pointerId,
      handle,
      delta: 0,
      changed: false,
    };

    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // Ponteiro sintético/já solto: segue sem captura.
    }

    handle.addEventListener('pointermove', this.#pointerMove);
    handle.addEventListener('pointerup', this.#pointerUp);
    handle.addEventListener('pointercancel', this.#pointerUp);
    handle.addEventListener('lostpointercapture', this.#pointerUp);
    this.#host._setResizing(true);
  };

  /**
   * Teclado. Na alça as setas bastam; no cabeçalho exige Alt. Devolve `true`
   * quando tratou a tecla.
   */
  keyDown(event: KeyboardEvent, column: GridColumnDef, requireAlt: boolean): boolean {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return false;
    }

    if (requireAlt ? !event.altKey : event.ctrlKey || event.metaKey) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();

    const physical = event.key === 'ArrowRight' ? 1 : -1;
    const delta = physical * (this.#host._isRtl() ? -1 : 1) * RESIZE_KEYBOARD_STEP;
    const { start, next, startNext } = this.#begin(column);

    this.#apply(column, start, delta, next, startNext, true);
    return true;
  }

  #begin(column: GridColumnDef) {
    const host = this.#host;
    host._freezeWidths();

    const next = host.resizeMode === 'next-column' ? host._resizeNeighbor(column) : undefined;

    return {
      start: host._boundsOf(column),
      next,
      startNext: next ? host._boundsOf(next) : undefined,
    };
  }

  #apply(
    column: GridColumnDef,
    start: WidthBounds,
    delta: number,
    next: GridColumnDef | undefined,
    startNext: WidthBounds | undefined,
    commit: boolean,
  ): boolean {
    const result = resizeWidths(delta, start, startNext);
    const widths = new Map<GridColumnDef, number>([[column, result.width]]);

    if (next && result.nextWidth !== undefined) {
      widths.set(next, result.nextWidth);
    }

    this.#host._setUserWidths(widths);

    const changed = result.width !== start.width;

    if (commit && changed) {
      this.#host._dispatchColumnResize({
        column,
        width: result.width,
        previousWidth: start.width,
        ...next && result.nextWidth !== undefined ? { nextColumn: next, nextColumnWidth: result.nextWidth } : {},
      });
    }

    return changed;
  }

  readonly #pointerMove = (event: PointerEvent): void => {
    const session = this.#session;

    if (session?.pointerId !== event.pointerId) {
      return;
    }

    session.delta = (event.clientX - session.startX) * (this.#host._isRtl() ? -1 : 1);
    session.changed = this.#apply(session.column, session.start, session.delta, session.next, session.startNext, false);
  };

  readonly #pointerUp = (event: PointerEvent): void => {
    const session = this.#session;

    if (session?.pointerId !== event.pointerId) {
      return;
    }

    this.#release(session);

    if (event.type === 'pointercancel') {
      // Cancelado pelo navegador: volta às larguras do começo.
      this.#apply(session.column, session.start, 0, session.next, session.startNext, false);
    } else if (session.changed) {
      this.#apply(session.column, session.start, session.delta, session.next, session.startNext, true);
    }
  };

  /**
   * Grid desconectado no meio de um arrasto: solta os listeners da alça e as
   * referências às colunas, mantendo a largura já aplicada (sem evento).
   */
  cancel(): void {
    if (this.#session) {
      this.#release(this.#session);
    }
  }

  #release(session: ResizeSession): void {
    this.#session = undefined;

    const { handle, pointerId } = session;
    handle.removeEventListener('pointermove', this.#pointerMove);
    handle.removeEventListener('pointerup', this.#pointerUp);
    handle.removeEventListener('pointercancel', this.#pointerUp);
    handle.removeEventListener('lostpointercapture', this.#pointerUp);

    if (handle.hasPointerCapture(pointerId)) {
      handle.releasePointerCapture(pointerId);
    }

    this.#host._setResizing(false);
  }
}
