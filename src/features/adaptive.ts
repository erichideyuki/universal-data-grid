/**
 * Colunas ocultas por falta de espaço (spec 21). Função pura: só larguras
 * em memória, nada do DOM; O(colunas).
 */

/** Uma coluna candidata a sair, na ordem exibida. */
export interface AdaptiveColumnInput {
  /** Largura necessária (px): a escolhida, ou `max(minWidth, 150)`. */
  width: number;
  /** Fixa: nunca sai. */
  fixed: boolean;
  /** `hidingPriority` finito, ou `null`. */
  priority: number | null;
}

/**
 * Índices (crescentes) das colunas que saem para caberem em `available`
 * px. Com alguma `priority` definida (`anyPriority`, conferida em todas as
 * colunas definidas, não só nas exibidas), só as com prioridade saem, da
 * menor para a maior (empate: a mais ao fim primeiro); sem nenhuma, saem da
 * última para a primeira. Fixas nunca saem e pelo menos uma coluna fica,
 * mesmo sem caber.
 */
export const adaptiveHiddenIndexes = (
  columns: readonly AdaptiveColumnInput[],
  available: number,
  anyPriority = columns.some(column => column.priority !== null),
): number[] => {
  let total = 0;

  for (const column of columns) {
    total += column.width;
  }

  if (total <= available || columns.length < 2) {
    return [];
  }

  const order: number[] = [];

  columns.forEach((column, index) => {
    if (!column.fixed && (!anyPriority || column.priority !== null)) {
      order.push(index);
    }
  });

  if (anyPriority) {
    order.sort((a, b) => (columns[a].priority!) - (columns[b].priority!) || b - a);
  } else {
    order.reverse();
  }

  const hidden: number[] = [];
  let remaining = columns.length;

  for (const index of order) {
    if (total <= available || remaining <= 1) {
      break;
    }

    hidden.push(index);
    total -= columns[index].width;
    remaining--;
  }

  return hidden.sort((a, b) => a - b);
};

/** `hidingPriority` utilizável (número finito) ou `null`. */
export const hidingPriorityOf = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;
