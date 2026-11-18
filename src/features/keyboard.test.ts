import { describe, expect, it } from 'vitest';

import { HEADER_ROW, type NavigationContext, navigationKeyOf, nextCell, rangeBetween } from './keyboard.js';

const context = (overrides: Partial<NavigationContext> = {}): NavigationContext => ({
  rowCount: 10,
  colCount: 3,
  hasHeader: true,
  pageSize: 4,
  isGroupRow: () => false,
  ...overrides,
});

const key = (name: string, init: KeyboardEventInit = {}) => ({ key: name, ctrlKey: false, metaKey: false, ...init }) as KeyboardEvent;

describe('navigationKeyOf', () => {
  it('←/→ invertem em RTL; Ctrl/⌘ com Home/End vão ao grid', () => {
    expect(navigationKeyOf(key('ArrowLeft'), false)).toBe('left');
    expect(navigationKeyOf(key('ArrowLeft'), true)).toBe('right');
    expect(navigationKeyOf(key('ArrowRight'), true)).toBe('left');
    expect(navigationKeyOf(key('ArrowUp'), true)).toBe('up');
    expect(navigationKeyOf(key('Home', { ctrlKey: true }), false)).toBe('gridHome');
    expect(navigationKeyOf(key('End', { metaKey: true }), false)).toBe('gridEnd');
    expect(navigationKeyOf(key('End'), false)).toBe('end');
    expect(navigationKeyOf(key('PageDown'), false)).toBe('pageDown');
    expect(navigationKeyOf(key('a'), false)).toBeUndefined();
  });
});

describe('nextCell', () => {
  it('setas param nas bordas; o cabeçalho é a linha de cima', () => {
    const ctx = context();

    expect(nextCell({ row: 0, col: 0 }, 'up', ctx)).toEqual({ row: HEADER_ROW, col: 0 });
    expect(nextCell({ row: HEADER_ROW, col: 0 }, 'up', ctx)).toEqual({ row: HEADER_ROW, col: 0 });
    expect(nextCell({ row: 9, col: 2 }, 'down', ctx)).toEqual({ row: 9, col: 2 });
    expect(nextCell({ row: 3, col: 2 }, 'right', ctx)).toEqual({ row: 3, col: 2 });
    expect(nextCell({ row: 3, col: 0 }, 'left', ctx)).toEqual({ row: 3, col: 0 });
    expect(nextCell({ row: 3, col: 1 }, 'right', ctx)).toEqual({ row: 3, col: 2 });
  });

  it('Home/End na linha; Ctrl+Home/End no grid (o cabeçalho conta, como na APG)', () => {
    const ctx = context();

    expect(nextCell({ row: 4, col: 1 }, 'home', ctx)).toEqual({ row: 4, col: 0 });
    expect(nextCell({ row: 4, col: 1 }, 'end', ctx)).toEqual({ row: 4, col: 2 });
    expect(nextCell({ row: 4, col: 1 }, 'gridHome', ctx)).toEqual({ row: HEADER_ROW, col: 0 });
    expect(nextCell({ row: 4, col: 1 }, 'gridEnd', ctx)).toEqual({ row: 9, col: 2 });
    expect(nextCell({ row: 4, col: 1 }, 'gridHome', context({ hasHeader: false }))).toEqual({ row: 0, col: 0 });
  });

  it('PageUp/PageDown andam uma página e param nas pontas do corpo', () => {
    const ctx = context();

    expect(nextCell({ row: 2, col: 1 }, 'pageDown', ctx)).toEqual({ row: 6, col: 1 });
    expect(nextCell({ row: 8, col: 1 }, 'pageDown', ctx)).toEqual({ row: 9, col: 1 });
    expect(nextCell({ row: 6, col: 1 }, 'pageUp', ctx)).toEqual({ row: 2, col: 1 });
    expect(nextCell({ row: 2, col: 1 }, 'pageUp', ctx)).toEqual({ row: 0, col: 1 });
    expect(nextCell({ row: HEADER_ROW, col: 1 }, 'pageDown', ctx)).toEqual({ row: 3, col: 1 });
  });

  it('linha de grupo tem uma célula: ←/→/Home/End não mudam a coluna lembrada', () => {
    const ctx = context({ isGroupRow: row => row === 2 });

    expect(nextCell({ row: 2, col: 1 }, 'right', ctx)).toEqual({ row: 2, col: 1 });
    expect(nextCell({ row: 2, col: 1 }, 'home', ctx)).toEqual({ row: 2, col: 1 });
    expect(nextCell({ row: 2, col: 1 }, 'down', ctx)).toEqual({ row: 3, col: 1 });
  });

  it('grid vazio fica no cabeçalho', () => {
    expect(nextCell({ row: HEADER_ROW, col: 0 }, 'down', context({ rowCount: 0 }))).toEqual({ row: HEADER_ROW, col: 0 });
  });
});

describe('rangeBetween', () => {
  it('inclusivo, em qualquer ordem', () => {
    expect(rangeBetween(3, 1)).toEqual([1, 2, 3]);
    expect(rangeBetween(2, 2)).toEqual([2]);
  });
});
