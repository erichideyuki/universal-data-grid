import { describe, expect, it } from 'vitest';

import { styles } from './grid.styles.js';

/**
 * Versões mínimas (README, "Browser support"): o CSS do grid não pode depender
 * do que o Chrome/Edge 114 não tem. Medido no BrowserStack (0.6.0): sem estas
 * regras, o texto do cabeçalho e das linhas de grupo sumia e os ícones viravam
 * quadrados pretos no Chrome/Edge 114.
 */
describe('grid styles: minimum browser versions', () => {
  const css = styles.cssText;

  it('every mask has the -webkit-mask twin (unprefixed mask is Chromium 120+)', () => {
    // `(mask: none)` do @supports não é declaração
    const masks = [...css.matchAll(/(?<![-\w(])mask:\s*([^;]+);/g)].map(m => m[1].trim());
    const prefixed = new Set([...css.matchAll(/-webkit-mask:\s*([^;]+);/g)].map(m => m[1].trim()));

    expect(masks.length).toBeGreaterThan(0);

    for (const value of masks) {
      expect(prefixed.has(value), `mask without -webkit-mask: ${value.slice(0, 60)}`).toBe(true);
    }
  });

  it('no currentColor inside color-mix() in a text color (transparent before Chromium 120)', () => {
    const textColors = [...css.matchAll(/(?<![-\w])color:\s*([^;]+);/g)].map(m => m[1]);
    const broken = textColors.filter(value => (/color-mix\([^;]*currentColor/i).test(value));

    expect(broken).toEqual([]);
    // a variável que alimenta textos (setas de grupo) também
    expect(css).not.toMatch(/--_variant-color:[^;]*color-mix\([^;]*currentColor/);
    // currentColor volta só onde funciona: `mask-image` sem prefixo (Chromium 120+); `mask` o Chromium 114 aceita (SVG)
    expect(css).toMatch(/@supports \(mask-image: none\) \{\s*:host \{\s*--_mix-base: currentColor;/);
  });
});
