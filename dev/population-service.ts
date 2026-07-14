export class PopulationService {
  static async get(): Promise<any[]> {
    const response = await fetch('https://countriesnow.space/api/v0.1/countries/population');
    const data = await response.json()
    return data.data.flatMap((d: any) => d.populationCounts.map((p: any) => ({
        country: d.country,
        code: d.code,
        year: p.year,
        population: p.value,
      })));
  }
}
