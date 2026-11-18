import { describe, expect, it } from 'vitest';

import type { GridColumnDef, GridGroupSummaryItem } from '../grid-column-def.js';
import { createComparer } from '../row-model/compare.js';
import { buildGroups } from '../row-model/group.js';
import { summarize, type SummarySpec } from '../row-model/summary.js';
import type { GroupNode } from '../row-model/types.js';
import { type ExportSource, type ExportSummarySource } from './rows.js';
import type { GridExportGroupRow, GridExportRow } from './types.js';
import { clipboardContent, collectRows, writeCsv } from './write.js';

interface Sale {
  name: string;
  country: string;
  amount: number;
}

const items: Sale[] = [
  { name: 'Ana', country: 'BR', amount: 10 },
  { name: 'Bia', country: 'CL', amount: -5 },
  { name: 'Caio', country: 'BR', amount: 20 },
];

const nameColumn: GridColumnDef = { path: 'name', label: 'Name' };
const country: GridColumnDef = { path: 'country', label: 'Country' };
const amount: GridColumnDef = { path: 'amount', label: 'Amount', dataType: 'number' };

const exportColumn = (column: GridColumnDef) => ({
  info: { column, label: column.label ?? '', alignment: 'start' as const },
  read: (item: unknown) => (item as Record<string, unknown>)[column.path!],
  text: (value: unknown) => String(value),
  builtIn: true,
});

const summary = (item: GridGroupSummaryItem, column: GridColumnDef): { source: ExportSummarySource; spec: SummarySpec } => ({
  spec: { column, type: item.type, dataType: 'number' },
  source: {
    item,
    column,
    value: raw => ({ item, value: raw, text: String(raw) }),
    text: raw => ({ text: `${String(item.type)}: ${String(raw)}`, label: `${String(item.type)} of ${column.label}: ${String(raw)}` }),
  },
});

const source = (options: { grouped?: boolean; includeGroups?: boolean; summaries?: GridGroupSummaryItem[]; totals?: boolean } = {}): ExportSource => {
  const groupSummaries = (options.summaries ?? []).map(item => summary(item, amount));
  const totalSummaries = options.totals ? [summary({ column: 'amount', type: 'sum' }, amount)] : [];
  const groups: GroupNode[] = options.grouped
    ? buildGroups(items, [country], () => createComparer('en', undefined), [], groupSummaries.map(s => s.spec))
    : [];
  const flatColumns = options.includeGroups === false && options.grouped ? [country, nameColumn, amount] : [nameColumn, amount];

  return {
    columns: flatColumns.map(exportColumn),
    items,
    groups,
    includeGroups: options.includeGroups !== false,
    includeSummaries: true,
    groupSummaries: groupSummaries.map(s => s.source),
    totalSummaries: totalSummaries.map(s => s.source),
    totals: summarize(items, totalSummaries.map(s => s.spec)),
    listSeparator: ', ',
    groupValueText: node => String(node.value),
    groupLabel: (node, text, extra) => `${node.column.label}: ${text} (${[String(node.items.length), ...extra].join(', ')})`,
  };
};

const describeRows = (rows: readonly GridExportRow[]): string[] =>
  rows.map(row => {
    switch (row.rowType) {
      case 'data':
        return `${row.level} data ${row.texts.join('|')}`;
      case 'group':
        return `${row.level} group ${row.label} [${row.texts.join('|')}]`;
      default:
        return `${row.level} ${row.rowType} ${row.texts.join('|')}`;
    }
  });

describe('exportRows', () => {
  it('sem grupos: dados e totais', async () => {
    expect(describeRows(await collectRows(source({ totals: true }), undefined))).toEqual([
      '0 data Ana|10',
      '0 data Bia|-5',
      '0 data Caio|20',
      '0 total |sum: 25',
    ]);
  });

  it('grupos: resumo `column` na coluna, `inline` no rótulo, `footer` no rodapé', async () => {
    const rows = await collectRows(source({
      grouped: true,
      totals: true,
      summaries: [
        { column: 'amount', type: 'sum', display: 'column' },
        { column: 'amount', type: 'max' },
        { column: 'amount', type: 'min', display: 'footer' },
      ],
    }), undefined);

    expect(describeRows(rows)).toEqual([
      '0 group Country: BR (2, max of Amount: 20) [|sum: 30]',
      '1 data Ana|10',
      '1 data Caio|20',
      '1 group-footer |min: 10',
      '0 group Country: CL (1, max of Amount: -5) [|sum: -5]',
      '1 data Bia|-5',
      '1 group-footer |min: -5',
      '0 total |sum: 25',
    ]);
    expect((rows[0] as GridExportGroupRow).summaries[1]).toEqual([expect.objectContaining({ value: 30, text: '30' })]);
    expect(rows[3]).toMatchObject({ groupPath: ['BR'] });
  });

  it('resumo `column` na 1ª coluna vai para o rótulo (a célula é do rótulo)', async () => {
    const grouped = source({ grouped: true, summaries: [{ column: 'amount', type: 'sum', display: 'column' }] });
    const rows = await collectRows({ ...grouped, columns: [exportColumn(amount), exportColumn(nameColumn)] }, undefined);

    expect(describeRows(rows)[0]).toBe('0 group Country: BR (2, sum of Amount: 30) [|]');
  });

  it('`includeGroups: false`: lista plana na ordem dos grupos', async () => {
    expect(describeRows(await collectRows(source({ grouped: true, includeGroups: false }), undefined))).toEqual([
      '0 data BR|Ana|10',
      '0 data BR|Caio|20',
      '0 data CL|Bia|-5',
    ]);
  });
});

describe('writeCsv', () => {
  it('grupos e resumos: rótulo na 1ª célula, resumos nas colunas', async () => {
    const blob = await writeCsv(source({ grouped: true, totals: true, summaries: [{ column: 'amount', type: 'sum', display: 'column' }] }), { bom: false }, 'pt');

    expect((await blob.text()).split('\r\n')).toEqual([
      'Name;Amount',
      'Country: BR (2);sum: 30',
      'Ana;10',
      'Caio;20',
      'Country: CL (1);sum: -5',
      'Bia;-5',
      ';sum: 25',
      '',
    ]);
  });

  it('número com formatação embutida nunca recebe prefixo; texto e `displayValue` recebem', async () => {
    const rowsSource = source();
    const withDisplay = { ...exportColumn(nameColumn), builtIn: false, text: () => '-cmd' };
    const negative = { ...exportColumn(amount), text: () => '-R$ 5,00' };
    const blob = await writeCsv({ ...rowsSource, columns: [withDisplay, negative] }, { bom: false, includeHeaders: false }, 'en');

    expect((await blob.text()).split('\r\n')[1]).toBe('\'-cmd,"-R$ 5,00"');
  });

  it('`rawValues`: número com `.`, data ISO, vazio', async () => {
    const date = new Date(2024, 0, 15);
    const blob = await writeCsv({
      ...source(),
      items: [{ name: null, amount: 1234.5, born: date }],
      columns: [
        exportColumn(nameColumn),
        exportColumn(amount),
        { ...exportColumn({ path: 'born', label: 'Born' }), info: { column: { path: 'born' }, label: 'Born', alignment: 'start', dataType: 'date' } },
      ],
    }, { bom: false, includeHeaders: false, rawValues: true }, 'pt');

    expect(await blob.text()).toBe(';1234.5;2024-01-15\r\n');
  });
});

describe('clipboardContent', () => {
  it('TSV com CRLF entre linhas e HTML escapado; fórmulas sempre protegidas', async () => {
    const rows = await collectRows({ ...source(), items: [{ name: '<i>=x</i>', amount: 1 }, { name: 'a\tb', amount: 2 }] }, undefined);

    expect(clipboardContent(rows, source().columns)).toEqual({
      text: '<i>=x</i>\t1\r\n"a\tb"\t2',
      html: '<table><tbody><tr><td>&lt;i&gt;=x&lt;/i&gt;</td><td>1</td></tr><tr><td>a\tb</td><td>2</td></tr></tbody></table>',
    });
    expect(clipboardContent(await collectRows({ ...source(), items: [{ name: '=1+1', amount: 1 }] }, undefined), source().columns).text).toBe('\'=1+1\t1');
  });
});
