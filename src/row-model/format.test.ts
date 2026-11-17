import { describe, expect, it } from 'vitest';

import type { GridColumnDataType, GridColumnDef } from '../grid-column-def.js';
import { createComparer } from './compare.js';
import { flattenRows } from './flatten.js';
import {
  booleanIconValue,
  type FormatContext,
  formatCell,
  formatCellValue,
  getDateTimeFormat,
  getNumberFormat,
  resolveAlignment,
  resolveDataType,
  toDate,
} from './format.js';
import { buildGroups } from './group.js';
import { getCellValue } from './value.js';

const ctx = (language: string, dataType?: GridColumnDataType): FormatContext =>
  ({ language, dataType, trueText: 'True', falseText: 'False' });

const show = (value: unknown, language: string, dataType?: GridColumnDataType, column: GridColumnDef = {}) =>
  formatCellValue(value, {}, column, ctx(language, dataType));

describe('resolveDataType', () => {
  it('infere do 1º valor não nulo', () => {
    const column = { path: 'a' };

    expect(resolveDataType([{ a: null }, { a: undefined }, { a: 5 }], column)).toBe('number');
    expect(resolveDataType([{ a: true }], column)).toBe('boolean');
    expect(resolveDataType([{ a: new Date() }], column)).toBe('date');
    expect(resolveDataType([{ a: 'x' }, { a: 1 }], column)).toBe('string');
    expect(resolveDataType([{ a: 10n }], column)).toBe('number');
  });

  it('string ISO não vira data por inferência; o informado vence', () => {
    expect(resolveDataType([{ a: '2024-01-01' }], { path: 'a' })).toBe('string');
    expect(resolveDataType([{ a: '2024-01-01' }], { path: 'a', dataType: 'date' })).toBe('date');
  });

  it('sem valor, sem path ou objeto: indefinido', () => {
    expect(resolveDataType([], { path: 'a' })).toBeUndefined();
    expect(resolveDataType([{ a: null }], { path: 'a' })).toBeUndefined();
    expect(resolveDataType([{ a: 1 }], { label: 'Actions' })).toBeUndefined();
    expect(resolveDataType([{ a: { b: 1 } }], { path: 'a' })).toBeUndefined();
  });

  it('usa o valueGetter', () => {
    expect(resolveDataType([{ a: 'x' }], { valueGetter: () => 3 })).toBe('number');
  });
});

describe('toDate', () => {
  it('aceita Date, epoch e ISO', () => {
    const date = new Date(2024, 0, 15);

    expect(toDate(date)).toBe(date);
    expect(toDate(0)?.getTime()).toBe(0);
    expect(toDate('2024-01-15T10:30:00Z')?.getTime()).toBe(Date.UTC(2024, 0, 15, 10, 30));
    expect(toDate('2024-01-15T10:30')?.getHours()).toBe(10);
    expect(toDate('2024-01-15 10:30')?.getMinutes()).toBe(30);
  });

  it('data sem hora é meia-noite local (o dia não muda com o fuso)', () => {
    const date = toDate('2024-03-05')!;
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2024, 2, 5, 0]);
  });

  it('inválidas: texto qualquer, data que transborda, Invalid Date', () => {
    for (const value of ['garbage', '2024-02-30', '2023-02-29', '2024-13-01', '2024-01-01T25:00', '', '15/01/2024', new Date(Number.NaN), Number.NaN, Infinity, true, {}]) {
      expect(toDate(value), String(value)).toBeUndefined();
    }

    expect(toDate('2024-02-29')).toBeDefined();
  });
});

describe('formatCellValue', () => {
  const jan15 = new Date(2024, 0, 15, 13, 5);

  it('número sem format: sem milhar, separador decimal do idioma', () => {
    expect(show(1234.5, 'en', 'number')).toBe('1234.5');
    expect(show(1234.5, 'pt', 'number')).toBe('1234,5');
    expect(show(1234.5, 'de', 'number')).toBe('1234,5');
    expect(show(2020, 'en', 'number')).toBe('2020');
    expect(show(0.1, 'en', 'number')).toBe('0.1');
    expect(show(10n, 'en', 'number')).toBe('10');
    expect(show('42.5', 'pt', 'number')).toBe('42,5');
  });

  it('número com opções Intl', () => {
    const column = { format: { minimumFractionDigits: 2 } };

    expect(show(1234.5, 'en', 'number', column)).toBe('1,234.50');
    expect(show(1234.5, 'pt', 'number', column)).toBe('1.234,50');
    expect(show(1234.5, 'de', 'number', column)).toBe('1.234,50');
    expect(show(1234.5, 'ar', 'number', column))
      .toBe(new Intl.NumberFormat('ar', { minimumFractionDigits: 2 }).format(1234.5));
    expect(show(0.25, 'en', 'number', { format: { style: 'percent' } })).toBe('25%');
  });

  it('data e data/hora no idioma', () => {
    expect(show(jan15, 'en', 'date')).toBe('1/15/2024');
    expect(show(jan15, 'pt', 'date')).toBe('15/01/2024');
    expect(show(jan15, 'de', 'date')).toBe('15.1.2024');
    expect(show(jan15, 'ar', 'date'))
      .toBe(new Intl.DateTimeFormat('ar', { year: 'numeric', month: 'numeric', day: 'numeric' }).format(jan15));
    expect(show(jan15, 'ar', 'date')).not.toBe(show(jan15, 'en', 'date'));
    expect(show(jan15, 'de', 'datetime')).toBe('15.1.2024, 13:05');
    expect(show(jan15, 'en', 'datetime')).toMatch(/^1\/15\/2024, 1:05\sPM$/);
  });

  it('data de string ISO e epoch; inválida mostra o texto bruto', () => {
    expect(show('2024-03-05', 'pt', 'date')).toBe('05/03/2024');
    expect(show(jan15.getTime(), 'en', 'date')).toBe('1/15/2024');
    expect(show('not a date', 'en', 'date')).toBe('not a date');
    expect(show('2024-02-30', 'en', 'date')).toBe('2024-02-30');
    expect(show(new Date(Number.NaN), 'en', 'date')).toBe('');
  });

  it('data com opções Intl', () => {
    expect(show(jan15, 'en', 'date', { format: { month: 'long', year: 'numeric' } })).toBe('January 2024');
    expect(show(jan15, 'pt', 'date', { format: { month: 'long' } })).toBe('janeiro');
  });

  it('booleano pelos textos do idioma; não booleano sai cru', () => {
    expect(show(true, 'en', 'boolean')).toBe('True');
    expect(show(false, 'en', 'boolean')).toBe('False');
    expect(show('maybe', 'en', 'boolean')).toBe('maybe');
  });

  it('vazio: célula vazia ou emptyText', () => {
    expect(show(null, 'en', 'number')).toBe('');
    expect(show(undefined, 'en')).toBe('');
    expect(show(Number.NaN, 'en', 'number')).toBe('');
    expect(show(null, 'en', 'number', { emptyText: '—' })).toBe('—');
    expect(show(0, 'en', 'number', { emptyText: '—' })).toBe('0');
    expect(show(false, 'en', 'boolean', { emptyText: '—' })).toBe('False');
  });

  it('format função e displayValue (que vence tudo, inclusive vazio)', () => {
    const item = { currency: 'EUR' };
    const format = (value: unknown, row: any) => `${String(value)} ${row.currency}`;

    expect(formatCellValue(5, item, { format }, ctx('en', 'number'))).toBe('5 EUR');
    expect(formatCellValue(null, item, { format }, ctx('en', 'number'))).toBe('');
    expect(formatCellValue(5, item, { format, displayValue: (v, row) => `#${String(v)}/${row.currency}` }, ctx('en', 'number'))).toBe('#5/EUR');
    expect(formatCellValue(null, item, { displayValue: () => 'none', emptyText: '—' }, ctx('en'))).toBe('none');
  });

  it('sem tipo: texto cru', () => {
    expect(show('x', 'en')).toBe('x');
    expect(show(1234.5, 'de', 'string')).toBe('1234.5');
  });

  it('formatCell lê pelo valueGetter', () => {
    const column: GridColumnDef = { valueGetter: (item: any) => item.a * 2 };
    expect(formatCell({ a: 600.25 }, column, ctx('pt', 'number'))).toBe('1200,5');
  });
});

describe('formatadores Intl', () => {
  it('em cache por idioma e opções', () => {
    expect(getNumberFormat('pt', { minimumFractionDigits: 2 })).toBe(getNumberFormat('pt', { minimumFractionDigits: 2 }));
    expect(getNumberFormat('pt', { minimumFractionDigits: 2 })).not.toBe(getNumberFormat('de', { minimumFractionDigits: 2 }));
    expect(getDateTimeFormat('pt', { month: 'long' })).toBe(getDateTimeFormat('pt', { month: 'long' }));
  });

  it('idioma ou opções inválidos não lançam', () => {
    expect(show(1.5, 'not a language!', 'number')).toMatch(/^1[.,]5$/);
    expect(show(1.5, 'en', 'number', { format: { maximumFractionDigits: 500 } })).toBe('1.5');
    expect(show(1.5, 'en', 'number', { format: { style: 'currency' } })).toBe('1.5');
  });
});

describe('resolveAlignment', () => {
  it('end para número, center para booleano, start no resto; o informado vence', () => {
    expect(resolveAlignment({}, 'number')).toBe('end');
    expect(resolveAlignment({}, 'boolean')).toBe('center');
    expect(resolveAlignment({}, 'date')).toBe('start');
    expect(resolveAlignment({}, undefined)).toBe('start');
    expect(resolveAlignment({ alignment: 'center' }, 'number')).toBe('center');
  });
});

describe('createComparer com dataType', () => {
  const sortAs = (values: unknown[], dataType?: GridColumnDataType) =>
    [...values].sort(createComparer('en', dataType));

  it('number: strings numéricas pelo valor', () => {
    expect(sortAs(['10', '9', 1], 'number')).toEqual([1, '9', '10']);
  });

  it('date: ISO e epoch pelo tempo; inválidas depois', () => {
    const epoch = new Date(2023, 0, 1).getTime();
    expect(sortAs(['2024-03-05', 'garbage', epoch, '2020-01-01T00:00'], 'date'))
      .toEqual(['2020-01-01T00:00', epoch, '2024-03-05', 'garbage']);
  });

  it('string: números comparados como texto', () => {
    expect(sortAs([10, 9, 'a'], 'string')).toEqual([9, 10, 'a']);
    expect(createComparer('en', 'string')(10, '10')).toBe(0);
  });

  it('boolean: "true"/"false" em texto', () => {
    expect(sortAs(['true', false, 'false'], 'boolean')).toEqual([false, 'false', 'true']);
  });
});

describe('valueGetter e displayValue no agrupamento', () => {
  const items = [
    { name: 'Ana', born: '1990-05-01' },
    { name: 'Bia', born: '1985-02-10' },
    { name: 'Caio', born: '1990-11-30' },
  ];
  const decade: GridColumnDef = {
    label: 'Decade',
    valueGetter: (item: any) => Math.floor(Number(item.born.slice(0, 4)) / 10) * 10,
    displayValue: (value, item: any) => `${String(value)}s (${String(item.name)})`,
  };

  it('agrupa pelo valueGetter, e o grupo leva o 1º item', () => {
    const groups = buildGroups(items, [decade], column => createComparer('en', column.dataType));

    expect(groups.map(g => [g.value, g.items.length])).toEqual([[1980, 1], [1990, 2]]);

    const rows = flattenRows(items, groups, () => false, item => String((item as any).name));
    const groupRow = rows[1];

    expect(groupRow.isGroup && groupRow.firstItem).toBe(items[0]);
    expect(groupRow.isGroup && formatCellValue(groupRow.value, groupRow.firstItem, decade, ctx('en', 'number')))
      .toBe('1990s (Ana)');
  });

  it('dataType number junta 10 e "10" no mesmo grupo', () => {
    const column: GridColumnDef = { path: 'a', dataType: 'number' };
    const groups = buildGroups([{ a: 10 }, { a: '10' }, { a: '9' }], [column], c => createComparer('en', c.dataType));

    expect(groups.map(g => g.items.length)).toEqual([1, 2]);
  });

  it('getCellValue prefere valueGetter a path', () => {
    expect(getCellValue({ a: 1 }, { path: 'a', valueGetter: () => 2 })).toBe(2);
  });
});

describe('booleanIconValue', () => {
  const icon: GridColumnDef = { booleanDisplay: 'icon' };

  it('só em coluna boolean com booleanDisplay icon', () => {
    expect(booleanIconValue(true, icon, ctx('en', 'boolean'))).toBe(true);
    expect(booleanIconValue('false', icon, ctx('en', 'boolean'))).toBe(false);
    expect(booleanIconValue(true, {}, ctx('en', 'boolean'))).toBeUndefined();
    expect(booleanIconValue(true, { booleanDisplay: 'text' }, ctx('en', 'boolean'))).toBeUndefined();
    expect(booleanIconValue(true, icon, ctx('en', 'string'))).toBeUndefined();
  });

  it('vazio, não booleano, displayValue e format função ficam em texto', () => {
    expect(booleanIconValue(null, icon, ctx('en', 'boolean'))).toBeUndefined();
    expect(booleanIconValue('maybe', icon, ctx('en', 'boolean'))).toBeUndefined();
    expect(booleanIconValue(true, { ...icon, displayValue: () => 'x' }, ctx('en', 'boolean'))).toBeUndefined();
    expect(booleanIconValue(true, { ...icon, format: () => 'x' }, ctx('en', 'boolean'))).toBeUndefined();
  });
});
