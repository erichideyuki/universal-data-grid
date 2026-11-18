/** Dados sintéticos dos testes de desempenho (spec 16): 24 colunas de tipos variados. */
import type { GridColumnDef } from '../grid-column-def.js';

const COUNTRIES = Array.from({ length: 16 }, (_, i) => `Country ${String.fromCharCode(65 + i)}`);
const CITIES = Array.from({ length: 200 }, (_, i) => `City ${i}`);
const CATEGORIES = Array.from({ length: 12 }, (_, i) => `Category ${i}`);
const STATUSES = ['New', 'Open', 'Pending', 'Closed', 'Archived'];
const REGIONS = ['North', 'South', 'East', 'West', 'Central', 'Overseas', 'Islands', 'Remote'];
const SEGMENTS = ['Retail', 'Wholesale', 'Online', 'Partner'];
const NOTES = Array.from({ length: 50 }, (_, i) => `Note number ${i} with some text`);
const DATES = Array.from({ length: 365 }, (_, i) => {
  const date = new Date(2024, 0, 1 + i);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
});

/** 24 colunas: textos com poucos e com muitos valores, números, datas ISO, booleano. */
export const makeItems = (count: number): object[] => {
  const items = new Array<object>(count);

  for (let i = 0; i < count; i++) {
    // Permutação fixa: nomes únicos fora de ordem (pior caso para ordenar).
    const scrambled = (i * 7919) % count;

    items[i] = {
      id: i,
      name: `Item ${scrambled}`,
      country: COUNTRIES[i % 16],
      city: CITIES[(i * 7) % 200],
      category: CATEGORIES[(i * 5) % 12],
      status: STATUSES[i % 5],
      active: i % 3 === 0,
      year: 1960 + i % 65,
      quarter: 1 + i % 4,
      month: 1 + i % 12,
      date: DATES[(i * 11) % 365],
      amount: (i * 37 % 100_000) / 100,
      quantity: i % 500,
      price: (i * 13 % 10_000) / 100,
      discount: (i % 30) / 100,
      tax: (i % 20) / 100,
      rating: 1 + i % 5,
      code: `C${i % 1000}`,
      sku: `SKU-${i % 20_000}`,
      email: `user${i % 5000}@example.com`,
      phone: `+1 555 ${String(i % 10_000).padStart(4, '0')}`,
      region: REGIONS[i % 8],
      segment: SEGMENTS[i % 4],
      notes: NOTES[i % 50],
    };
  }

  return items;
};

export const makeColumns = (): GridColumnDef[] => [
  { path: 'id', label: 'Id', width: 90 },
  { path: 'name', label: 'Name', width: 140 },
  { path: 'country', label: 'Country', width: 130 },
  { path: 'city', label: 'City', width: 110 },
  { path: 'category', label: 'Category', width: 130 },
  { path: 'status', label: 'Status', width: 100 },
  { path: 'active', label: 'Active', width: 90 },
  { path: 'year', label: 'Year', width: 80 },
  { path: 'quarter', label: 'Quarter', width: 90 },
  { path: 'month', label: 'Month', width: 80 },
  { path: 'date', label: 'Date', dataType: 'date', width: 120 },
  { path: 'amount', label: 'Amount', format: { minimumFractionDigits: 2 }, width: 120 },
  { path: 'quantity', label: 'Quantity', width: 100 },
  { path: 'price', label: 'Price', format: { style: 'currency', currency: 'USD' }, width: 110 },
  { path: 'discount', label: 'Discount', format: { style: 'percent' }, width: 100 },
  { path: 'tax', label: 'Tax', format: { style: 'percent' }, width: 80 },
  { path: 'rating', label: 'Rating', width: 80 },
  { path: 'code', label: 'Code', width: 90 },
  { path: 'sku', label: 'SKU', width: 110 },
  { path: 'email', label: 'Email', width: 200 },
  { path: 'phone', label: 'Phone', width: 140 },
  { path: 'region', label: 'Region', width: 100 },
  { path: 'segment', label: 'Segment', width: 110 },
  { path: 'notes', label: 'Notes', width: 220 },
];

/**
 * 8 colunas leves (inteiros pequenos, textos compartilhados e um nome único):
 * o cenário de 5 milhões de linhas — com as 24 colunas os itens sozinhos
 * passariam do heap de 1 GiB do perfil fraco (spec 16).
 */
export const makeLeanItems = (count: number): object[] => {
  const items = new Array<object>(count);

  for (let i = 0; i < count; i++) {
    items[i] = {
      id: i,
      name: `Item ${(i * 7919) % count}`,
      country: COUNTRIES[i % 16],
      category: CATEGORIES[(i * 5) % 12],
      status: STATUSES[i % 5],
      active: i % 3 === 0,
      year: 1960 + i % 65,
      quantity: (i * 37) % 100_000,
    };
  }

  return items;
};

export const makeLeanColumns = (): GridColumnDef[] => [
  { path: 'id', label: 'Id', width: 100 },
  { path: 'name', label: 'Name', width: 160 },
  { path: 'country', label: 'Country', width: 140 },
  { path: 'category', label: 'Category', width: 140 },
  { path: 'status', label: 'Status', width: 110 },
  { path: 'active', label: 'Active', width: 90 },
  { path: 'year', label: 'Year', width: 90 },
  { path: 'quantity', label: 'Quantity', format: { useGrouping: true }, width: 120 },
];
