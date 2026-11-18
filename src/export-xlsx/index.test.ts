/**
 * Adaptador xlsx com um ExcelJS falso (estrutural): o pacote não depende do
 * ExcelJS. Conferido à mão contra o exceljs 4 real (tipos e arquivo lido de
 * volta) ao criar a frente 12.
 */
import { describe, expect, it } from 'vitest';

import type { GridExportData } from '../export/types.js';
import type { GridColumnDef } from '../grid-column-def.js';
import type { DataGrid } from '../grid.js';
import { datePatternOf, numberFormatOf } from './formats.js';
import { exportXlsx } from './index.js';

class FakeCell {
  value: unknown = null;
  numFmt?: string;
}

class FakeRow {
  outlineLevel?: number;
  font?: unknown;
  readonly cells: FakeCell[];

  constructor(values: unknown[]) {
    this.cells = values.map(value => Object.assign(new FakeCell(), { value }));
  }

  getCell(index: number): FakeCell {
    return this.cells[index - 1] ??= new FakeCell();
  }
}

class FakeWorksheet {
  readonly rows: FakeRow[] = [];
  readonly merges: number[][] = [];
  readonly widths: Record<number, number | undefined> = {};
  properties: { outlineLevelRow?: number } = {};

  readonly name?: string;

  constructor(name?: string) {
    this.name = name;
  }

  addRow(values: unknown[]): FakeRow {
    const row = new FakeRow(values);
    this.rows.push(row);
    return row;
  }

  getColumn(index: number): { width?: number } {
    const widths = this.widths;
    return {
      set width(value: number | undefined) {
        widths[index] = value;
      },
    };
  }

  mergeCells(...range: number[]): void {
    this.merges.push(range);
  }
}

class FakeWorkbook {
  sheet?: FakeWorksheet;
  xlsx = { writeBuffer: () => Promise.resolve(new TextEncoder().encode('xlsx')) };

  addWorksheet(name?: string): FakeWorksheet {
    this.sheet = new FakeWorksheet(name);
    return this.sheet;
  }
}

const FakeExcelJS = { Workbook: FakeWorkbook };

const nameColumn: GridColumnDef = { path: 'name' };
const amount: GridColumnDef = { path: 'amount', format: { minimumFractionDigits: 2 } };
const born: GridColumnDef = { path: 'born' };
const shown: GridColumnDef = { path: 'code', displayValue: value => `#${String(value)}` };
const flag: GridColumnDef = { path: 'flag', booleanDisplay: 'icon' };

const data: GridExportData = {
  columns: [
    { column: nameColumn, label: 'Name', dataType: 'string', alignment: 'start', width: 140 },
    { column: amount, label: 'Amount', dataType: 'number', alignment: 'end' },
    { column: born, label: 'Born', dataType: 'date', alignment: 'start' },
    { column: shown, label: 'Code', dataType: 'number', alignment: 'end' },
    { column: flag, label: 'Flag', dataType: 'boolean', alignment: 'center' },
  ],
  rows: [
    {
      rowType: 'group', level: 0, groupPath: ['BR'], column: nameColumn, value: 'BR', text: 'BR', label: 'Country: BR (1)', itemCount: 1,
      summaries: [[], [], [], [], []], texts: ['', '', '', '', ''],
    },
    { rowType: 'data', level: 1, item: {}, values: ['=1+1', 1200.5, new Date(2024, 0, 15), 7, true], texts: ['=1+1', '1,200.50', '1/15/2024', '#7', 'Yes'] },
    { rowType: 'group-footer', level: 1, groupPath: ['BR'], summaries: [], texts: ['', 'Max: 1,200.50', '', '', ''] },
    { rowType: 'total', level: 0, groupPath: null, summaries: [], texts: ['', 'Sum: 1,200.50', '', '', ''] },
  ],
};

const fakeGrid = (options: { seen?: unknown[] } = {}): DataGrid => ({
  language: 'en',
  getExportData: (exportOptions: unknown) => {
    options.seen?.push(exportOptions);
    return Promise.resolve(data);
  },
}) as unknown as DataGrid;

describe('exportXlsx', () => {
  it('cabeçalho, grupo mesclado com outline, dados tipados, rodapé e totais', async () => {
    let workbook: FakeWorkbook | undefined;
    const seen: unknown[] = [];
    const blob = await exportXlsx(fakeGrid({ seen }), FakeExcelJS, {
      sheetName: 'Sales',
      selectedOnly: true,
      customize: (worksheet, book) => {
        workbook = book;
        expect(worksheet.rows).toHaveLength(5);
      },
    });

    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(seen).toEqual([expect.objectContaining({ selectedOnly: true })]);

    const sheet = workbook!.sheet!;
    expect(sheet.name).toBe('Sales');
    expect(sheet.rows.map(row => row.cells.map(cell => cell.value))).toEqual([
      ['Name', 'Amount', 'Born', 'Code', 'Flag'],
      ['Country: BR (1)', null, null, null, null],
      ['=1+1', 1200.5, new Date(Date.UTC(2024, 0, 15)), '#7', 'Yes'],
      [null, 'Max: 1,200.50', null, null, null],
      [null, 'Sum: 1,200.50', null, null, null],
    ]);
    expect(sheet.rows.map(row => row.outlineLevel ?? 0)).toEqual([0, 0, 1, 1, 0]);
    expect(sheet.rows.map(row => !!row.font)).toEqual([true, true, false, false, true]);
    expect(sheet.rows[2].cells.map(cell => cell.numFmt)).toEqual([undefined, '#,##0.00#', 'mm/dd/yyyy', undefined, undefined]);
    expect(sheet.merges).toEqual([[2, 1, 2, 5]]);
    expect(sheet.widths).toEqual({ 1: 20 });
    expect(sheet.properties.outlineLevelRow).toBe(1);
  });

  it('sem cabeçalho; aborto rejeita', async () => {
    let workbook: FakeWorkbook | undefined;
    await exportXlsx(fakeGrid(), FakeExcelJS, { includeHeaders: false, customize: (_, book) => {
      workbook = book;
    } });
    expect(workbook!.sheet!.name).toBe('Sheet1');
    expect(workbook!.sheet!.rows[0].cells[0].value).toBe('Country: BR (1)');

    const controller = new AbortController();
    controller.abort();
    await expect(exportXlsx(fakeGrid(), FakeExcelJS, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('formatos do Excel', () => {
  it('número: casas, milhar, porcentagem, moeda; casas opcionais = General', () => {
    expect(numberFormatOf({ minimumFractionDigits: 2, maximumFractionDigits: 2 }, 'en')).toBe('#,##0.00');
    expect(numberFormatOf({ maximumFractionDigits: 0 }, 'en')).toBe('#,##0');
    expect(numberFormatOf({ style: 'percent', minimumFractionDigits: 1 }, 'en')).toBe('#,##0.0%');
    expect(numberFormatOf({ style: 'currency', currency: 'USD' }, 'en')).toBe('"$"#,##0.00');
    expect(numberFormatOf({ style: 'currency', currency: 'EUR' }, 'de')).toBe('#,##0.00 "€"');
    expect(numberFormatOf(undefined, 'en')).toBeUndefined();
  });

  it('data na ordem do idioma; datetime com hora', () => {
    expect(datePatternOf('date', 'en')).toBe('mm/dd/yyyy');
    expect(datePatternOf('date', 'pt')).toBe('dd/mm/yyyy');
    expect(datePatternOf('date', 'de')).toBe('dd.mm.yyyy');
    expect(datePatternOf('datetime', 'ja')).toBe('yyyy/mm/dd hh:mm');
  });
});
