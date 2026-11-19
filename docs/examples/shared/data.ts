/**
 * Sample data for the examples. Deterministic (seeded), so every visit shows the same rows.
 * In your app these rows come from your own API.
 */

/** Small seeded pseudo-random generator (mulberry32). */
export const random = (seed = 1) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const pick = <T>(next: () => number, list: readonly T[]): T => list[Math.floor(next() * list.length)]!;

export const COUNTRIES = ['Brazil', 'Canada', 'France', 'Germany', 'India', 'Japan', 'Mexico', 'Portugal', 'Spain', 'United Kingdom', 'United States'] as const;
export const CATEGORIES = ['Electronics', 'Furniture', 'Office', 'Outdoor', 'Toys'] as const;
export const STATUSES = ['Pending', 'Paid', 'Shipped', 'Delivered', 'Cancelled'] as const;

const PRODUCTS: Record<(typeof CATEGORIES)[number], readonly string[]> = {
  Electronics: ['Headphones', 'Monitor', 'Keyboard', 'Webcam', 'Speaker', 'Tablet'],
  Furniture: ['Desk', 'Chair', 'Bookshelf', 'Lamp', 'Cabinet'],
  Office: ['Notebook', 'Stapler', 'Pen set', 'Planner', 'Whiteboard'],
  Outdoor: ['Tent', 'Backpack', 'Bottle', 'Sleeping bag', 'Lantern'],
  Toys: ['Puzzle', 'Robot kit', 'Board game', 'Kite', 'Blocks'],
};

const FIRST = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Felipe', 'Giulia', 'Hiro', 'Isabel', 'João', 'Kenji', 'Laura', 'Marco', 'Nina', 'Omar', 'Paula', 'Rafael', 'Sofia', 'Tomás', 'Yuki'];
const LAST = ['Almeida', 'Becker', 'Costa', 'Dubois', 'Evans', 'Fischer', 'García', 'Hayashi', 'Ibrahim', 'Jensen', 'Kowalski', 'López', 'Martin', 'Nakamura', 'Oliveira', 'Patel', 'Rossi', 'Silva', 'Tanaka', 'Weber'];

export interface Order {
  id: number;
  customer: string;
  country: string;
  category: string;
  product: string;
  quantity: number;
  unitPrice: number;
  total: number;
  orderDate: Date;
  status: string;
  priority: boolean;
}

/** `count` sales orders from 2023 to 2025. */
export const makeOrders = (count = 500, seed = 7): Order[] => {
  const next = random(seed);
  const start = Date.UTC(2023, 0, 1);
  const span = Date.UTC(2025, 11, 31) - start;

  return Array.from({ length: count }, (_, i) => {
    const category = pick(next, CATEGORIES);
    const quantity = 1 + Math.floor(next() * 20);
    const unitPrice = Math.round((5 + next() * 495) * 100) / 100;

    return {
      id: i + 1,
      customer: `${pick(next, FIRST)} ${pick(next, LAST)}`,
      country: pick(next, COUNTRIES),
      category,
      product: pick(next, PRODUCTS[category]),
      quantity,
      unitPrice,
      total: Math.round(quantity * unitPrice * 100) / 100,
      orderDate: new Date(start + Math.floor(next() * span)),
      status: pick(next, STATUSES),
      priority: next() < 0.2,
    };
  });
};

export interface Employee {
  id: number;
  parentId: number | null;
  name: string;
  title: string;
  department: string;
  salary: number;
  hireDate: Date;
  email: string;
}

const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'Finance', 'Support'] as const;

/** An org chart as flat rows linked by `parentId` (CEO → directors → managers → staff). */
export const makeEmployees = (seed = 3): Employee[] => {
  const next = random(seed);
  const rows: Employee[] = [];
  const person = (parentId: number | null, title: string, department: string, salary: number): Employee => {
    const first = pick(next, FIRST);
    const last = pick(next, LAST);
    const row = {
      id: rows.length + 1,
      parentId,
      name: `${first} ${last}`,
      title,
      department,
      salary: Math.round(salary * (0.85 + next() * 0.3)),
      hireDate: new Date(Date.UTC(2010 + Math.floor(next() * 15), Math.floor(next() * 12), 1 + Math.floor(next() * 28))),
      email: `${first}.${last}@example.com`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
    };
    rows.push(row);
    return row;
  };

  const ceo = person(null, 'Chief Executive Officer', 'Management', 320_000);

  for (const department of DEPARTMENTS) {
    const director = person(ceo.id, `${department} Director`, department, 210_000);

    for (let m = 0; m < 2; m++) {
      const manager = person(director.id, `${department} Manager`, department, 140_000);

      for (let s = 0; s < 3 + Math.floor(next() * 3); s++) {
        person(manager.id, s === 0 ? `Senior ${department} Specialist` : `${department} Specialist`, department, 90_000);
      }
    }
  }

  return rows;
};

export interface Stock {
  symbol: string;
  company: string;
  sector: string;
  price: number;
  open: number;
  change: number;
  changePercent: number;
  volume: number;
  updatedAt: Date;
}

const SECTORS = ['Technology', 'Energy', 'Health', 'Finance', 'Retail', 'Industry'] as const;
const SYLLABLES = ['ac', 'ar', 'bo', 'ca', 'del', 'en', 'fi', 'gen', 'io', 'lu', 'max', 'neo', 'or', 'pra', 'qui', 'ro', 'sol', 'ta', 'ul', 'vex', 'zen'];

/** `count` fictional listed companies with a price, change and volume. */
export const makeStocks = (count = 60, seed = 11): Stock[] => {
  const next = random(seed);
  const used = new Set<string>();

  return Array.from({ length: count }, () => {
    let symbol = '';

    while (!symbol || used.has(symbol)) {
      symbol = Array.from({ length: 3 + Math.floor(next() * 2) }, () => String.fromCharCode(65 + Math.floor(next() * 26))).join('');
    }

    used.add(symbol);
    const name = pick(next, SYLLABLES) + pick(next, SYLLABLES) + pick(next, SYLLABLES);
    const open = Math.round((10 + next() * 490) * 100) / 100;

    return {
      symbol,
      company: `${name[0]!.toUpperCase()}${name.slice(1)} ${pick(next, ['Corp.', 'Inc.', 'Group', 'Holdings', 'Labs', 'S.A.'])}`,
      sector: pick(next, SECTORS),
      price: open,
      open,
      change: 0,
      changePercent: 0,
      volume: Math.floor(next() * 5_000_000),
      updatedAt: new Date(),
    };
  });
};

export interface LeanRow {
  id: number;
  name: string;
  country: string;
  quantity: number;
  price: number;
}

/**
 * Row `i` of a huge synthetic table, computed from the index alone — no storage, so a
 * "server" can answer any block of a billion rows instantly.
 */
export const leanRow = (i: number): LeanRow => ({
  id: i + 1,
  name: `Item ${((i * 7919) % 1_000_003).toString().padStart(7, '0')}`,
  country: COUNTRIES[i % COUNTRIES.length]!,
  quantity: (i * 37) % 10_000,
  price: ((i * 7_919) % 100_000) / 100,
});
