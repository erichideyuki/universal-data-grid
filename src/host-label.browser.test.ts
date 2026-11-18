/**
 * Nome do grid pelo hospedeiro (spec 10/17): `aria-label`/`aria-labelledby`
 * no `<u-grid>` nomeiam a tabela `grid`/`treegrid`; o `aria-labelledby` é
 * resolvido na raiz do hospedeiro e o texto do alvo é observado, sem vazar.
 */
import { html } from 'lit';

import type {} from '@vitest/browser-playwright';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cdp } from 'vitest/browser';

import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid } from './grid.js';
import { cleanup, createGrid, settle } from './test/fixture.js';
import { expectCollected, heapDelta, kib, measureHeap, track, type Tracked } from './test/leak.js';

const labels: HTMLElement[] = [];

afterEach(() => {
  cleanup();
  labels.splice(0).forEach(label => label.remove());
});

const columns = (): GridColumnDef[] => [{ path: 'team', label: 'Team' }, { path: 'name', label: 'Name' }];
const items = () => [{ team: 'A', name: 'Ana' }, { team: 'B', name: 'Bia' }, { team: 'A', name: 'Caio' }];

const table = (grid: DataGrid): HTMLTableElement => grid.shadowRoot!.querySelector('table')!;
const nameOf = (grid: DataGrid): string | null => table(grid).getAttribute('aria-label');

const heading = (id: string, text: string): HTMLElement => {
  const element = document.createElement('h2');
  element.id = id;
  element.textContent = text;
  document.body.append(element);
  labels.push(element);
  return element;
};

/** Espera o `MutationObserver` (microtask) e o render. */
const flush = async (grid: DataGrid): Promise<void> => {
  await Promise.resolve();
  await settle(grid);
};

/** Nomes que o NAVEGADOR deu às tabelas `grid`/`treegrid` (árvore de acessibilidade pelo CDP). */
const axGridNames = async (): Promise<string[]> => {
  const session = cdp();
  const { frameTree } = await session.send('Page.getFrameTree');
  const frames: string[] = [];

  const walk = (tree: typeof frameTree): void => {
    frames.push(tree.frame.id);
    tree.childFrames?.forEach(walk);
  };

  walk(frameTree);

  const names: string[] = [];

  for (const frameId of frames) {
    const { nodes } = await session.send('Accessibility.getFullAXTree', { frameId });

    for (const node of nodes) {
      if (node.role?.value === 'grid' || node.role?.value === 'treegrid') {
        names.push(String(node.name?.value ?? '').trim());
      }
    }
  }

  return names;
};

describe('aria-label / aria-labelledby do <u-grid>', () => {
  it('aria-label (atributo e propriedade refletida) nomeia a tabela; grid e treegrid', async () => {
    const grid = await createGrid({ columns: columns(), items: items(), configure: g => g.setAttribute('aria-label', 'Sales') });
    expect(table(grid).getAttribute('role')).toBe('grid');
    expect(nameOf(grid)).toBe('Sales');

    grid.ariaLabel = 'Orders';
    grid.columns = [{ ...columns()[0], groupIndex: 0 }, columns()[1]];
    await settle(grid);
    expect(table(grid).getAttribute('role')).toBe('treegrid');
    expect(nameOf(grid)).toBe('Orders');

    grid.removeAttribute('aria-label');
    await settle(grid);
    expect(table(grid).hasAttribute('aria-label')).toBe(false);
  });

  it('aria-labelledby copia o texto do alvo e acompanha mudanças; vence o aria-label', async () => {
    const title = heading('sales-title', 'Sales  of\n 2026');
    const grid = await createGrid({
      columns: columns(),
      items: items(),
      configure: g => {
        g.setAttribute('aria-label', 'Fallback');
        g.setAttribute('aria-labelledby', 'sales-title');
      },
    });
    expect(nameOf(grid)).toBe('Sales of 2026');

    title.textContent = 'Sales of 2027';
    await flush(grid);
    expect(nameOf(grid)).toBe('Sales of 2027');

    title.firstChild!.nodeValue = 'Edited';
    await flush(grid);
    expect(nameOf(grid)).toBe('Edited');

    // `aria-label` do alvo vence o texto dele (accname).
    title.setAttribute('aria-label', 'Labelled title');
    await flush(grid);
    expect(nameOf(grid)).toBe('Labelled title');

    // Alvo vazio cai no aria-label do hospedeiro.
    title.removeAttribute('aria-label');
    title.textContent = '';
    await flush(grid);
    expect(nameOf(grid)).toBe('Fallback');
  });

  it('vários ids, alvo que aparece depois, troca de alvo e remoção', async () => {
    heading('t-a', 'Quarterly');
    const grid = await createGrid({ columns: columns(), items: items(), configure: g => g.setAttribute('aria-labelledby', 't-a t-b') });
    expect(nameOf(grid)).toBe('Quarterly');
    expect(grid._memoryStats.hostLabelObservers).toBe(2);

    const late = heading('t-b', 'report');
    await flush(grid);
    expect(nameOf(grid)).toBe('Quarterly report');
    // Alvos e raiz (ancestral trocado, id que muda) seguem observados.
    expect(grid._memoryStats.hostLabelObservers).toBe(2);

    // Alvo trocado por outro com o mesmo id.
    const replacement = document.createElement('span');
    replacement.id = 't-b';
    replacement.textContent = 'summary';
    late.replaceWith(replacement);
    labels.push(replacement);
    await flush(grid);
    expect(nameOf(grid)).toBe('Quarterly summary');

    replacement.remove();
    await flush(grid);
    expect(nameOf(grid)).toBe('Quarterly');

    grid.removeAttribute('aria-labelledby');
    await settle(grid);
    expect(table(grid).hasAttribute('aria-label')).toBe(false);
    expect(grid._memoryStats.hostLabelObservers).toBe(0);
  });

  it('alvo oculto nomeia; descendente oculto não entra', async () => {
    const hidden = heading('hidden-title', 'Hidden name');
    hidden.hidden = true;
    const visible = heading('visible-title', 'Visible');
    const extra = document.createElement('span');
    extra.hidden = true;
    extra.textContent = ' (secret)';
    visible.append(extra);

    const grid = await createGrid({ columns: columns(), items: items(), configure: g => g.setAttribute('aria-labelledby', 'hidden-title visible-title') });
    expect(nameOf(grid)).toBe('Hidden name Visible');
  });

  it('grid aninhado no detalhe: o rótulo do template (mesmo shadow root) nomeia o interno', async () => {
    const grid = await createGrid({
      columns: columns(),
      items: items(),
      configure: g => {
        g.setAttribute('aria-label', 'Teams');
        g.detailRenderer = (item: { name: string }) => html`
          <h3 id="orders-of-${item.name}">Orders of ${item.name}</h3>
          <u-grid class="inner" style="display: block; height: 150px" aria-labelledby="orders-of-${item.name}"
            .columns=${[{ path: 'id', label: 'Id' }]} .items=${[{ id: 1 }, { id: 2 }]}></u-grid>`;
      },
    });

    grid.expandRow(grid.items[0]);
    await settle(grid);
    const nested = grid.shadowRoot!.querySelector<DataGrid>('u-grid.inner')!;
    await settle(nested);

    expect(nameOf(grid)).toBe('Teams');
    expect(nameOf(nested)).toBe('Orders of Ana');

    const result = await axe.run(grid, { resultTypes: ['violations'] });
    expect(result.violations.map(v => v.id)).toEqual([]);
  });

  it('o navegador calcula o nome pelos elementos (ícone aria-hidden fora); a cópia de reserva também', async () => {
    const title = heading('ax-title', '');
    title.innerHTML = '<span class="icon" aria-hidden="true">table_view</span> Orders <img alt="2026" src="data:,"> <abbr aria-label="United States">US</abbr><span style="display:none">secret</span>';
    const grid = await createGrid({ columns: columns(), items: items(), configure: g => g.setAttribute('aria-labelledby', 'ax-title') });

    expect(nameOf(grid)).toBe('Orders 2026 United States');
    expect(table(grid).ariaLabelledByElements).toEqual([title]);
    expect(await axGridNames()).toContain('Orders 2026 United States');

    title.querySelector('abbr')!.remove();
    await flush(grid);
    expect(nameOf(grid)).toBe('Orders 2026');
    expect(await axGridNames()).toContain('Orders 2026');
  });

  it('alvo com visibility:hidden nomeia (accname conta alvo oculto)', async () => {
    const title = heading('invisible-title', 'Invisible title');
    title.style.visibility = 'hidden';
    const grid = await createGrid({ columns: columns(), items: items(), configure: g => g.setAttribute('aria-labelledby', 'invisible-title') });

    expect(nameOf(grid)).toBe('Invisible title');
  });

  it('ancestral do alvo trocado (framework re-renderiza o bloco): acha o alvo novo', async () => {
    const block = document.createElement('section');
    block.innerHTML = '<div><h2 id="block-title">Old</h2></div>';
    document.body.append(block);
    labels.push(block);
    const grid = await createGrid({ columns: columns(), items: items(), configure: g => g.setAttribute('aria-labelledby', 'block-title') });
    expect(nameOf(grid)).toBe('Old');

    const fresh = document.createElement('section');
    fresh.innerHTML = '<div><h2 id="block-title">New</h2></div>';
    block.replaceWith(fresh);
    labels.push(fresh);
    await flush(grid);

    expect(nameOf(grid)).toBe('New');
    expect(table(grid).ariaLabelledByElements).toEqual([fresh.querySelector('h2')]);
  });

  it('alvo que contém o grid: só o aria-label dele, com aviso; renders não acordam o observador', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const box = document.createElement('section');
    box.id = 'box';
    box.setAttribute('aria-label', 'Box');
    document.body.append(box);
    labels.push(box);

    try {
      const grid = document.createElement('u-grid');
      grid.style.cssText = 'display: block; height: 300px';
      grid.setAttribute('aria-labelledby', 'box');
      grid.columns = [{ path: 'name', label: 'Name', renderer: (item: { name: string }) => html`<b>${item.name}</b>` }];
      grid.items = items();
      box.append(grid);
      await settle(grid);

      expect(nameOf(grid)).toBe('Box');
      expect(table(grid).ariaLabelledByElements ?? []).toEqual([]);
      expect(warn.mock.calls.filter(call => String(call[0]).includes('aria-labelledby points to the grid'))).toHaveLength(1);

      const updates = vi.spyOn(grid, 'requestUpdate');
      grid.items = [...items(), { team: 'C', name: 'Duda' }];
      await settle(grid);
      // Só o render pedido pelos itens; nenhum pelo rótulo.
      expect(updates.mock.calls.filter(call => call.length === 0)).toHaveLength(0);
      expect(nameOf(grid)).toBe('Box');
    } finally {
      warn.mockRestore();
    }
  });

  it('grid aninhado em detalhe HTMLElement (light DOM do externo): rótulo no mesmo elemento', async () => {
    const grid = await createGrid({
      columns: columns(),
      items: items(),
      configure: g => {
        g.detailRenderer = (item: { name: string }) => {
          const wrapper = document.createElement('div');
          wrapper.innerHTML = `<h3 id="dom-orders-${item.name}">Orders of ${item.name}</h3>`;
          const inner = document.createElement('u-grid');
          inner.className = 'inner';
          inner.style.cssText = 'display: block; height: 150px';
          inner.setAttribute('aria-labelledby', `dom-orders-${item.name}`);
          inner.columns = [{ path: 'id', label: 'Id' }];
          inner.items = [{ id: 1 }];
          wrapper.append(inner);
          return wrapper;
        };
      },
    });

    grid.expandRow(grid.items[0]);
    await settle(grid);
    const nested = grid.querySelector<DataGrid>('u-grid.inner') ?? grid.shadowRoot!.querySelector<DataGrid>('u-grid.inner')!;
    await settle(nested);

    expect(nameOf(nested)).toBe('Orders of Ana');
  });

  it('axe sem violações com aria-label e com aria-labelledby no hospedeiro', async () => {
    heading('axe-title', 'People');
    const labelled = await createGrid({ columns: columns(), items: items(), configure: g => g.setAttribute('aria-labelledby', 'axe-title') });
    const named = await createGrid({ columns: columns(), items: items(), configure: g => g.setAttribute('aria-label', 'People list') });

    for (const grid of [labelled, named]) {
      const result = await axe.run(grid, { resultTypes: ['violations'] });
      expect(result.violations.map(v => v.id)).toEqual([]);
    }
  });
});

describe('memória do aria-labelledby (spec 14)', () => {
  it('grid com aria-labelledby (alvo que fica no documento) removido é coletado; o observador sai', async () => {
    const title = heading('leak-title', 'Long lived');

    const scenario = async (): Promise<Tracked> => {
      // Id que falta: observa também a raiz (documento).
      const grid = await createGrid({ columns: columns(), items: items(), configure: g => g.setAttribute('aria-labelledby', 'leak-title leak-missing') });
      expect(nameOf(grid)).toBe('Long lived');
      expect(grid._memoryStats.hostLabelObservers).toBe(2);
      title.textContent = 'Changed';
      await flush(grid);
      expect(nameOf(grid)).toBe('Changed');

      grid.remove();
      expect(grid._memoryStats.hostLabelObservers).toBe(0);
      return track({ grid, items: grid.items });
    };

    await expectCollected(await scenario());

    // Depois de removido, mudar o alvo não acorda nada (o observador foi solto).
    title.textContent = 'After removal';
    await Promise.resolve();
  });

  it('trocar o rótulo muitas vezes num grid de vida longa não cresce', async () => {
    const title = heading('churn-title', 'T');
    const grid = await createGrid({ columns: columns(), items: items(), configure: g => g.setAttribute('aria-labelledby', 'churn-title') });

    const churn = async (count: number): Promise<void> => {
      for (let n = 0; n < count; n++) {
        title.textContent = `Title ${n}`;
        grid.setAttribute('aria-labelledby', n % 2 ? 'churn-title' : 'churn-title churn-missing');
        await Promise.resolve();
      }

      await flush(grid);
    };

    await churn(200);
    const before = await measureHeap();
    await churn(2000);
    const after = await measureHeap();
    const delta = heapDelta(before, after);

    expect(nameOf(grid)).toBe('Title 1999');
    expect(grid._memoryStats.hostLabelObservers).toBe(2);
    expect(delta.jsHeapUsed, `cresceu ${kib(delta.jsHeapUsed)}`).toBeLessThan(512 * 1024);
    expect(delta.nodes).toBeLessThan(50);
  });
});
