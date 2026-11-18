/**
 * Vazamento de memória da frente 09 (regra da spec 14): editores (embutidos
 * e `HTMLElement` do light DOM), validações assíncronas em curso, promessas
 * de `waitUntil` que nunca resolvem, o diálogo de exclusão e as mudanças
 * pendentes não podem segurar o grid, os `items`, as colunas nem as funções
 * do hospedeiro. Cada cenário roda numa função e devolve só `WeakRef`s.
 */
import { afterEach, describe, expect, it } from 'vitest';

import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid, GridSavingEventDetail } from './grid.js';
import { cleanup, createGrid, settle } from './test/fixture.js';
import { aliveAfterGc, expectCollected, heapDelta, kib, measureHeap, track, type Tracked } from './test/leak.js';

afterEach(cleanup);

const makeItems = (count: number, seed = 0) =>
  Array.from({ length: count }, (_, n) => ({ id: n + seed, name: `Name ${n + seed}`, age: n % 90 }));

const makeColumns = (pendingForever = { on: false }): GridColumnDef[] => [
  { path: 'id', label: 'Id', editable: false },
  {
    path: 'name',
    label: 'Name',
    validationRules: [
      { type: 'required' },
      // Assíncrona: com `pendingForever` nunca responde (validação em curso na remoção).
      { type: 'custom', validate: () => pendingForever.on ? new Promise<boolean>(() => undefined) : Promise.resolve(true) },
    ],
  },
  {
    path: 'age',
    label: 'Age',
    dataType: 'number',
    editorRenderer: (item, ctx) => {
      const input = document.createElement('input');
      input.value = String(ctx.value ?? '');
      input.addEventListener('input', () => ctx.setValue(Number(input.value)));
      return input;
    },
  },
];

const root = (grid: DataGrid): ShadowRoot => grid.shadowRoot!;

const press = async (grid: DataGrid, key: string): Promise<void> => {
  const target = (root(grid).activeElement ?? document.activeElement) as HTMLElement;
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true }));
  await settle(grid);
};

const typeInto = async (grid: DataGrid, text: string): Promise<void> => {
  const input = (root(grid).activeElement ?? document.activeElement) as HTMLInputElement;
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await settle(grid);
};

/** Edita (célula embutida e editor `HTMLElement`), adiciona, marca remoção, salva e descarta. */
const exercise = async (grid: DataGrid, keys: [number, number]): Promise<void> => {
  grid.editCell(keys[0], grid.columns[1]);
  await settle(grid);
  await typeInto(grid, 'Edited');
  await press(grid, 'Enter');
  await settle(grid);

  grid.editCell(keys[1], grid.columns[2]);
  await settle(grid);
  await typeInto(grid, '7');
  await press(grid, 'Escape');

  grid.addRow({ id: -1, name: 'New' });
  await settle(grid);
  await press(grid, 'Escape');
  await grid.removeRow(keys[1]);
  await settle(grid);
  await grid.saveChanges();
  await settle(grid);
  grid.discardChanges();
  await settle(grid);
};

describe('memória da edição', () => {
  it('grid removido com editor aberto, validação e salvamento pendentes e diálogo aberto é coletado', async () => {
    const scenario = async (): Promise<Tracked> => {
      const items = makeItems(500);
      const forever = { on: false };
      const columns = makeColumns(forever);
      const grid = await createGrid({
        columns,
        items,
        height: '300px',
        configure: g => {
          g.keyExpr = 'id';
          g.allowEditing = true;
          g.allowAdding = true;
          g.allowRemoving = true;
          g.editMode = 'batch';
        },
      });
      await exercise(grid, [1, 2]);

      // Validação assíncrona que nunca responde, editor `HTMLElement` aberto.
      forever.on = true;
      grid.editCell(3, columns[1]);
      await settle(grid);
      await typeInto(grid, 'Pending');
      await press(grid, 'Enter');
      grid.editCell(4, columns[2]);
      await settle(grid);
      expect(grid.querySelectorAll('[slot]').length).toBeGreaterThan(0);

      // Salvar que nunca termina (servidor fora do ar) e o diálogo de exclusão aberto.
      grid.addEventListener('u-grid-saving', event => {
        (event as CustomEvent<GridSavingEventDetail>).detail.waitUntil(new Promise<void>(() => undefined));
      });
      void grid.saveChanges();
      grid.editMode = 'cell';
      await settle(grid);
      root(grid).querySelector<HTMLElement>('tr[data-index="0"] .command-button')!.click();
      await settle(grid);
      expect(root(grid).querySelector('dialog')?.open).toBe(true);

      grid.remove();
      expect(grid._memoryStats.validations).toBe(0);
      expect(grid._memoryStats.editTimers).toBe(0);
      expect(grid.querySelectorAll('[slot]')).toHaveLength(0);

      return track({ grid, items, item: items[0], columns, validate: columns[1].validationRules![1], editor: columns[2].editorRenderer! });
    };

    await expectCollected(await scenario());
  });

  it('grid de vida longa: mudanças pendentes e editores somem; items e colunas trocados são soltos', async () => {
    const grid = await createGrid({ columns: makeColumns(), items: makeItems(300), height: '300px', configure: g => {
      g.keyExpr = 'id';
      g.allowEditing = true;
      g.allowAdding = true;
      g.allowRemoving = true;
    } });

    const replace = async (): Promise<Tracked> => {
      const items = makeItems(300, 1000);
      const columns = makeColumns();
      grid.items = items;
      grid.columns = columns;
      await settle(grid);
      grid.editMode = 'batch';
      await exercise(grid, [1001, 1002]);
      grid.items = makeItems(300, 2000);
      grid.columns = makeColumns();
      await settle(grid);

      return track({ items, item: items[0], columns, editor: columns[2].editorRenderer! });
    };

    await expectCollected(await replace());

    const stats = grid._memoryStats;
    expect(stats.pendingEdits).toBe(0);
    expect(stats.addedRows).toBe(0);
    expect(stats.validations).toBe(0);
    expect(stats.editLightNodes).toBe(0);
  });

  it('editar e salvar repetidamente não cresce heap, nós nem listeners', async () => {
    const grid = await createGrid({ columns: makeColumns(), items: makeItems(2000), height: '300px', configure: g => {
      g.keyExpr = 'id';
      g.allowEditing = true;
      g.allowAdding = true;
      g.allowRemoving = true;
      g.editMode = 'batch';
    } });
    let firstItems: Tracked | undefined;

    const round = async (n: number): Promise<void> => {
      const items = makeItems(2000, n * 10_000);
      firstItems ??= track({ items });
      grid.items = items;
      await settle(grid);
      await exercise(grid, [n * 10_000 + 1, n * 10_000 + 2]);
    };

    for (let n = 0; n < 3; n++) {
      await round(n);
    }

    const lightBefore = grid.childElementCount;
    const before = await measureHeap();

    for (let n = 3; n < 15; n++) {
      await round(n);
    }

    const delta = heapDelta(before, await measureHeap());
    const report = `heap ${kib(delta.jsHeapUsed)}, nós ${delta.nodes}, listeners ${delta.listeners}`;
    const stats = grid._memoryStats;

    expect(stats.pendingEdits).toBe(0);
    expect(stats.validations).toBe(0);
    expect(grid.childElementCount).toBe(lightBefore);
    expect(delta.jsHeapUsed, report).toBeLessThan(768 * 1024);
    expect(delta.nodes, report).toBeLessThan(60);
    expect(delta.listeners, report).toBeLessThan(30);
    expect(await aliveAfterGc(firstItems!)).toEqual([]);
  }, 180_000);
});
