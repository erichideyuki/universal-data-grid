import { describe, expect, it } from 'vitest';

import type { GridColumnDef, GridValidationContext, GridValidationRule } from '../grid-column-def.js';
import {
  copyData,
  EditStore,
  formatEditorDate,
  formatEditorNumber,
  mergeItem,
  parseEditorDate,
  parseEditorNumber,
  publicChange,
  setValueByPath,
} from './editing.js';
import { UnparsedValue, validateValue, type ValidationTexts } from './validation.js';

const texts: ValidationTexts = {
  validationRequired: 'required',
  validationRange: 'between {min} and {max}',
  validationRangeMin: 'at least {min}',
  validationRangeMax: 'at most {max}',
  validationStringLength: 'length {min}-{max}',
  validationStringLengthMin: 'length >= {min}',
  validationStringLengthMax: 'length <= {max}',
  validationPattern: 'pattern',
  validationEmail: 'email',
  validationNumber: 'number',
  validationDate: 'date',
  validationInvalid: 'invalid',
};

const column: GridColumnDef = { path: 'a' };
const ctx = (value: unknown): GridValidationContext => ({ value, item: {}, data: {}, column, rowKey: 1 });
const run = (rules: GridValidationRule[], value: unknown, signal = new AbortController().signal) =>
  validateValue(rules, ctx(value), texts, bound => String(bound), signal);

describe('edição: dados', () => {
  it('grava caminho com pontos em objetos novos', () => {
    const data: Record<string, unknown> = {};
    setValueByPath(data, 'address.city', 'X');
    setValueByPath(data, 'name', 'N');
    expect(data).toEqual({ address: { city: 'X' }, name: 'N' });
  });

  it('funde sem tocar o original e mantém o protótipo', () => {
    class Person {
      name = 'a';
      address = { city: 'c', zip: 'z' };
    }

    const item = new Person();
    const merged = mergeItem(item, { address: { city: 'X' } });

    expect(merged).toBeInstanceOf(Person);
    expect(merged.address).toEqual({ city: 'X', zip: 'z' });
    expect(item.address.city).toBe('c');
    expect(merged.name).toBe('a');
  });

  it('copia objetos simples, mantém datas', () => {
    const date = new Date(0);
    const data = { a: { b: 1 }, d: date };
    const copy = copyData(data);
    expect(copy).toEqual(data);
    expect(copy.a).not.toBe(data.a);
    expect(copy.d).toBe(date);
  });

  it('store: mudança pública é cópia; update vazio sai', () => {
    const store = new EditStore();
    const row = store.ensure(1, { a: 1 });
    row.data.a = 2;
    const change = publicChange(row);
    expect(change).toEqual({ type: 'update', rowKey: 1, data: { a: 2 }, item: { a: 1 } });
    (change.data as Record<string, unknown>).a = 9;
    expect(row.data.a).toBe(2);
    expect(store.mergedOf(row)).toEqual({ a: 2 });

    delete row.data.a;
    store.prune(row);
    expect(store.size).toBe(0);
  });
});

describe('edição: valores dos editores', () => {
  it('número no separador do idioma', () => {
    expect(formatEditorNumber(1234.5, 'pt-BR')).toBe('1234,5');
    expect(formatEditorNumber(1234.5, 'en')).toBe('1234.5');
    expect(parseEditorNumber('1.234,5', 'pt-BR')).toBe(1234.5);
    expect(parseEditorNumber('1234,5', 'pt-BR')).toBe(1234.5);
    expect(parseEditorNumber('1.234', 'pt-BR')).toBe(1234);
    expect(parseEditorNumber('1,234.5', 'en')).toBe(1234.5);
    expect(parseEditorNumber('-3', 'en')).toBe(-3);
    expect(parseEditorNumber('  ', 'en')).toBeNull();
    expect(parseEditorNumber('abc', 'en')).toBeInstanceOf(UnparsedValue);
    expect(parseEditorNumber('1 234,5', 'fr')).toBe(1234.5);
  });

  it('data no tipo do original', () => {
    expect(formatEditorDate(new Date(2024, 4, 1), false)).toBe('2024-05-01');
    expect(formatEditorDate(new Date(2024, 4, 1, 13, 5), true)).toBe('2024-05-01T13:05');
    expect(parseEditorDate('2024-05-02', '2024-05-01', false)).toBe('2024-05-02');
    expect(parseEditorDate('2024-05-02', new Date(), false)).toEqual(new Date(2024, 4, 2));
    expect(parseEditorDate('2024-05-02', 0, false)).toBe(new Date(2024, 4, 2).getTime());
    expect(parseEditorDate('', new Date(), false)).toBeNull();
  });
});

describe('validação', () => {
  it('regras síncronas; vazio só falha em required', () => {
    expect(run([{ type: 'required' }], ' ')).toMatchObject({ message: 'required' });
    expect(run([{ type: 'range', min: 1, max: 5 }], null)).toBeNull();
    expect(run([{ type: 'range', min: 1, max: 5 }], 6)).toMatchObject({ message: 'between 1 and 5' });
    expect(run([{ type: 'range', min: 1 }], 0)).toMatchObject({ message: 'at least 1' });
    expect(run([{ type: 'stringLength', max: 2 }], 'abc')).toMatchObject({ message: 'length <= 2' });
    expect(run([{ type: 'pattern', pattern: '[a-z]+' }], 'abc1')).toMatchObject({ message: 'pattern' });
    expect(run([{ type: 'pattern', pattern: '[a-z]+' }], 'abc')).toBeNull();
    expect(run([{ type: 'email' }], 'a@b')).toBeNull();
    expect(run([{ type: 'email' }], 'a@')).toMatchObject({ message: 'email' });
    expect(run([{ type: 'email', message: 'mine' }], 'x')).toMatchObject({ message: 'mine' });
    expect(run([], new UnparsedValue('x', 'number'))).toMatchObject({ message: 'number' });
  });

  it('custom síncrona e assíncrona; resposta abortada vira null', async () => {
    expect(run([{ type: 'custom', validate: () => 'no' }], 1)).toMatchObject({ message: 'no' });
    expect(run([{ type: 'custom', validate: () => false }], 1)).toMatchObject({ message: 'invalid' });
    await expect(run([{ type: 'custom', validate: () => Promise.resolve(true) }, { type: 'range', max: 0 }], 1))
      .resolves.toMatchObject({ message: 'at most 0' });

    const controller = new AbortController();
    const pending = run([{ type: 'custom', validate: () => new Promise(resolve => setTimeout(() => resolve('late'), 5)) }], 1, controller.signal);
    controller.abort();
    await expect(pending).resolves.toBeNull();
  });
});
