import { describe, expect, it } from 'vitest';

import { csvField, escapeFormula, escapeHtml, resolveSeparator, tsvField } from './csv.js';
import { createSlicer } from './slice.js';

describe('csvField (RFC 4180)', () => {
  it('deixa campo simples sem aspas', () => {
    expect(csvField('Ana', ',')).toBe('Ana');
    expect(csvField('', ',')).toBe('');
  });

  it('põe entre aspas campo com separador, aspas, CR ou LF e dobra as aspas', () => {
    expect(csvField('a,b', ',')).toBe('"a,b"');
    expect(csvField('a;b', ';')).toBe('"a;b"');
    expect(csvField('a;b', ',')).toBe('a;b');
    expect(csvField('say "hi"', ',')).toBe('"say ""hi"""');
    expect(csvField('l1\nl2', ',')).toBe('"l1\nl2"');
    expect(csvField('l1\r\nl2', ',')).toBe('"l1\r\nl2"');
  });

  it('TSV: aspas só com tab, quebra ou aspas', () => {
    expect(tsvField('a,b')).toBe('a,b');
    expect(tsvField('a\tb')).toBe('"a\tb"');
  });
});

describe('escapeFormula (OWASP CSV Injection)', () => {
  it.each(['=1+1', '+cmd', '-2+3', '@SUM(A1)', '\t=x', '\r=x', '-$A$1', '=HYPERLINK("http://x")', '-', '+'])('prefixa %j', text => {
    expect(escapeFormula(text)).toBe(`'${text}`);
  });

  it.each(['-5', '+5', '-1,234.56', '-1.234,56', '-12 %', '-1e3', '-$5.00', '-5,00 €', '- 5', 'abc', '', '5-3', 'a=b'])('não mexe em %j', text => {
    expect(escapeFormula(text)).toBe(text);
  });
});

describe('escapeHtml', () => {
  it('escapa & < > " \'', () => {
    expect(escapeHtml('<a href="x">\'&\'</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
});

describe('resolveSeparator', () => {
  it('`auto`: `;` em idioma com vírgula decimal, `,` nos outros', () => {
    expect(resolveSeparator(undefined, 'pt')).toBe(';');
    expect(resolveSeparator('auto', 'de')).toBe(';');
    expect(resolveSeparator('auto', 'fr')).toBe(';');
    expect(resolveSeparator(undefined, 'en')).toBe(',');
    expect(resolveSeparator('auto', 'ja')).toBe(',');
  });

  it('separador explícito vence; idioma inválido cai em `,`', () => {
    expect(resolveSeparator('\t', 'pt')).toBe('\t');
    expect(resolveSeparator('auto', 'not a language!')).toBe(',');
  });
});

describe('createSlicer', () => {
  it('cede a vez só depois do orçamento, a cada 256 unidades', async () => {
    let now = 0;
    const slicer = createSlicer(8, () => now);
    let pauses = 0;

    for (let i = 0; i < 2048; i++) {
      now += 0.01;
      const pause = slicer.tick();

      if (pause) {
        pauses++;
        await pause;
      }
    }

    // 2048 × 0,01 ms = 20,48 ms → 2 fatias de 8 ms vencidas.
    expect(pauses).toBe(2);
  });
});
