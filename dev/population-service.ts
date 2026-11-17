import { createSampleData, type PopulationRow } from './sample-data';

export class PopulationService {
  /**
   * Dados do demo. Por padrão são sintéticos (sem rede, o servidor sobe
   * offline); `?remote` busca a API pública countriesnow.space.
   */
  static async get(options: { rows?: number; remote?: boolean } = {}): Promise<PopulationRow[]> {
    if (!options.remote) {
      return createSampleData(options.rows);
    }

    const response = await fetch('https://countriesnow.space/api/v0.1/countries/population', {
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`countriesnow.space respondeu ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data?.data)) {
      throw new Error('Resposta inesperada de countriesnow.space');
    }

    return data.data.flatMap((d: any) => (Array.isArray(d.populationCounts) ? d.populationCounts : []).map((p: any) => ({
      country: String(d.country),
      code: String(d.code),
      year: Number(p.year),
      population: Number(p.value),
    })));
  }
}
