/**
 * Hidratação do SSR: o HTML vem do `@lit-labs/ssr` de verdade (comando
 * `renderGridSsr` do `vitest.config.ts`, que roda em Node) e é hidratado aqui
 * como no demo (`dev/entry-client.ts`). Antes da correção do `keyedRows` a
 * hidratação lançava "Hydration value mismatch: Primitive found where
 * TemplateResult expected" e o grid ficava só com os cabeçalhos.
 */
// Precisa vir antes do Lit: registra o gancho que o `LitElement` lê ao carregar.
import '@lit-labs/ssr-client/lit-element-hydrate-support.js';

import { afterEach, describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';

import type { DataGrid } from './grid.js';
import { settle } from './test/fixture.js';
import { hydrationScenarios, type HydrationScenarioName } from './test/hydration-scenarios.js';
import { expectCollected, track, type Tracked } from './test/leak.js';

declare module 'vitest/browser' {
  interface BrowserCommands {
    renderGridSsr: (name: HydrationScenarioName) => Promise<string>;
  }
}

const errors: unknown[] = [];
const onError = (event: ErrorEvent) => errors.push(event.error ?? event.message);
const onRejection = (event: PromiseRejectionEvent) => errors.push(event.reason);

window.addEventListener('error', onError);
window.addEventListener('unhandledrejection', onRejection);

afterEach(() => {
  errors.length = 0;
  document.querySelectorAll('.ssr-host').forEach(host => host.remove());
});

const dataRows = (grid: DataGrid): HTMLTableRowElement[] =>
  [...grid.shadowRoot!.querySelectorAll<HTMLTableRowElement>('tbody tr[role="row"]')];

const rowIndexes = (grid: DataGrid): number[] =>
  dataRows(grid).map(row => Number(row.getAttribute('aria-rowindex')));

const comments = (node: Node): number =>
  [...node.childNodes].filter(child => child.nodeType === Node.COMMENT_NODE).length;

/** Monta o HTML do servidor e hidrata, como o pai faz: propriedades antes de conectar. */
const hydrate = async (name: HydrationScenarioName): Promise<{ grid: DataGrid; ssrIndexes: number[] }> => {
  const html = await commands.renderGridSsr(name);
  const { columns, items } = hydrationScenarios[name];

  const host = document.createElement('div');
  host.className = 'ssr-host';
  host.setHTMLUnsafe(html);

  const grid = host.querySelector('u-grid')!;
  // O shadow root declarativo já está aqui, antes de qualquer render do cliente.
  const ssrIndexes = rowIndexes(grid);

  grid.columns = columns;
  grid.items = items;
  document.body.append(host);
  await settle(grid);

  return { grid, ssrIndexes };
};

describe('hidratação do SSR', () => {
  it.each(['en', 'pt', 'ar'] as const)('%s: hidrata sem erro e as linhas continuam visíveis e únicas', async name => {
    const { grid, ssrIndexes } = await hydrate(name);

    expect(errors).toEqual([]);
    expect(ssrIndexes.length).toBeGreaterThan(0);

    // Nenhuma linha do servidor sobra duplicada ao lado das do cliente.
    const indexes = rowIndexes(grid);
    expect(indexes.length).toBeGreaterThan(0);
    expect(indexes[0]).toBe(ssrIndexes[0]);
    expect(new Set(indexes).size).toBe(indexes.length);
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  });

  it('ar: a direção e os textos traduzidos sobrevivem à hidratação', async () => {
    const { grid } = await hydrate('ar');

    expect(errors).toEqual([]);
    expect(getComputedStyle(grid).direction).toBe('rtl');
    expect(grid.shadowRoot!.querySelector('.column-chooser-button')!.getAttribute('title')).toBe('منتقي الأعمدة');
  });

  it('depois de hidratar, a rolagem troca a janela sem deixar marcadores para trás', async () => {
    const { grid } = await hydrate('en');
    const scroller = grid.shadowRoot!.querySelector('.scroll-container')!;
    const tbody = grid.shadowRoot!.querySelector('tbody')!;

    scroller.scrollTop = grid.rowHeight * 40;
    await settle(grid);
    const baseline = comments(tbody);

    for (let step = 41; step < 160; step += 7) {
      scroller.scrollTop = grid.rowHeight * step;
      await settle(grid);
    }

    expect(errors).toEqual([]);
    expect(rowIndexes(grid)[0]).toBeGreaterThan(100);
    expect(comments(tbody)).toBeLessThanOrEqual(baseline);
  });

  it('vazio no servidor: "sem dados" hidrata e dá lugar às linhas quando chegam itens', async () => {
    const { grid } = await hydrate('empty');

    expect(errors).toEqual([]);
    expect(grid.shadowRoot!.querySelector('[part~="no-data"]')?.textContent).toBe('Sem dados');

    grid.items = hydrationScenarios.en.items;
    await settle(grid);

    expect(grid.shadowRoot!.querySelector('[part~="no-data"]')).toBeNull();
    expect(dataRows(grid).length).toBeGreaterThan(0);
  });

  it('grid hidratado e removido é coletado', async () => {
    const scenario = async (): Promise<Tracked> => {
      const { grid } = await hydrate('pt');
      const host = grid.parentElement!;
      const tbody = grid.shadowRoot!.querySelector('tbody')!;

      host.remove();
      // Deixa o `disconnectedCallback` e o último render assentarem. Na
      // hidratação o contêiner recebe um evento de rolagem e o virtual-core
      // agenda o fim da rolagem (`isScrollingResetDelay`, 150 ms): até o
      // timer disparar, a closure dele segura o contêiner (transitório).
      await settle(grid);
      await new Promise(resolve => setTimeout(resolve, 300));

      return track({ grid, host, tbody });
    };

    await expectCollected(await scenario());
  });
});
