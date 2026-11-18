import { describe, expect, it } from 'vitest';

import { type AdaptiveColumnInput, adaptiveHiddenIndexes, hidingPriorityOf } from './adaptive.js';

const col = (width: number, priority: number | null = null, fixed = false): AdaptiveColumnInput => ({ width, priority, fixed });

describe('adaptiveHiddenIndexes', () => {
  it('nada sai quando cabe', () => {
    expect(adaptiveHiddenIndexes([col(100), col(100)], 200)).toEqual([]);
  });

  it('sem prioridade, sai da última para a primeira', () => {
    const columns = [col(100), col(100), col(100), col(100)];
    expect(adaptiveHiddenIndexes(columns, 350)).toEqual([3]);
    expect(adaptiveHiddenIndexes(columns, 250)).toEqual([2, 3]);
    expect(adaptiveHiddenIndexes(columns, 150)).toEqual([1, 2, 3]);
  });

  it('pelo menos uma fica, mesmo sem caber', () => {
    expect(adaptiveHiddenIndexes([col(100), col(100)], 10)).toEqual([1]);
    expect(adaptiveHiddenIndexes([col(500)], 10)).toEqual([]);
  });

  it('com prioridade, só as com prioridade saem, da menor para a maior', () => {
    const columns = [col(100), col(100, 0), col(100, 1), col(100), col(100, 2), col(100)];
    expect(adaptiveHiddenIndexes(columns, 500)).toEqual([1]);
    expect(adaptiveHiddenIndexes(columns, 400)).toEqual([1, 2]);
    expect(adaptiveHiddenIndexes(columns, 100)).toEqual([1, 2, 4]);
  });

  it('empate: a mais ao fim sai antes', () => {
    expect(adaptiveHiddenIndexes([col(100, 1), col(100, 1), col(100, 1)], 250)).toEqual([2]);
  });

  it('prioridade em coluna não exibida também liga a regra', () => {
    expect(adaptiveHiddenIndexes([col(100), col(100)], 150, true)).toEqual([]);
  });

  it('fixas nunca saem', () => {
    const columns = [col(100), col(100, null, true), col(100), col(100)];
    expect(adaptiveHiddenIndexes(columns, 150)).toEqual([0, 2, 3]);
    expect(adaptiveHiddenIndexes([col(100, 0, true), col(100, 1)], 150)).toEqual([1]);
  });

  it('as fixas sozinhas sem caber: as comuns saem e sobra rolagem', () => {
    expect(adaptiveHiddenIndexes([col(300, null, true), col(100)], 200)).toEqual([1]);
  });
});

describe('hidingPriorityOf', () => {
  it('só número finito', () => {
    expect(hidingPriorityOf(0)).toBe(0);
    expect(hidingPriorityOf(-2.5)).toBe(-2.5);
    expect(hidingPriorityOf(NaN)).toBeNull();
    expect(hidingPriorityOf(Infinity)).toBeNull();
    expect(hidingPriorityOf('1')).toBeNull();
    expect(hidingPriorityOf(null)).toBeNull();
    expect(hidingPriorityOf(undefined)).toBeNull();
  });
});
