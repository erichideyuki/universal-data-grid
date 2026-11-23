/**
 * Linhas de exportação (frente 12): percorre o instantâneo do grid (itens já
 * filtrados e ordenados, árvore de grupos, resumos) e gera as linhas de
 * `getExportData()`, do CSV e da área de transferência. Sem DOM; o grid
 * monta a fonte (`ExportSource`) com os formatadores e textos dele.
 *
 * É um gerador SÍNCRONO: quem consome decide quando ceder a vez
 * (`slice.ts`) — uma promessa por linha custaria caro em 1 milhão de linhas.
 */
import type { GridColumnDef, GridRowFixed, GridSummaryItem, GridSummaryValue } from '../grid-column-def.js';
import type { GroupNode } from '../row-model/types.js';
import type {
  GridExportColumn,
  GridExportDataRow,
  GridExportGroupRow,
  GridExportRow,
  GridExportSummaryRow,
} from './types.js';

/** Uma coluna exportada e como ler/formatar a célula. */
export interface ExportColumnSource {
  info: GridExportColumn;
  read(item: unknown): unknown;
  /** Texto exibido do valor (o mesmo da célula). */
  text(value: unknown, item: unknown): string;
  /**
   * Formatação embutida (sem `displayValue` nem `format` em função): um valor
   * número/data tem texto confiável — isento da proteção contra fórmula.
   */
  builtIn: boolean;
}

/** Um resumo resolvido (de grupo ou total), na ordem dos valores do nó. */
export interface ExportSummarySource {
  item: GridSummaryItem & { display?: 'inline' | 'column' | 'footer' };
  column: GridColumnDef | undefined;
  /** `GridSummaryValue` público (valor cru + valor formatado). */
  value(raw: unknown): GridSummaryValue;
  /** Texto da célula (`"Sum: 1,234"`) e rótulo com a coluna (`"Sum of Amount: 1,234"`). */
  text(raw: unknown): { text: string; label: string };
}

export interface ExportSource {
  columns: readonly ExportColumnSource[];
  /** Itens na ordem da tela (filtrados; só os selecionados com `selectedOnly`). */
  items: readonly unknown[];
  /** Linhas fixas (frente 20): as do topo antes do corpo, as do fundo antes dos totais. */
  fixedTop?: readonly unknown[];
  fixedBottom?: readonly unknown[];
  /** Árvore de grupos sobre `items` (vazia sem agrupamento). */
  groups: readonly GroupNode[];
  /** Emite linhas de grupo; `false` = lista plana na ordem dos grupos. */
  includeGroups: boolean;
  includeSummaries: boolean;
  groupSummaries: readonly ExportSummarySource[];
  totalSummaries: readonly ExportSummarySource[];
  /** Valores dos totais, na ordem de `totalSummaries`. */
  totals: readonly unknown[];
  /** Valor do grupo formatado (como na linha de grupo). */
  groupValueText(node: GroupNode): string;
  /** Rótulo inteiro da linha de grupo: coluna, valor, contagem e `extra` (resumos inline). */
  groupLabel(node: GroupNode, valueText: string, extra: readonly string[]): string;
  /** Separador de lista do idioma (vários resumos na mesma coluna). */
  listSeparator: string;
  /** Árvore (frente 25): nível de cada item de `items` (sem ele, 0). */
  itemLevels?: ArrayLike<number>;
  /** Árvore: resumo por nó `display: 'column'` no lugar do valor (índice da coluna exportada → valor e texto). */
  itemOverrides?: (index: number) => ReadonlyMap<number, { value: unknown; text: string }> | undefined;
}

/** Célula de dados: valor e texto. */
export const dataRow = (source: ExportSource, item: unknown, level: number, fixed: GridRowFixed = null): GridExportDataRow => {
  const { columns } = source;
  const values = new Array<unknown>(columns.length);
  const texts = new Array<string>(columns.length);

  for (let i = 0; i < columns.length; i++) {
    const column = columns[i];
    const value = column.read(item);
    values[i] = value;
    texts[i] = column.text(value, item);
  }

  return { rowType: 'data', level, item, values, texts, fixed };
};

/** Onde um resumo entra: na célula da coluna, no rótulo do grupo, ou fica de fora. */
type Placement = 'cell' | 'label' | 'skip';

/** Resumos (com valores `raw`, na mesma ordem) distribuídos pelas colunas exportadas. */
const summaryCells = (
  source: ExportSource,
  summaries: readonly ExportSummarySource[],
  raw: readonly unknown[],
  place: (summary: ExportSummarySource, column: number) => Placement,
): { summaries: GridSummaryValue[][]; texts: string[]; labels: string[] } => {
  const count = source.columns.length;
  const cells: GridSummaryValue[][] = Array.from({ length: count }, () => []);
  const texts: string[][] = Array.from({ length: count }, () => []);
  const labels: string[] = [];

  summaries.forEach((summary, index) => {
    const column = summary.column ? source.columns.findIndex(candidate => candidate.info.column === summary.column) : -1;
    const placement = place(summary, column);

    if (placement === 'label') {
      labels.push(summary.text(raw[index]).label);
    } else if (placement === 'cell' && column >= 0) {
      cells[column].push(summary.value(raw[index]));
      texts[column].push(summary.text(raw[index]).text);
    }
  });

  return { summaries: cells, texts: texts.map(list => list.join(source.listSeparator)), labels };
};

const groupRow = (source: ExportSource, node: GroupNode): GridExportGroupRow => {
  // `column` vai para a coluna dele, menos a 1ª (lá fica o rótulo do grupo, como na tela);
  // `inline` (e `column` sem coluna exportada) entra no rótulo; `footer` vai para o rodapé.
  const { summaries, texts, labels } = summaryCells(
    source,
    source.includeSummaries ? source.groupSummaries : [],
    node.summaries,
    ({ item }, column) => {
      const display = item.display ?? 'inline';

      if (display === 'footer') {
        return 'skip';
      }

      return display === 'column' && column > 0 ? 'cell' : 'label';
    },
  );
  const text = source.groupValueText(node);

  return {
    rowType: 'group',
    level: node.level,
    groupPath: node.path,
    column: node.column,
    value: node.value,
    text,
    label: source.groupLabel(node, text, labels),
    itemCount: node.items.length,
    summaries,
    texts,
  };
};

const footerRow = (source: ExportSource, node: GroupNode): GridExportSummaryRow => {
  const { summaries, texts } = summaryCells(
    source,
    source.groupSummaries,
    node.summaries,
    ({ item }) => item.display === 'footer' ? 'cell' : 'skip',
  );

  return { rowType: 'group-footer', level: node.level + 1, groupPath: node.path, summaries, texts };
};

/** Linha de totais (ou `undefined` sem totais). */
export const totalRow = (source: ExportSource): GridExportSummaryRow | undefined => {
  if (!source.includeSummaries || !source.totalSummaries.length) {
    return undefined;
  }

  const { summaries, texts } = summaryCells(source, source.totalSummaries, source.totals, () => 'cell');
  return { rowType: 'total', level: 0, groupPath: null, summaries, texts };
};

/** Todas as linhas, na ordem da tela, com os grupos recolhidos abertos. */
export function* exportRows(source: ExportSource): Generator<GridExportRow, void, undefined> {
  const { groups, includeGroups } = source;
  const footers = includeGroups && source.includeSummaries
    && source.groupSummaries.some(summary => summary.item.display === 'footer');

  for (const item of source.fixedTop ?? []) {
    yield dataRow(source, item, 0, 'top');
  }

  if (!groups.length) {
    const { items, itemLevels, itemOverrides } = source;

    for (let index = 0; index < items.length; index++) {
      const row = dataRow(source, items[index], itemLevels?.[index] ?? 0);

      for (const [column, cell] of itemOverrides?.(index) ?? []) {
        row.values[column] = cell.value;
        row.texts[column] = cell.text;
      }

      yield row;
    }
  } else {
    const levels = includeGroups ? levelsOf(groups) : 0;

    // Pilha explícita (sem recursão de geradores: cada nível custaria um `yield*` por linha).
    const stack: { nodes: readonly GroupNode[]; index: number; parent?: GroupNode }[] = [{ nodes: groups, index: 0 }];

    while (stack.length) {
      const frame = stack[stack.length - 1];

      if (frame.index >= frame.nodes.length) {
        stack.pop();

        if (footers && frame.parent) {
          yield footerRow(source, frame.parent);
        }

        continue;
      }

      const node = frame.nodes[frame.index++];

      if (includeGroups) {
        yield groupRow(source, node);
      }

      if (node.children.length) {
        stack.push({ nodes: node.children, index: 0, parent: node });
        continue;
      }

      for (const item of node.items) {
        yield dataRow(source, item, levels);
      }

      if (footers) {
        yield footerRow(source, node);
      }
    }
  }

  for (const item of source.fixedBottom ?? []) {
    yield dataRow(source, item, 0, 'bottom');
  }

  const totals = totalRow(source);

  if (totals) {
    yield totals;
  }
}

/**
 * Nível mais fundo das linhas que `exportRows` vai gerar (sem percorrê-las):
 * o número de níveis de grupo, ou a profundidade da árvore. O xlsx declara o
 * outline antes das linhas (spec 29).
 */
export const exportMaxLevel = (source: ExportSource): number => {
  const levels = source.itemLevels;

  if (levels) {
    let max = 0;

    // eslint-disable-next-line @typescript-eslint/prefer-for-of -- `ArrayLike` (Int32Array da árvore) sem iterador garantido
    for (let i = 0; i < levels.length; i++) {
      max = Math.max(max, levels[i]);
    }

    return max;
  }

  return source.includeGroups ? levelsOf(source.groups) : 0;
};

const levelsOf = (groups: readonly GroupNode[]): number => {
  let levels = 0;
  let nodes = groups;

  while (nodes.length) {
    levels++;
    nodes = nodes[0].children;
  }

  return levels;
};
