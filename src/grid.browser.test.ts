import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GridColumnDef } from './grid-column-def.js';
import { setGridTranslation } from './grid-i18n.js';
import {
  bodyRows,
  cellText,
  cleanup,
  createGrid,
  dataRows,
  groupLabels,
  groupToggles,
  headerLabels,
  settle,
} from './test/fixture.js';

afterEach(cleanup);

const abc = (): GridColumnDef[] => [
  { path: 'a', label: 'A' },
  { path: 'b', label: 'B' },
  { path: 'c', label: 'C' },
];

describe('colunas (B2, B3, B9)', () => {
  it('B2: colunas definidas por propriedade antes de conectar são mantidas', async () => {
    const grid = await createGrid({ columns: abc(), items: [{ a: 1, b: 2, c: 3 }], setBeforeConnect: true });

    expect(headerLabels(grid)).toEqual(['A', 'B', 'C']);
    expect(dataRows(grid)).toHaveLength(1);
  });

  it('B3: desconectar não esvazia o array do hospedeiro e reconectar mantém as colunas', async () => {
    const columns = abc();
    const grid = await createGrid({ columns, items: [{ a: 1 }] });

    grid.remove();
    expect(columns).toHaveLength(3);

    document.body.append(grid);
    await settle(grid);
    expect(headerLabels(grid)).toEqual(['A', 'B', 'C']);
  });

  it('B9: a ordem arrastada pelo usuário sobrevive a reatribuir as mesmas colunas', async () => {
    const grid = await createGrid({ columns: abc(), items: [{ a: 1 }] });

    grid.moveColumn(grid._regularColumns[2], 0);
    await settle(grid);
    expect(headerLabels(grid)).toEqual(['C', 'A', 'B']);

    grid.columns = [...grid.columns];
    await settle(grid);
    expect(headerLabels(grid)).toEqual(['C', 'A', 'B']);
  });

  it('B9: não escreve campos internos nos objetos do hospedeiro', async () => {
    const columns = abc();
    const grid = await createGrid({ columns, items: [{ a: 1 }] });

    grid.moveColumn(grid._regularColumns[2], 0);
    await settle(grid);
    expect(Object.keys(columns[0]).sort()).toEqual(['label', 'path']);
  });

  it('B17: renderer não vira atributo e o rótulo declarativo é aparado', async () => {
    const grid = document.createElement('u-grid');
    grid.style.cssText = 'display:block;height:300px';
    grid.innerHTML = `<u-grid-column path="a" renderer="oops">
        Alpha
      </u-grid-column>`;
    grid.items = [{ a: 'x' }];
    document.body.append(grid);
    await settle(grid);

    expect(headerLabels(grid)).toEqual(['Alpha']);
    expect(cellText(dataRows(grid)[0].cells[0])).toBe('x');
  });
});

describe('dados do hospedeiro (B4)', () => {
  it('B4: agrupar não reordena o array items do hospedeiro', async () => {
    const items = [{ c: 'z' }, { c: 'a' }, { c: 'm' }];
    await createGrid({ columns: [{ path: 'c', label: 'C', groupIndex: 0 }], items });

    expect(items.map(i => i.c)).toEqual(['z', 'a', 'm']);
  });

  it('B4: aceita items congelados', async () => {
    const items = Object.freeze([{ c: 'z' }, { c: 'a' }]);
    const grid = await createGrid({ columns: [{ path: 'c', label: 'C', groupIndex: 0 }], items: items as any[] });

    expect(groupLabels(grid)).toEqual(['C: a', 'C: z']);
  });
});

describe('agrupamento (B5–B8, B14)', () => {
  it('B5: acrescentar nível de grupo não duplica subgrupos', async () => {
    const grid = await createGrid({
      columns: [{ path: 'a', label: 'A', groupIndex: 0 }, { path: 'b', label: 'B' }, { path: 'n', label: 'N' }],
      items: [{ a: 'x', b: 'p', n: 1 }, { a: 'x', b: 'q', n: 2 }, { a: 'x', b: 'p', n: 3 }],
      configure: g => g.autoExpandGroups = true,
    });

    grid.groupColumn(grid._regularColumns[0], 1);
    await settle(grid);

    expect(groupLabels(grid)).toEqual(['A: x', 'B: p', 'B: q']);
  });

  it('B6: items vazio + segundo nível de grupo não lança', async () => {
    const grid = await createGrid({
      columns: [{ path: 'a', label: 'A', groupIndex: 0 }, { path: 'b', label: 'B' }],
      items: [],
    });

    expect(() => grid.groupColumn(grid._regularColumns[0], 1)).not.toThrow();
    await settle(grid);
    expect(grid._groupColumns).toHaveLength(2);
  });

  it('B7: agrupar coluna sem path não lança', async () => {
    const grid = await createGrid({
      columns: [
        { label: 'Actions', renderer: () => document.createElement('button') },
        { path: 'v', label: 'V' },
      ],
      items: [{ v: 1 }],
    });

    expect(() => grid.groupColumn(grid._regularColumns[0], 0)).not.toThrow();
    await settle(grid);
    expect(groupLabels(grid)).toEqual(['Actions:']);
  });

  it('B8: grupos numéricos em ordem numérica', async () => {
    const grid = await createGrid({
      columns: [{ path: 'y', label: 'Y', groupIndex: 0 }],
      items: [{ y: 9 }, { y: 10 }, { y: 100 }, { y: 2 }],
    });

    expect(groupLabels(grid)).toEqual(['Y: 2', 'Y: 9', 'Y: 10', 'Y: 100']);
  });

  it('B14: trocar items mantém o estado de expansão', async () => {
    const columns: GridColumnDef[] = [{ path: 'g', label: 'G', groupIndex: 0 }, { path: 'n', label: 'N' }];
    const grid = await createGrid({ columns, items: [{ g: 'a', n: 1 }, { g: 'b', n: 2 }] });

    groupToggles(grid)[1].click();
    await settle(grid);
    expect(dataRows(grid).map(r => cellText(r.cells[1]))).toEqual(['2']);

    grid.items = [{ g: 'a', n: 1 }, { g: 'b', n: 2 }, { g: 'b', n: 3 }];
    await settle(grid);
    expect(dataRows(grid).map(r => cellText(r.cells[1]))).toEqual(['2', '3']);
  });
});

describe('render (B1, B11, B12, B16)', () => {
  it('B1: célula customizada mostra a própria linha depois de expandir grupos', async () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ g: i < 3 ? 'A' : 'B', name: `item${i}` }));
    const grid = await createGrid({
      columns: [
        { path: 'g', label: 'G', groupIndex: 0 },
        { path: 'name', label: 'Name' },
        {
          label: 'R', renderer: item => {
            const span = document.createElement('span');
            span.textContent = `R-${item.name}`;
            return span;
          },
        },
      ],
      items,
    });

    groupToggles(grid)[1].click();
    await settle(grid);
    groupToggles(grid)[0].click();
    await settle(grid);

    const pairs = dataRows(grid).map(r => [cellText(r.cells[1]), cellText(r.cells[2])]);
    expect(pairs).toHaveLength(6);

    for (const [name, rendered] of pairs) {
      expect(rendered).toBe(`R-${name}`);
    }
  });

  it('B1: célula customizada acompanha a coluna ao reordenar', async () => {
    const grid = await createGrid({
      columns: [
        { path: 'a', label: 'A' },
        { label: 'R', renderer: item => Object.assign(document.createElement('b'), { textContent: `R${item.a}` }) },
      ],
      items: [{ a: 1 }],
    });

    grid.moveColumn(grid._regularColumns[1], 0);
    await settle(grid);

    const cells = dataRows(grid)[0].cells;
    expect([cellText(cells[0]), cellText(cells[1])]).toEqual(['R1', '1']);
  });

  it('B11: a paridade da listra de uma linha não muda ao rolar', async () => {
    const grid = await createGrid({
      columns: [{ path: 'n', label: 'N' }],
      items: Array.from({ length: 500 }, (_, n) => ({ n })),
      configure: g => g.striped = true,
      height: '300px',
    });

    const scroller = grid.shadowRoot!.querySelector('.scroll-container')!;
    const parityOf = (n: number) => dataRows(grid).find(r => cellText(r.cells[0]) === String(n))?.classList.contains('even');

    scroller.scrollTop = grid.rowHeight * 15;
    await settle(grid);
    const before = parityOf(20);
    expect(before).toBeTypeOf('boolean');

    scroller.scrollTop = grid.rowHeight * 16;
    await settle(grid);
    expect(parityOf(20)).toBe(before);
    expect(parityOf(21)).toBe(!before);
  });

  it('B12: com dados não mostra "sem dados" antes de o contêiner ter altura', async () => {
    const grid = await createGrid({ columns: [{ path: 'n', label: 'N' }], items: [{ n: 1 }], height: '0px' });

    expect(grid.shadowRoot!.querySelector('[part~="no-data"]')).toBeNull();
  });

  it('B12: sem dados mostra o texto de vazio', async () => {
    const grid = await createGrid({ columns: [{ path: 'n', label: 'N' }], items: [] });

    expect(grid.shadowRoot!.querySelector('[part~="no-data"]')?.textContent?.trim()).toBe('No data');
  });

  it('B16: mudar rowHeight remede o virtualizador', async () => {
    const grid = await createGrid({ columns: [{ path: 'n', label: 'N' }], items: Array.from({ length: 10 }, (_, n) => ({ n })) });

    grid.rowHeight = 30;
    await settle(grid);

    expect(grid.shadowRoot!.querySelector('tbody')!.style.height).toBe('300px');
  });
});

describe('drag and drop (B10)', () => {
  it('B10: renders repetidos não acumulam registros nos adaptadores', async () => {
    const grid = await createGrid({
      columns: [{ path: 'a', label: 'A', groupIndex: 0 }, { path: 'b', label: 'B' }],
      items: [{ a: 1, b: 2 }],
    });

    const before = grid._dragAndDropRegistrations;

    for (let i = 0; i < 50; i++) {
      grid.requestUpdate();
      await grid.updateComplete;
    }

    expect(grid._dragAndDropRegistrations).toBe(before);
  });
});

describe('acessibilidade (B18)', () => {
  it('B18: aria-rowcount conta o cabeçalho e o grupo tem botão com aria-expanded', async () => {
    const grid = await createGrid({
      columns: [{ path: 'g', label: 'G', groupIndex: 0 }, { path: 'n', label: 'N' }],
      items: [{ g: 'a', n: 1 }],
    });

    const container = grid.shadowRoot!.querySelector('[role=grid]')!;
    expect(container.getAttribute('aria-rowcount')).toBe('2');

    const toggle = grid.shadowRoot!.querySelector('button.group-toggle')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    (toggle as HTMLButtonElement).click();
    await settle(grid);
    expect(grid.shadowRoot!.querySelector('button.group-toggle')!.getAttribute('aria-expanded')).toBe('true');
    expect(container.getAttribute('aria-rowcount')).toBe('3');
    expect(bodyRows(grid)[0].getAttribute('aria-level')).toBe('1');
  });
});

describe('API (B19)', () => {
  it('B19: striped, showGroupPanel e showColumnHeaders; aliases antigos com aviso', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const grid = await createGrid({ columns: [{ path: 'n', label: 'N' }], items: [{ n: 1 }] });

    grid.stripped = true;
    grid.showHeader = false;
    await settle(grid);

    expect(grid.striped).toBe(true);
    expect(grid.showGroupPanel).toBe(false);
    expect(grid.shadowRoot!.querySelector('.group-container')).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"stripped" is deprecated'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"showHeader" is deprecated'));

    grid.showColumnHeaders = false;
    await settle(grid);
    expect(grid.shadowRoot!.querySelector('thead')).toBeNull();

    warn.mockRestore();
  });
});

describe('i18n (B20, B21)', () => {
  it('B20: chaves especiais não poluem a tabela de traduções', async () => {
    setGridTranslation('__proto__', { noData: 'pwned' });
    const grid = await createGrid({ columns: [{ path: 'n', label: 'N' }], items: [], configure: g => g.language = 'constructor' });

    expect(grid.shadowRoot!.querySelector('[part~="no-data"]')?.textContent?.trim()).toBe('No data');
  });

  it('B21: mudar <html lang> atualiza o grid', async () => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = 'en';
    const grid = await createGrid({ columns: [{ path: 'n', label: 'N' }], items: [] });

    document.documentElement.lang = 'pt';
    await settle(grid);

    expect(grid.shadowRoot!.querySelector('[part~="no-data"]')?.textContent?.trim()).toBe('Sem dados');
    document.documentElement.lang = previous;
  });
});
