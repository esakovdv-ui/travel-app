import { normalizeDestination } from '@/lib/destinations';
import { getLevelTravelDestinations } from '@/lib/leveltravel';

export async function GET(request: Request) {
  const query = normalizeDestination(new URL(request.url).searchParams.get('q')?.slice(0, 80) ?? '');
  if (query.length < 2) return Response.json([]);

  try {
    const countries = await getLevelTravelDestinations();
    const matches = countries.flatMap(country => country.cities.flatMap(city => {
      const names = [city.name_ru, city.name_en].map(normalizeDestination);
      const rank = names.includes(query) ? 0
        : names.some(name => name.startsWith(query)) ? 1
        : names.some(name => name.includes(query)) ? 2 : -1;
      if (rank < 0) return [];
      return [{
        rank,
        option: {
          label: `${city.name_ru}, ${country.name_ru}`,
          labelShort: city.name_ru,
          toCountry: country.iso2,
          toCity: city.name_en,
          category: 'catalog',
        },
      }];
    }));
    return Response.json(matches.sort((a, b) => a.rank - b.rank).slice(0, 20).map(match => match.option));
  } catch {
    return Response.json({ error: 'Directory unavailable' }, { status: 503 });
  }
}
