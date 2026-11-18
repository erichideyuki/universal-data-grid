import type { GridColumnDef, GridFilterExpression } from '../grid-column-def.js';

/**
 * Cenários de hidratação: o mesmo `<u-grid>` renderizado no servidor
 * (`ssr-render.ts`, via comando do Vitest em Node) e hidratado no navegador
 * (`grid.hydration.browser.test.ts`). Só dados: este módulo roda dos dois
 * lados.
 */
export interface HydrationScenario {
  language: string;
  dir?: 'ltr' | 'rtl';
  columns: GridColumnDef[];
  items: Record<string, unknown>[];
  /** Linha de filtro, busca e funil ligados, com `filterValue`/`searchText` iniciais. */
  filter?: { filterValue: GridFilterExpression; searchText: string };
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

export const hydrationScenarios = {
  en: { language: 'en', columns, items },
  pt: { language: 'pt', columns, items },
  ar: { language: 'ar', dir: 'rtl', columns: fixedColumns, items },
  empty: { language: 'pt', columns, items: [] },
  filtered: { language: 'en', columns, items, filter: { filterValue: ['year', '>=', 1990], searchText: 'bra' } },
} satisfies Record<string, HydrationScenario>;

export type HydrationScenarioName = keyof typeof hydrationScenarios;
