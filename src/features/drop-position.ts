import type { DropEvent } from '@interactjs/actions/drop/DropEvent';

export const RelativePosition = {
  Before: 0,
  After: 1,
} as const;

export type DropSide = typeof RelativePosition[keyof typeof RelativePosition];

export const isRtl = (element: Element): boolean =>
  getComputedStyle(element).direction === 'rtl';

/**
 * Posição LÓGICA do cursor em relação ao alvo: antes ou depois na ordem das
 * colunas. Em RTL a metade esquerda é "depois".
 */
export const calcCursorRelativePosition = (event: DropEvent): DropSide => {
  const target = event.target as HTMLElement;
  const targetRect = target.getBoundingClientRect();
  const rightHalf = (event.dragEvent.clientX - targetRect.left) / targetRect.width > 0.5;

  return rightHalf !== isRtl(target)
    ? RelativePosition.After
    : RelativePosition.Before;
};

/** Borda física (px no viewport) onde o indicador de soltar deve aparecer. */
export const dropIndicatorEdge = (target: Element, position: DropSide): number => {
  const rect = target.getBoundingClientRect();
  const atRight = (position === RelativePosition.After) !== isRtl(target);

  return atRight ? rect.right : rect.left;
};
