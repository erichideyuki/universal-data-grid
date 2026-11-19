import { afterEach, describe, expect, it } from 'vitest';

import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid } from './grid.js';
import {
  cellText,
  cleanup,
  createGrid,
  dataRows,
  groupLabels,
  settle,
} from './test/fixture.js';
import { expectCollected, track, type Tracked } from './test/leak.js';

afterEach(cleanup);

const jan15 = new Date(2024, 0, 15, 13, 5);

const typedColumns = (): GridColumnDef[] => [
  { path: 'name', label: 'Name' },
  { path: 'amount', label: 'Amount' },
  { path: 'total', label: 'Total', format: { minimumFractionDigits: 2 } },
  { path: 'when', label: 'When' },
  { path: 'iso', label: 'ISO', dataType: 'date' },
  { path: 'active', label: 'Active' },
];

const typedItems = () => [
  { name: 'a', amount: 1234.5, total: 1234.5, when: jan15, iso: '2024-03-05', active: true },
  { name: 'b', amount: null, total: 2, when: null, iso: 'garbage', active: false },
];

const rowTexts = (grid: DataGrid, row = 0): string[] =>
  [...dataRows(grid)[row].cells].map(cellText);

const cell = (grid: DataGrid, row: number, column: number): HTMLTableCellElement =>
  dataRows(grid)[row].cells[column];

const header = (grid: DataGrid, column: number): HTMLElement =>
  grid.shadowRoot!.querySelectorAll<HTMLElement>('th.header-column')[column];

/** Lado em que o texto da célula encosta: compara as bordas do texto e da célula. */
const textSide = (td: HTMLElement): 'left' | 'right' | 'center' => {
  const range = document.createRange();
  range.selectNodeContents(td);

  const text = range.getBoundingClientRect();
  const box = td.getBoundingClientRect();
  const left = text.left - box.left;
  const right = box.right - text.right;

  return Math.abs(left - right) < 4 ? 'center' : left < right ? 'left' : 'right';
};

describe('formatação por idioma', () => {
  const cases: [string, string[], string[]][] = [
    ['en', ['a', '1234.5', '1,234.50', '1/15/2024', '3/5/2024', 'True'], ['b', '', '2.00', '', 'garbage', 'False']],
    ['pt', ['a', '1234,5', '1.234,50', '15/01/2024', '05/03/2024', 'Verdadeiro'], ['b', '', '2,00', '', 'garbage', 'Falso']],
    ['de', ['a', '1234,5', '1.234,50', '15.1.2024', '5.3.2024', 'Wahr'], ['b', '', '2,00', '', 'garbage', 'Falsch']],
  ];

  for (const [language, first, second] of cases) {
    it(language, async () => {
      const grid = await createGrid({
        columns: typedColumns(),
        items: typedItems(),
        configure: g => g.language = language,
      });

      expect(rowTexts(grid, 0)).toEqual(first);
      expect(rowTexts(grid, 1)).toEqual(second);
    });
  }

  it('ar: formatado pelo Intl do árabe e booleano traduzido', async () => {
    const grid = await createGrid({ columns: typedColumns(), items: typedItems(), configure: g => g.language = 'ar' });
    const texts = rowTexts(grid, 0);

    expect(texts[2]).toBe(new Intl.NumberFormat('ar', { minimumFractionDigits: 2 }).format(1234.5));
    expect(texts[3]).toBe(new Intl.DateTimeFormat('ar', { year: 'numeric', month: 'numeric', day: 'numeric' }).format(jan15));
    expect(texts[5]).toBe('صحيح');
  });

  it('trocar o idioma ao vivo reformata as células', async () => {
    const grid = await createGrid({ columns: typedColumns(), items: typedItems(), configure: g => g.language = 'en' });

    grid.language = 'de';
    await settle(grid);

    expect(rowTexts(grid, 0).slice(1, 4)).toEqual(['1234,5', '1.234,50', '15.1.2024']);
  });
});

describe('alinhamento', () => {
  const columns = (): GridColumnDef[] => [
    { path: 'name', label: 'Name', width: 200 },
    { path: 'amount', label: 'Amount', width: 200 },
    { path: 'active', label: 'Active', width: 200 },
    { path: 'n', label: 'N', width: 200, alignment: 'start' },
  ];
  const items = [{ name: 'a', amount: 1, active: true, n: 2 }];

  it('LTR: texto à esquerda, número à direita, booleano ao centro; cabeçalho acompanha', async () => {
    const grid = await createGrid({ columns: columns(), items });

    expect([0, 1, 2, 3].map(i => textSide(cell(grid, 0, i)))).toEqual(['left', 'right', 'center', 'left']);
    expect([0, 1, 2].map(i => getComputedStyle(header(grid, i)).textAlign)).toEqual(['start', 'end', 'center']);
  });

  it('RTL: end vai para a esquerda', async () => {
    const grid = await createGrid({ columns: columns(), items, configure: g => g.dir = 'rtl' });

    expect([0, 1, 2, 3].map(i => textSide(cell(grid, 0, i)))).toEqual(['right', 'left', 'center', 'right']);
    // Cabeçalho: o rótulo (o "⋮" fica na outra ponta, como no AG Grid).
    const label = header(grid, 1).querySelector('.header-text')!.getBoundingClientRect();
    const box = header(grid, 1).getBoundingClientRect();
    expect(label.left - box.left).toBeLessThan(box.right - label.right);
  });
});

describe('agrupamento com valueGetter/displayValue', () => {
  it('agrupa pelo valor calculado e rotula pelo displayValue', async () => {
    const grid = await createGrid({
      columns: [
        {
          label: 'Size',
          groupIndex: 0,
          valueGetter: (item: any) => item.n >= 10 ? 'big' : 'small',
          displayValue: value => value === 'big' ? 'Big ones' : 'Small ones',
        },
        { path: 'n', label: 'N' },
      ],
      items: [{ n: 1 }, { n: 20 }, { n: 3 }],
    });

    expect(groupLabels(grid)).toEqual(['Size: Big ones', 'Size: Small ones']);
  });

  it('grupo de booleano e de data usam o texto formatado', async () => {
    const grid = await createGrid({
      columns: [
        { path: 'active', label: 'Active', groupIndex: 0 },
        { path: 'when', label: 'When', groupIndex: 1 },
      ],
      items: [{ active: true, when: '2024-03-05' }],
      configure: g => {
        g.language = 'pt';
        g.autoExpandGroups = true;
      },
    });

    expect(groupLabels(grid)).toEqual(['Active: Verdadeiro', 'When: 2024-03-05']);

    grid.columns = [
      { path: 'active', label: 'Active', groupIndex: 0 },
      { path: 'when', label: 'When', groupIndex: 1, dataType: 'date' },
    ];
    await settle(grid);

    expect(groupLabels(grid)).toEqual(['Active: Verdadeiro', 'When: 05/03/2024']);
  });
});

describe('texto vazio, reticências e quebra', () => {
  it('emptyText por coluna', async () => {
    const grid = await createGrid({
      columns: [{ path: 'a', label: 'A', emptyText: 'n/a' }, { path: 'b', label: 'B' }],
      items: [{ a: null, b: null }],
    });

    expect(rowTexts(grid)).toEqual(['n/a', '']);
  });

  it('title só na célula truncada, ao passar o mouse', async () => {
    const long = 'a very long text that will never fit in a narrow column';
    const grid = await createGrid({
      columns: [{ path: 'a', label: 'A', width: 80 }, { path: 'b', label: 'B', width: 300 }],
      items: [{ a: long, b: 'short' }],
    });
    const [truncated, fits] = [cell(grid, 0, 0), cell(grid, 0, 1)];

    truncated.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, composed: true }));
    fits.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, composed: true }));

    expect(truncated.title).toBe(long);
    expect(fits.hasAttribute('title')).toBe(false);
  });

  it('wrap quebra em várias linhas e o virtualizador mede a altura', async () => {
    const long = Array(30).fill('word')
      .join(' ');
    const grid = await createGrid({
      columns: [{ path: 'a', label: 'A', width: 120, wrap: true }, { path: 'b', label: 'B' }],
      items: [{ a: long, b: 1 }, { a: 'x', b: 2 }],
    });
    await settle(grid);

    const [first, second] = dataRows(grid);
    const firstRect = first.getBoundingClientRect();

    expect(first.cells[0].classList.contains('truncate')).toBe(false);
    expect(firstRect.height).toBeGreaterThan(grid.rowHeight * 2);
    // A 2ª linha começa onde a 1ª termina (sem sobreposição nem buraco).
    expect(Math.abs(second.getBoundingClientRect().top - firstRect.bottom)).toBeLessThan(2);
  });
});

describe('minWidth', () => {
  it('largura nunca abaixo de minWidth', async () => {
    const grid = await createGrid({
      columns: [
        { path: 'a', label: 'A', width: 50, minWidth: 150 },
        { path: 'b', label: 'B', minWidth: 400 },
        { path: 'c', label: 'C' },
      ],
      items: [{ a: 1, b: 2, c: 3 }],
      configure: g => g.style.width = '500px',
    });

    expect(header(grid, 0).getBoundingClientRect().width).toBeGreaterThanOrEqual(150);
    expect(header(grid, 1).getBoundingClientRect().width).toBeGreaterThanOrEqual(400);
  });
});

describe('<u-grid-column>', () => {
  const declarative = async (markup: string, items: any[], language = 'en'): Promise<DataGrid> => {
    const grid = document.createElement('u-grid');
    grid.style.cssText = 'display:block;height:300px';
    grid.language = language;
    grid.innerHTML = markup;
    grid.items = items;
    document.body.append(grid);
    await settle(grid);
    return grid;
  };

  it('atributos kebab-case: type, alignment, empty-text, wrap, min-width', async () => {
    const grid = await declarative(`
      <u-grid-column path="d" type="date" alignment="center" min-width="200">D</u-grid-column>
      <u-grid-column path="e" empty-text="—" wrap>E</u-grid-column>`, [{ d: '2024-03-05', e: null }], 'pt');

    const [d, e] = grid.querySelectorAll('u-grid-column');

    expect([d.dataType, d.alignment, d.minWidth, e.emptyText, e.wrap]).toEqual(['date', 'center', 200, '—', true]);
    expect(rowTexts(grid)).toEqual(['05/03/2024', '—']);
    expect(cell(grid, 0, 0).classList.contains('align-center')).toBe(true);
    expect(cell(grid, 0, 1).classList.contains('wrap')).toBe(true);
  });

  it('funções e objetos não viram atributo', async () => {
    const grid = await declarative(
      '<u-grid-column path="a" format="oops" value-getter="oops" display-value="oops">A</u-grid-column>',
      [{ a: 1.5 }],
      'de',
    );
    const column = grid.querySelector('u-grid-column')!;

    expect([column.format, column.valueGetter, column.displayValue]).toEqual([null, null, null]);
    expect(rowTexts(grid)).toEqual(['1,5']);
  });

  it('mudar format/valueGetter/dataType re-renderiza e reagrupa', async () => {
    const grid = await declarative(`
      <u-grid-column path="g" group-index="0">G</u-grid-column>
      <u-grid-column path="n">N</u-grid-column>`, [{ g: 'x', n: 1 }, { g: 'y', n: 2 }]);
    const [g, n] = grid.querySelectorAll('u-grid-column');

    n.format = { minimumFractionDigits: 1 };
    g.valueGetter = () => 'same';
    await settle(grid);
    await settle(grid);

    expect(groupLabels(grid)).toEqual(['G: same']);

    grid.autoExpandGroups = true;
    await settle(grid);
    expect(rowTexts(grid).at(-1)).toBe('1.0');

    n.dataType = 'string';
    await settle(grid);
    await settle(grid);
    expect(rowTexts(grid).at(-1)).toBe('1');
  });
});

describe('booleanDisplay: icon', () => {
  const icons = (grid: DataGrid) =>
    dataRows(grid).map(tr => {
      const icon = tr.cells[1].querySelector('[role=img]');
      return icon ? icon.getAttribute('aria-label') : cellText(tr.cells[1]);
    });

  it('ícone com o texto traduzido como nome acessível; vazio e grupo em texto', async () => {
    const grid = await createGrid({
      columns: [
        { path: 'name', label: 'Name' },
        { path: 'ok', label: 'OK', booleanDisplay: 'icon', emptyText: '—' },
      ],
      items: [{ name: 'a', ok: true }, { name: 'b', ok: false }, { name: 'c', ok: null }],
      configure: g => g.language = 'pt',
    });

    expect(icons(grid)).toEqual(['Verdadeiro', 'Falso', '—']);
    expect(dataRows(grid)[0].cells[1].querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(textSide(cell(grid, 0, 1))).toBe('center');

    grid.language = 'ar';
    grid.dir = 'rtl';
    await settle(grid);
    expect(icons(grid).slice(0, 2)).toEqual(['صحيح', 'خطأ']);
    expect(textSide(cell(grid, 0, 1))).toBe('center');

    grid.columns = [
      { path: 'ok', label: 'OK', booleanDisplay: 'icon', groupIndex: 0 },
      { path: 'name', label: 'Name' },
    ];
    await settle(grid);
    expect(groupLabels(grid)).toEqual(['OK:', 'OK: خطأ', 'OK: صحيح']);
  });

  it('atributo boolean-display e troca ao vivo', async () => {
    const grid = document.createElement('u-grid');
    grid.style.cssText = 'display:block;height:300px';
    grid.language = 'en';
    grid.innerHTML = '<u-grid-column path="name">Name</u-grid-column><u-grid-column path="ok" boolean-display="icon">OK</u-grid-column>';
    grid.items = [{ name: 'a', ok: true }];
    document.body.append(grid);
    await settle(grid);

    const column = grid.querySelectorAll('u-grid-column')[1];
    expect(column.booleanDisplay).toBe('icon');
    expect(icons(grid)).toEqual(['True']);
    expect(cell(grid, 0, 1).querySelector('[role=img]')).not.toBeNull();

    column.booleanDisplay = 'text';
    await settle(grid);
    await settle(grid);
    expect(cell(grid, 0, 1).querySelector('[role=img]')).toBeNull();
    expect(cellText(cell(grid, 0, 1))).toBe('True');
  });
});

describe('memória (spec 14)', () => {
  it('grid com ícone booleano, trocas de idioma/direção/modo e removido é coletado', async () => {
    const scenario = async (): Promise<Tracked> => {
      const items = Array.from({ length: 200 }, (_, n) => ({ n, ok: n % 3 ? n % 2 === 0 : null, when: '2024-03-05' }));
      const columns: GridColumnDef[] = [
        { path: 'n', label: 'N', format: { minimumFractionDigits: 1 } },
        { path: 'ok', label: 'OK', booleanDisplay: 'icon', emptyText: '—' },
        { path: 'when', label: 'When', dataType: 'date', valueGetter: (item: any) => item.when },
      ];
      const grid = await createGrid({ columns, items });
      const icon = cell(grid, 0, 1).querySelector('[role=img]') ?? cell(grid, 1, 1).querySelector('[role=img]');
      expect(icon).not.toBeNull();

      for (const language of ['pt', 'de', 'ar', 'en']) {
        grid.language = language;
        grid.dir = language === 'ar' ? 'rtl' : '';
        await settle(grid);
      }

      grid.columns = columns.map(column => column.booleanDisplay ? { ...column, booleanDisplay: 'text' } : column);
      await settle(grid);
      grid.columns = columns;
      await settle(grid);
      grid.remove();
      await settle(grid);

      return track({ grid, items, item: items[0], columns, icon: icon! });
    };

    await expectCollected(await scenario());
  });
});
