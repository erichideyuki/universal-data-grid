/**
 * Dados sintéticos e determinísticos para o demo (sem rede). `rows` controla o
 * volume — `?rows=100000` no demo serve para medir a rolagem.
 */
const COUNTRIES: [string, string][] = [
  ['Argentina', 'ARG'], ['Brazil', 'BRA'], ['Canada', 'CAN'], ['Chile', 'CHL'],
  ['France', 'FRA'], ['Germany', 'DEU'], ['India', 'IND'], ['Italy', 'ITA'],
  ['Japan', 'JPN'], ['Mexico', 'MEX'], ['Nigeria', 'NGA'], ['Portugal', 'PRT'],
  ['South Africa', 'ZAF'], ['Spain', 'ESP'], ['United Kingdom', 'GBR'], ['United States', 'USA'],
];

export interface PopulationRow {
  country: string;
  code: string;
  year: number;
  population: number;
  /** ISO (o demo serializa os dados em JSON, então datas viajam como texto). */
  updatedAt?: string;
  official?: boolean;
}

export const createSampleData = (rows = 1000): PopulationRow[] => {
  // PRNG mulberry32: mesma saída em todo servidor/navegador.
  let seed = 0x5eed;
  const random = (): number => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const data: PopulationRow[] = [];

  for (let i = 0; i < rows; i++) {
    const [country, code] = COUNTRIES[i % COUNTRIES.length];
    data.push({
      country,
      code,
      year: 1960 + Math.floor(i / COUNTRIES.length) % 65,
      population: Math.round(1_000_000 + random() * 300_000_000),
      updatedAt: new Date(Date.UTC(2024, 0, 1) + Math.floor(random() * 365 * 24 * 60) * 60_000).toISOString(),
      official: random() > 0.3,
    });
  }

  return data;
};
