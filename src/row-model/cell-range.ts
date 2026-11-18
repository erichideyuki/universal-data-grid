/**
 * Intervalos de células (frente 19) como RETÂNGULOS de índices, sem DOM e
 * sem nada por célula: linha = índice no corpo exibido; coluna = índice
 * navegável (só colunas de dados). A âncora fica parada; o `end` anda.
 */

export interface CellCorners {
  anchorRow: number;
  anchorCol: number;
  endRow: number;
  endCol: number;
}

/** Retângulo normalizado (inclusive nas quatro bordas). */
export interface CellRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export const rectOf = (corners: CellCorners): CellRect => ({
  top: Math.min(corners.anchorRow, corners.endRow),
  bottom: Math.max(corners.anchorRow, corners.endRow),
  left: Math.min(corners.anchorCol, corners.endCol),
  right: Math.max(corners.anchorCol, corners.endCol),
});

export const isSingleCell = (corners: CellCorners): boolean =>
  corners.anchorRow === corners.endRow && corners.anchorCol === corners.endCol;

export const sameCorners = (a: readonly CellCorners[], b: readonly CellCorners[]): boolean =>
  a.length === b.length && a.every((corners, index) => {
    const other = b[index];
    return corners.anchorRow === other.anchorRow && corners.anchorCol === other.anchorCol
      && corners.endRow === other.endRow && corners.endCol === other.endCol;
  });

/** Bordas externas dos intervalos em que a célula está. */
export interface RangeEdges {
  top: boolean;
  bottom: boolean;
  start: boolean;
  end: boolean;
}

/**
 * A célula está em algum intervalo? Devolve as bordas externas de cada
 * intervalo que a contém (O(intervalos), para as células renderizadas);
 * `null` fora de todos.
 */
export const cellRangeEdges = (rects: readonly CellRect[], row: number, col: number): RangeEdges | null => {
  let edges: RangeEdges | null = null;

  for (const rect of rects) {
    if (row < rect.top || row > rect.bottom || col < rect.left || col > rect.right) {
      continue;
    }

    edges ??= { top: false, bottom: false, start: false, end: false };
    edges.top ||= row === rect.top;
    edges.bottom ||= row === rect.bottom;
    edges.start ||= col === rect.left;
    edges.end ||= col === rect.right;
  }

  return edges;
};

/** Faixa de linhas em que o conjunto de intervalos não muda, com as colunas (unidas) cobertas. */
export interface RowBand {
  top: number;
  bottom: number;
  /** Intervalos de colunas [esquerda, direita], disjuntos e crescentes. */
  columns: [number, number][];
}

/** Une intervalos de colunas (inclusive) sobrepostos ou vizinhos. */
export const mergeSpans = (spans: [number, number][]): [number, number][] => {
  const sorted = [...spans].sort((a, b) => a[0] - b[0]);
  const result: [number, number][] = [];

  for (const [left, right] of sorted) {
    const last = result[result.length - 1];

    if (last && left <= last[1] + 1) {
      last[1] = Math.max(last[1], right);
    } else {
      result.push([left, right]);
    }
  }

  return result;
};

/**
 * União dos retângulos em faixas de linhas: O(intervalos²), não O(linhas).
 * Cada célula aparece uma vez (sobreposições não contam duas vezes).
 */
export const rowBands = (rects: readonly CellRect[]): RowBand[] => {
  const cuts = [...new Set(rects.flatMap(rect => [rect.top, rect.bottom + 1]))].sort((a, b) => a - b);
  const bands: RowBand[] = [];

  for (let i = 0; i < cuts.length - 1; i++) {
    const top = cuts[i];
    const bottom = cuts[i + 1] - 1;
    const spans = rects.filter(rect => rect.top <= top && rect.bottom >= bottom).map((rect): [number, number] => [rect.left, rect.right]);

    if (!spans.length) {
      continue;
    }

    const columns = mergeSpans(spans);
    const previous = bands[bands.length - 1];

    // Faixa vizinha com as mesmas colunas: junta.
    if (previous?.bottom === top - 1 && sameSpans(previous.columns, columns)) {
      previous.bottom = bottom;
    } else {
      bands.push({ top, bottom, columns });
    }
  }

  return bands;
};

const sameSpans = (a: [number, number][], b: [number, number][]): boolean =>
  a.length === b.length && a.every((span, index) => span[0] === b[index][0] && span[1] === b[index][1]);

/** Colunas (unidas) de um conjunto de faixas, crescentes. */
export const bandColumns = (bands: readonly RowBand[]): number[] => {
  const columns = new Set<number>();

  for (const band of bands) {
    for (const [left, right] of band.columns) {
      for (let col = left; col <= right; col++) {
        columns.add(col);
      }
    }
  }

  return [...columns].sort((a, b) => a - b);
};

/** Células da união, contando só linhas de dados (`dataRows(top, bottom)`: quantas há na faixa). */
export const countCells = (bands: readonly RowBand[], dataRows: (top: number, bottom: number) => number): number => {
  let count = 0;

  for (const band of bands) {
    const width = band.columns.reduce((sum, [left, right]) => sum + right - left + 1, 0);
    count += dataRows(band.top, band.bottom) * width;
  }

  return count;
};

// ---------------------------------------------------------------- colar

/**
 * TSV como as planilhas escrevem na área de transferência: campo com tab,
 * quebra de linha ou aspas vem entre aspas (`""` = aspas). CRLF e LF; a
 * quebra final não cria linha vazia.
 */
export const parseTsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let index = 0;
  let quoted = false;
  let fieldStart = true;

  const endField = () => {
    row.push(field);
    field = '';
    fieldStart = true;
  };

  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (index < text.length) {
    const char = text[index];

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }

        quoted = false;
        index++;
        continue;
      }

      field += char;
      index++;
      continue;
    }

    if (char === '"' && fieldStart) {
      quoted = true;
      fieldStart = false;
      index++;
      continue;
    }

    fieldStart = false;

    if (char === '\t') {
      endField();
    } else if (char === '\r' || char === '\n') {
      endRow();

      if (char === '\r' && text[index + 1] === '\n') {
        index++;
      }
    } else {
      field += char;
    }

    index++;
  }

  // Sem quebra final: a última linha ainda está aberta.
  if (!fieldStart || field || row.length) {
    endRow();
  }

  return rows;
};

/** Caracteres que a 12 protege com `'` (injeção de fórmula). */
const FORMULA_START = /^'[=+\-@\t\r]/;

/** Tira o `'` de proteção da 12 (ida e volta de copiar/colar). */
export const unescapePasted = (text: string): string => FORMULA_START.test(text) ? text.slice(1) : text;

/**
 * Tamanho do que se cola: bloco `rows × cols` sobre um destino de
 * `targetRows × targetCols` (o intervalo ativo, ou 1×1 da célula ativa).
 * Bloco 1×1 preenche o destino; destino múltiplo exato do bloco → mosaico;
 * senão o bloco inteiro a partir do canto (o chamador corta na borda).
 */
export const pasteSize = (rows: number, cols: number, targetRows: number, targetCols: number): { rows: number; cols: number } => {
  if (!rows || !cols) {
    return { rows: 0, cols: 0 };
  }

  const single = targetRows === 1 && targetCols === 1;

  if (!single && ((rows === 1 && cols === 1) || (targetRows % rows === 0 && targetCols % cols === 0))) {
    return { rows: targetRows, cols: targetCols };
  }

  return { rows, cols };
};
