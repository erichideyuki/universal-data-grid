import { html } from 'lit';

import type { GridColumnDef, GridDetailRenderer, GridFilterExpression, GridRowRenderer } from '../grid-column-def.js';

/**
 * Cenários de hidratação: o mesmo `<u-grid>` renderizado no servidor
 * (`ssr-render.ts`, via comando do Vitest em Node) e hidratado no navegador
 * (`grid.hydration.browser.test.ts`). Só dados (e renderers puros): este
 * módulo roda dos dois lados.
 */
export interface HydrationScenario {
  language: string;
  dir?: 'ltr' | 'rtl';
  columns: GridColumnDef[];
  items: Record<string, unknown>[];
  /** Linha de filtro, busca e funil ligados, com `filterValue`/`searchText` iniciais. */
  filter?: { filterValue: GridFilterExpression; searchText: string };
  /** Master-detail com tudo expandido (`auto-expand-rows`). */
  detailRenderer?: GridDetailRenderer;
  /** `aria-label`/`aria-labelledby` no hospedeiro (o alvo do `labelledby` fica na página, ao lado). */
  ariaLabel?: string;
  ariaLabelledBy?: string;
  /** Frente 11: `state-storage="local"` com esta chave (o servidor não lê storage). */
  stateStorageKey?: string;
  /** Frente 20: linhas fixas e linha inteira. */
  fixedTopItems?: Record<string, unknown>[];
  fixedBottomItems?: Record<string, unknown>[];
  rowRenderer?: GridRowRenderer;
  /** Frente 21: `auto-hide-columns` e largura do hospedeiro (px; o servidor não sabe a largura). */
  autoHideWidth?: number;
  /** Frente 27: `scroll-container` (o grid cresce com o conteúdo; quem rola é a janela). */
  scrollContainer?: string;
}

const countries = ['Argentina', 'Brazil', 'Chile', 'Denmark'];

const items = Array.from({ length: 400 }, (_, index) => ({
  country: countries[index % countries.length],
  code: countries[index % countries.length].slice(0, 3).toUpperCase(),
  year: 1960 + Math.floor(index / countries.length),
  population: (index * 7919) % 1_000_000,
  official: index % 3 !== 0,
}));

const columns: GridColumnDef[] = [
  { path: 'country', label: 'Country', groupIndex: 0, width: 200 },
  { path: 'code', label: 'Code', width: 100 },
  { path: 'year', label: 'Year', width: 100, sortOrder: 'desc' },
  { path: 'population', label: 'Population', width: 160, dataType: 'number' },
  { path: 'official', label: 'Official', minWidth: 120, dataType: 'boolean' },
];

const fixedColumns: GridColumnDef[] = [
  { path: 'country', label: 'Country', width: 160, fixed: 'start' },
  { path: 'code', label: 'Code', width: 100, fixed: 'start' },
  { path: 'year', label: 'Year', width: 100 },
  { path: 'official', label: 'Official', width: 120, visible: false },
  { path: 'population', label: 'Population', width: 160, fixed: 'end', dataType: 'number' },
];

/** Frente 10: templates em célula, cabeçalho e grupo; uma coluna `HTMLElement` (só no cliente). */
const templateColumns: GridColumnDef[] = [
  { path: 'country', label: 'Country', groupIndex: 0, width: 200, groupRenderer: ctx => html`<b class="g">${ctx.text} (${ctx.itemCount})</b>` },
  { path: 'code', label: 'Code', width: 100, renderer: (item: { code: string }) => html`<span class="code" part="code">${item.code}</span>` },
  { path: 'year', label: 'Year', width: 100, headerRenderer: ({ column }) => html`<i class="h">${column.label}</i>` },
  {
    path: 'population',
    label: 'Population',
    width: 160,
    renderer: (item: { population: number }) => {
      const element = document.createElement('b');
      element.className = 'dom';
      element.textContent = String(item.population);
      return element;
    },
  },
];

export const hydrationScenarios = {
  en: { language: 'en', columns, items },
  pt: { language: 'pt', columns, items },
  ar: { language: 'ar', dir: 'rtl', columns: fixedColumns, items },
  empty: { language: 'pt', columns, items: [] },
  labelled: { language: 'en', columns, items, ariaLabel: 'Fallback', ariaLabelledBy: 'ssr-title' },
  labelledOnly: { language: 'en', columns, items, ariaLabelledBy: 'ssr-title' },
  filtered: { language: 'en', columns, items, filter: { filterValue: ['year', '>=', 1990], searchText: 'bra' } },
  templates: {
    language: 'en',
    columns: templateColumns,
    items,
    detailRenderer: (item: { country: string; year: number }) => html`<p class="detail">${item.country} ${item.year}</p>`,
  },
  stored: { language: 'en', columns, items, stateStorageKey: 'u-grid-hydration-state' },
  fixed: {
    language: 'pt',
    columns: fixedColumns,
    items,
    fixedTopItems: [{ country: 'Meta', code: 'MET', year: 2000, population: 1, official: true }],
    fixedBottomItems: [{ country: 'Média', code: 'MED', year: 2001, population: 2, official: false }],
    rowRenderer: (item: { year: number; country: string }) => item.year % 5 === 0 && html`<p class="wide">${item.country} ${item.year}</p>`,
  },
  responsive: { language: 'en', columns: fixedColumns, items, autoHideWidth: 420 },
  parentScroll: { language: 'ar', dir: 'rtl', columns: fixedColumns, items, scrollContainer: 'window' },
} satisfies Record<string, HydrationScenario>;

export type HydrationScenarioName = keyof typeof hydrationScenarios;
