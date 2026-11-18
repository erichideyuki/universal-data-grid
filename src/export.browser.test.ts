/**
 * Frente 12: exportação (`getExportData`, `exportCsv`, `downloadCsv`) e
 * área de transferência (Ctrl+C) no componente.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid, GridCopyEventDetail, GridExportGroupRow, GridExportSummaryRow } from './grid.js';
import { cleanup, createGrid, settle } from './test/fixture.js';

afterEach(cleanup);

interface Sale {
  name: string;
  country: string;
  amount: number;
  note: string;
}

const sales = (): Sale[] => [
  { name: 'Ana', country: 'Brazil', amount: 1200.5, note: 'ok' },
  { name: 'Bia', country: 'Chile', amount: -5, note: '=1+1' },
  { name: 'Caio', country: 'Brazil', amount: 300, note: 'a "quoted", text\nline' },
  { name: 'Duda', country: 'Chile', amount: 40, note: '<b>bold</b> & co' },
];

const columns = (): GridColumnDef[] => [
  { path: 'name', label: 'Name' },
  { path: 'country', label: 'Country' },
  { path: 'amount', label: 'Amount', format: { minimumFractionDigits: 2 } },
  { path: 'note', label: 'Note' },
  { label: 'Actions', renderer: () => document.createElement('button') },
];

const create = (configure?: (grid: DataGrid) => void): Promise<DataGrid> =>
  createGrid({
    columns: columns(),
    items: sales(),
    configure: grid => {
      grid.language = 'en';
      configure?.(grid);
    },
  });

const csvText = async (blob: Blob): Promise<string> => new TextDecoder('utf-8', { ignoreBOM: true }).decode(await blob.arrayBuffer());

const column = (grid: DataGrid, path: string): GridColumnDef => grid.columns.find(candidate => candidate.path === path)!;

describe('getExportData', () => {
  it('exporta as colunas visíveis e exportáveis na ordem atual, com filtro e ordenação', async () => {
    const grid = await create();
    grid.moveColumn(column(grid, 'amount'), 0);
    grid.sortColumn(column(grid, 'amount'), 'desc');
    grid.filterValue = ['country', '=', 'Brazil'];
    await settle(grid);

    const data = await grid.getExportData();

    expect(data.columns.map(c => c.label)).toEqual(['Amount', 'Name', 'Country', 'Note']);
    expect(data.columns[0]).toMatchObject({ dataType: 'number', alignment: 'end' });
    expect(data.rows.map(row => row.rowType === 'data' && row.texts)).toEqual([
      ['1,200.50', 'Ana', 'Brazil', 'ok'],
      ['300.00', 'Caio', 'Brazil', 'a "quoted", text\nline'],
    ]);
    expect(data.rows[0]).toMatchObject({ rowType: 'data', level: 0, values: [1200.5, 'Ana', 'Brazil', 'ok'] });
  });

  it('`exportable: false` e coluna só com renderer ficam de fora', async () => {
    const grid = await createGrid({
      columns: [{ path: 'name', label: 'Name', exportable: false }, { path: 'country', label: 'Country' }, { label: 'X', renderer: () => null }],
      items: sales(),
    });

    expect((await grid.getExportData()).columns.map(c => c.label)).toEqual(['Country']);
  });

  it('grupos (recolhidos inclusive), resumos de grupo e totais', async () => {
    const grid = await create(g => {
      g.summary = {
        group: [
          { column: 'amount', type: 'sum', display: 'column' },
          { column: 'amount', type: 'max', display: 'footer' },
        ],
        total: [{ column: 'amount', type: 'sum' }, { column: 'name', type: 'count' }],
      };
    });
    grid.groupColumn(column(grid, 'country'));
    await settle(grid);
    grid.collapseGroup(['Chile']);
    await settle(grid);

    const data = await grid.getExportData();
    const types = data.rows.map(row => row.rowType === 'data' ? `data:${row.level}` : `${row.rowType}:${row.level}`);

    expect(data.columns.map(c => c.label)).toEqual(['Name', 'Amount', 'Note']);
    expect(types).toEqual([
      'group:0',
      'data:1',
      'data:1',
      'group-footer:1',
      'group:0',
      'data:1',
      'data:1',
      'group-footer:1',
      'total:0',
    ]);

    const brazil = data.rows[0] as GridExportGroupRow;
    expect(brazil).toMatchObject({ groupPath: ['Brazil'], value: 'Brazil', text: 'Brazil', label: 'Country: Brazil (2)', itemCount: 2 });
    expect(brazil.texts).toEqual(['', 'Sum: 1,500.50', '']);
    expect(brazil.summaries[1][0]).toMatchObject({ value: 1500.5, text: '1,500.50' });

    const footer = data.rows[3] as GridExportSummaryRow;
    expect(footer).toMatchObject({ groupPath: ['Brazil'], texts: ['', 'Max: 1,200.50', ''] });

    const totals = data.rows.at(-1) as GridExportSummaryRow;
    expect(totals).toMatchObject({ groupPath: null, texts: ['Count: 4', 'Sum: 1,535.50', ''] });
  });

  it('`includeGroups: false`: lista plana na ordem dos grupos, agrupadas primeiro; `includeSummaries: false`', async () => {
    const grid = await create(g => {
      g.summary = { total: [{ column: 'amount', type: 'sum' }] };
    });
    grid.groupColumn(column(grid, 'country'));
    grid.sortColumn(column(grid, 'country'), 'desc');
    await settle(grid);

    const data = await grid.getExportData({ includeGroups: false, includeSummaries: false });

    expect(data.columns.map(c => c.label)).toEqual(['Country', 'Name', 'Amount', 'Note']);
    expect(data.rows.map(row => row.rowType === 'data' ? `${row.level}:${row.texts[0]}:${row.texts[1]}` : row.rowType)).toEqual(['0:Chile:Bia', '0:Chile:Duda', '0:Brazil:Ana', '0:Brazil:Caio']);
  });

  it('`selectedOnly`: na ordem atual, grupos e resumos recalculados sobre as selecionadas', async () => {
    const items = sales();
    const grid = await createGrid({
      columns: columns(),
      items,
      configure: g => {
        g.language = 'en';
        g.selectionMode = 'multiple';
        g.summary = { total: [{ column: 'amount', type: 'sum' }] };
      },
    });
    grid.groupColumn(column(grid, 'country'));
    grid.selectRows([items[3], items[0], items[2]]);
    await settle(grid);

    const data = await grid.getExportData({ selectedOnly: true });

    const texts = data.rows.map(row => row.rowType === 'group' ? row.label : row.rowType === 'data' ? row.texts[0] : row.texts.join('|'));

    expect(texts).toEqual(['Country: Brazil (2)', 'Ana', 'Caio', 'Country: Chile (1)', 'Duda', '|Sum: 1,540.50|']);
  });

  it('`signal` abortado rejeita com AbortError', async () => {
    const grid = await create();
    const controller = new AbortController();
    controller.abort();

    await expect(grid.getExportData({ signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    await expect(grid.exportCsv({ signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('exportCsv', () => {
  it('RFC 4180 com BOM, cabeçalho, aspas, quebras e proteção contra fórmula', async () => {
    const grid = await create();
    const blob = await grid.exportCsv();
    const text = await csvText(blob);

    expect(blob.type).toBe('text/csv;charset=utf-8');
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text.slice(1).split('\r\n')).toEqual([
      'Name,Country,Amount,Note',
      'Ana,Brazil,"1,200.50",ok',
      'Bia,Chile,-5.00,\'=1+1',
      'Caio,Brazil,300.00,"a ""quoted"", text\nline"',
      'Duda,Chile,40.00,<b>bold</b> & co',
      '',
    ]);
  });

  it('pt usa `;`, valores crus, sem BOM nem cabeçalho e sem proteção quando pedido', async () => {
    const grid = await create(g => g.language = 'pt');
    const text = await csvText(await grid.exportCsv({ bom: false, includeHeaders: false, rawValues: true, escapeFormulas: false }));

    expect(text.split('\r\n').slice(0, 2)).toEqual(['Ana;Brazil;1200.5;ok', 'Bia;Chile;-5;=1+1']);
    expect((await csvText(await grid.exportCsv({ bom: false }))).split('\r\n')[1]).toBe('Ana;Brazil;1.200,50;ok');
    expect((await csvText(await grid.exportCsv({ bom: false, separator: '\t' }))).split('\r\n')[0]).toBe('Name\tCountry\tAmount\tNote');
  });

  it('linha de grupo: rótulo na 1ª célula, resumos alinhados nas colunas', async () => {
    const grid = await create(g => g.summary = { group: [{ column: 'amount', type: 'sum', display: 'column' }] });
    grid.groupColumn(column(grid, 'country'));
    await settle(grid);

    const lines = (await csvText(await grid.exportCsv({ bom: false }))).split('\r\n');

    expect(lines.slice(0, 3)).toEqual(['Name,Amount,Note', 'Country: Brazil (2),"Sum: 1,500.50",', 'Ana,"1,200.50",ok']);
  });

  it('separador inválido rejeita com RangeError', async () => {
    const grid = await create();

    await expect(grid.exportCsv({ separator: '"' })).rejects.toBeInstanceOf(RangeError);
    await expect(grid.exportCsv({ separator: ';;' })).rejects.toBeInstanceOf(RangeError);
  });

  it('downloadCsv baixa com o nome pedido e revoga a URL', async () => {
    const grid = await create();
    const clicks: { name: string; href: string }[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push({ name: this.download, href: this.href });
    });
    const revoke = vi.spyOn(URL, 'revokeObjectURL');

    try {
      await grid.downloadCsv({ fileName: 'sales.csv' });
      await grid.downloadCsv();
      await vi.waitFor(() => expect(revoke).toHaveBeenCalledTimes(2), { timeout: 3000 });
    } finally {
      click.mockRestore();
      revoke.mockRestore();
    }

    expect(clicks.map(c => c.name)).toEqual(['sales.csv', 'export.csv']);
    expect(clicks[0].href).toMatch(/^blob:/);
    expect(document.querySelector('a[download]')).toBeNull();
  });
});

describe('Ctrl+C', () => {
  const firstCell = (grid: DataGrid, col = 0): HTMLElement =>
    grid.shadowRoot!.querySelectorAll<HTMLElement>('tbody tr[data-index]')[0].querySelectorAll<HTMLElement>('td[role=gridcell]')[col];

  /** Pressiona Ctrl+C de verdade e devolve o que ficou no `clipboardData` do evento nativo. */
  const pressCopy = async (): Promise<{ text: string; html: string; prevented: boolean } | undefined> => {
    let result: { text: string; html: string; prevented: boolean } | undefined;

    const listener = (event: ClipboardEvent) => {
      result = {
        text: event.clipboardData!.getData('text/plain'),
        html: event.clipboardData!.getData('text/html'),
        prevented: event.defaultPrevented,
      };
    };

    document.addEventListener('copy', listener);

    try {
      await userEvent.keyboard('{Control>}c{/Control}');
    } finally {
      document.removeEventListener('copy', listener);
    }

    return result;
  };

  it('copia as linhas selecionadas (ordem atual) como TSV e HTML escapado, com anúncio', async () => {
    const grid = await create(g => g.selectionMode = 'multiple');
    const items = grid.items;
    grid.selectRows([items[3], items[1]]);
    await settle(grid);
    firstCell(grid).focus();

    const copied = await pressCopy();

    expect(copied?.prevented).toBe(true);
    expect(copied?.text).toBe('Bia\tChile\t-5.00\t\'=1+1\r\nDuda\tChile\t40.00\t<b>bold</b> & co');
    expect(copied?.html).toBe(
      '<table lang="en"><tbody><tr><td>Bia</td><td>Chile</td><td>-5.00</td><td style=\'mso-number-format:"\\@"\'>&#39;=1+1</td></tr>'
      + '<tr><td>Duda</td><td>Chile</td><td>40.00</td><td>&lt;b&gt;bold&lt;/b&gt; &amp; co</td></tr></tbody></table>',
    );
    await settle(grid);
    expect(grid.shadowRoot!.textContent).toContain('Copied rows: 2');
  });

  it('HTML com `dir="rtl"` e o `lang` efetivo do grid', async () => {
    const grid = await create(g => {
      g.language = 'ar';
      g.dir = 'rtl';
    });
    firstCell(grid).focus();

    expect((await pressCopy())?.html).toBe('<table dir="rtl" lang="ar"><tbody><tr><td>Ana</td></tr></tbody></table>');

    grid.dir = '';
    grid.language = 'pt-BR';
    await settle(grid);
    firstCell(grid).focus();

    expect((await pressCopy())?.html).toBe('<table lang="pt-BR"><tbody><tr><td>Ana</td></tr></tbody></table>');
  });

  it('sem seleção copia a célula focada', async () => {
    const grid = await create();
    firstCell(grid, 2).focus();

    const copied = await pressCopy();

    expect(copied).toMatchObject({ text: '1,200.50', prevented: true });
    await settle(grid);
    expect(grid.shadowRoot!.textContent).toContain('Cell copied');
  });

  it('`u-grid-copying` cancelado deixa a cópia nativa; o hospedeiro pode escrever em clipboardData', async () => {
    const grid = await create();
    let detail: GridCopyEventDetail | undefined;
    grid.addEventListener('u-grid-copying', event => {
      detail = event.detail;
      event.preventDefault();
      event.detail.clipboardData.setData('text/plain', 'custom');
    });
    firstCell(grid).focus();

    const copied = await pressCopy();

    expect(detail).toMatchObject({ items: [grid.items[0]], columns: [column(grid, 'name')], text: 'Ana' });
    expect(copied).toMatchObject({ prevented: false, text: 'custom' });
  });

  it('seleção toda fora do filtro copia a célula focada; mexer no `detail` não muda o que é escrito', async () => {
    const grid = await create(g => g.selectionMode = 'multiple');
    grid.selectRows([grid.items[1]]);
    grid.filterValue = ['country', '=', 'Brazil'];
    await settle(grid);
    grid.addEventListener('u-grid-copying', event => {
      (event.detail as { text: string }).text = 'tampered';
    });
    firstCell(grid).focus();

    expect(await pressCopy()).toMatchObject({ text: 'Ana', prevented: true });
  });

  it('`clipboard-mode="none"`, campo editável e texto selecionado: o grid não mexe', async () => {
    const grid = await create(g => g.showFilterRow = true);
    const events = vi.fn();
    grid.addEventListener('u-grid-copying', events);

    grid.setAttribute('clipboard-mode', 'none');
    await settle(grid);
    expect(grid.clipboardMode).toBe('none');
    firstCell(grid).focus();
    expect((await pressCopy())?.prevented).toBe(false);

    grid.clipboardMode = 'copy';
    await settle(grid);
    grid.shadowRoot!.querySelector<HTMLInputElement>('thead input')!.focus();
    expect((await pressCopy())?.prevented).toBe(false);

    const cell = firstCell(grid);
    cell.focus();
    const range = document.createRange();
    range.selectNodeContents(cell);
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(range);
    expect((await pressCopy())?.prevented).toBe(false);
    document.getSelection()!.removeAllRanges();

    expect(events).not.toHaveBeenCalled();
  });

  const status = (grid: DataGrid): string => grid.shadowRoot!.querySelector('[role=status]')!.textContent ?? '';

  it('botão de operação da linha de filtro, cabeçalho e linha de grupo sem seleção: nada copiado, nada anunciado', async () => {
    const grid = await create(g => g.showFilterRow = true);
    const events = vi.fn();
    grid.addEventListener('u-grid-copying', events);

    grid.shadowRoot!.querySelector<HTMLElement>('.filter-operation-button')!.focus();
    expect((await pressCopy())?.prevented).toBe(false);

    grid.shadowRoot!.querySelector<HTMLElement>('thead th[data-col]')!.focus();
    expect((await pressCopy())?.prevented).toBe(false);

    grid.groupColumn(column(grid, 'country'));
    await settle(grid);
    grid.shadowRoot!.querySelector<HTMLElement>('tbody .grouping-cell')!.focus();
    expect((await pressCopy())?.prevented).toBe(false);

    await settle(grid);
    expect(events).not.toHaveBeenCalled();
    expect(status(grid)).toBe('');
  });

  it('com seleção, Ctrl+C no cabeçalho copia a seleção; repetir anuncia de novo; cancelado não anuncia', async () => {
    const grid = await create(g => g.selectionMode = 'multiple');
    grid.selectRows([grid.items[0]]);
    await settle(grid);
    grid.shadowRoot!.querySelector<HTMLElement>('thead th[data-col]')!.focus();

    expect(await pressCopy()).toMatchObject({ text: 'Ana\tBrazil\t1,200.50\tok', prevented: true });
    await settle(grid);
    const first = status(grid);
    expect(first).toContain('Copied rows: 1');

    await pressCopy();
    await settle(grid);
    expect(status(grid)).toContain('Copied rows: 1');
    expect(status(grid), 'o mesmo anúncio muda o texto para ser lido de novo').not.toBe(first);

    const second = status(grid);
    grid.addEventListener('u-grid-copying', event => event.preventDefault());
    await pressCopy();
    await settle(grid);
    expect(status(grid)).toBe(second);
  });

  it('`beforecopy` é cancelado (habilita o Copiar no WebKit) só quando a cópia é do grid', async () => {
    const grid = await create(g => g.showFilterRow = true);

    const beforeCopy = (target: HTMLElement): boolean => {
      const event = new Event('beforecopy', { bubbles: true, composed: true, cancelable: true });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    };

    expect(beforeCopy(firstCell(grid))).toBe(true);
    expect(beforeCopy(firstCell(grid, 4))).toBe(false);
    expect(beforeCopy(grid.shadowRoot!.querySelector<HTMLElement>('thead input')!)).toBe(false);
    grid.clipboardMode = 'none';
    await settle(grid);
    expect(beforeCopy(firstCell(grid))).toBe(false);
  });

  it('texto selecionado FORA do grid não impede a cópia da célula', async () => {
    const grid = await create();
    const outside = document.createElement('p');
    outside.textContent = 'page text';
    document.body.append(outside);
    const range = document.createRange();
    range.selectNodeContents(outside);
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(range);

    try {
      const clipboardData = new DataTransfer();
      const cell = firstCell(grid);
      cell.dispatchEvent(new ClipboardEvent('copy', { clipboardData, bubbles: true, composed: true, cancelable: true }));

      expect(clipboardData.getData('text/plain')).toBe('Ana');
    } finally {
      document.getSelection()!.removeAllRanges();
      outside.remove();
    }
  });
});
