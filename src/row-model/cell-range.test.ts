import { describe, expect, it } from 'vitest';

import { RowsWithAdded } from './added-rows.js';
import {
  bandColumns,
  cellRangeEdges,
  countCells,
  parseTsv,
  pasteSize,
  rectOf,
  rowBands,
  unescapePasted,
} from './cell-range.js';
import { RowPage, RowList } from './flatten.js';
import type { GroupRow } from './types.js';

describe('cell-range: retângulos', () => {
  it('normaliza âncora e fim em qualquer ordem', () => {
    expect(rectOf({ anchorRow: 5, anchorCol: 3, endRow: 2, endCol: 1 })).toEqual({ top: 2, bottom: 5, left: 1, right: 3 });
  });

  it('marca bordas externas e o estado da célula', () => {
    const rects = [rectOf({ anchorRow: 1, anchorCol: 1, endRow: 3, endCol: 2 })];

    expect(cellRangeEdges(rects, 0, 1)).toBeNull();
    expect(cellRangeEdges(rects, 1, 1)).toEqual({ top: true, bottom: false, start: true, end: false });
    expect(cellRangeEdges(rects, 2, 2)).toEqual({ top: false, bottom: false, start: false, end: true });
    expect(cellRangeEdges(rects, 3, 2)).toEqual({ top: false, bottom: true, start: false, end: true });
  });

  it('une sobreposições em faixas sem contar célula duas vezes', () => {
    const rects = [
      rectOf({ anchorRow: 0, anchorCol: 0, endRow: 3, endCol: 1 }),
      rectOf({ anchorRow: 2, anchorCol: 1, endRow: 5, endCol: 2 }),
    ];
    const bands = rowBands(rects);

    expect(bands).toEqual([
      { top: 0, bottom: 1, columns: [[0, 1]] },
      { top: 2, bottom: 3, columns: [[0, 2]] },
      { top: 4, bottom: 5, columns: [[1, 2]] },
    ]);
    // 2×2 + 2×3 + 2×2
    expect(countCells(bands, (top, bottom) => bottom - top + 1)).toBe(14);
    expect(bandColumns(bands)).toEqual([0, 1, 2]);
  });

  it('1 milhão × 300 sem custo por célula', () => {
    const bands = rowBands([rectOf({ anchorRow: 0, anchorCol: 0, endRow: 999_999, endCol: 299 })]);
    expect(countCells(bands, (top, bottom) => bottom - top + 1)).toBe(300_000_000);
  });
});

describe('cell-range: colar', () => {
  it('lê TSV do Excel (aspas, CRLF, quebra final)', () => {
    expect(parseTsv('a\tb\r\nc\td\r\n')).toEqual([['a', 'b'], ['c', 'd']]);
    expect(parseTsv('"x\ty"\t"a ""b"""\n"linha\nnova"\t')).toEqual([['x\ty', 'a "b"'], ['linha\nnova', '']]);
    expect(parseTsv('só')).toEqual([['só']]);
    expect(parseTsv('')).toEqual([]);
  });

  it('tira o apóstrofo de proteção só antes de fórmula', () => {
    const quote = String.fromCharCode(39);
    expect(unescapePasted(`${quote}=1+1`)).toBe('=1+1');
    expect(unescapePasted(`${quote}-5`)).toBe('-5');
    expect(unescapePasted(`${quote}abc`)).toBe(`${quote}abc`);
  });

  it('mosaico, preenchimento e bloco a partir do canto', () => {
    expect(pasteSize(1, 1, 4, 3)).toEqual({ rows: 4, cols: 3 });
    expect(pasteSize(2, 1, 4, 3)).toEqual({ rows: 4, cols: 3 });
    expect(pasteSize(3, 2, 4, 3)).toEqual({ rows: 3, cols: 2 });
    expect(pasteSize(3, 2, 1, 1)).toEqual({ rows: 3, cols: 2 });
  });
});

describe('Rows.dataRowsBefore', () => {
  const group = (key: string): GroupRow => ({ isGroup: true, key, level: 0, column: {}, value: key, items: [], expanded: true } as unknown as GroupRow);

  it('conta linhas de dados sem grupos nem detalhes', () => {
    const rows = new RowList(item => String(item));
    rows.push(group('g1'));
    rows.pushItems([1, 2, 3], { all: false, positions: Int32Array.from([1]) });
    rows.push(group('g2'));
    rows.pushItems([4, 5]);
    // g1, 1, 2, det2, 3, g2, 4, 5
    expect(rows.length).toBe(8);
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(index => rows.dataRowsBefore(index))).toEqual([0, 0, 1, 2, 2, 3, 3, 4, 5]);

    const page = new RowPage(rows, 2, 4);
    expect(page.dataRowsBefore(4)).toBe(2);

    const added = new RowsWithAdded(rows, [{ position: 1, rowKey: {}, row: { isGroup: false, key: 'n', item: {}, index: 0 } }]);
    expect(added.dataRowsBefore(3)).toBe(2);
    expect(added.dataRowsBefore(9)).toBe(6);
  });
});
