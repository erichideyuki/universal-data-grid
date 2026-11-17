import { describe, expect, it } from 'vitest';

import { clampWidth, resizeWidths } from './resize.js';

const col = (width: number, min = 40, max = Infinity) => ({ width, min, max });

describe('clampWidth', () => {
  it('respeita mínimo e máximo', () => {
    expect(clampWidth(10, 40, 200)).toBe(40);
    expect(clampWidth(500, 40, 200)).toBe(200);
    expect(clampWidth(120.4, 40, 200)).toBe(120);
  });

  it('máximo menor que o mínimo: vale o mínimo', () => {
    expect(clampWidth(10, 80, 50)).toBe(80);
  });
});

describe('resizeWidths', () => {
  it('modo widget: só a coluna muda, limitada pelo mínimo', () => {
    expect(resizeWidths(30, col(100))).toEqual({ width: 130 });
    expect(resizeWidths(-500, col(100, 60))).toEqual({ width: 60 });
  });

  it('modo next-column: a vizinha compensa e a soma se conserva', () => {
    const result = resizeWidths(30, col(100), col(100));

    expect(result).toEqual({ width: 130, nextWidth: 70 });
    expect(result.width + result.nextWidth!).toBe(200);
  });

  it('modo next-column: para no mínimo da vizinha sem perder a soma', () => {
    const result = resizeWidths(500, col(100), col(100, 50));

    expect(result).toEqual({ width: 150, nextWidth: 50 });
  });

  it('modo next-column: para no mínimo da própria coluna', () => {
    const result = resizeWidths(-500, col(100, 60), col(100));

    expect(result).toEqual({ width: 60, nextWidth: 140 });
  });

  it('modo next-column: respeita o máximo da vizinha', () => {
    const result = resizeWidths(-80, col(100), col(100, 40, 130));

    expect(result).toEqual({ width: 70, nextWidth: 130 });
  });
});
