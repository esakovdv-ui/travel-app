import { enqueueSearch, pollUntilComplete, getHotels } from '@/lib/leveltravel';

/** YYYY-MM-DD или DD.MM.YYYY → DD.MM.YYYY (формат Level Travel API) */
function toDisplayDate(date: string | undefined): string | undefined {
  if (!date) return undefined;
  if (date.includes('-')) return date.split('-').reverse().join('.');
  return date;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const params = {
    fromCity:      searchParams.get('fromCity')      ?? 'Moscow',
    toCountry:     searchParams.get('toCountry')     ?? '',
    toCity:        searchParams.get('toCity')        ?? undefined,
    adults:        Number(searchParams.get('adults') ?? 2),
    // Вариант А (конвертируем в DD.MM.YYYY для API)
    startDate:     toDisplayDate(searchParams.get('startDate') ?? undefined),
    nights:        searchParams.get('nights')        ?? undefined,
    endDate:       toDisplayDate(searchParams.get('endDate') ?? undefined),
    // Вариант Б
    startDateFrom: searchParams.get('startDateFrom') ?? undefined,
    startDateTill: searchParams.get('startDateTill') ?? undefined,
    endDateFrom:   searchParams.get('endDateFrom')   ?? undefined,
    endDateTill:   searchParams.get('endDateTill')   ?? undefined,
    kids:          searchParams.get('kids') ? Number(searchParams.get('kids')) : undefined,
    kidsAges:      searchParams.get('kidsAges')      ?? undefined,
    searchType:    (searchParams.get('searchType')   ?? 'auto') as 'package' | 'hotel' | 'auto',
  };

  const hasDates = params.startDate || params.startDateFrom;
  if (!params.toCountry || !hasDates) {
    return Response.json(
      { error: 'toCountry и даты обязательны' },
      { status: 400 }
    );
  }

  try {
    // Шаг 1: ставим поиск в очередь
    const { request_id } = await enqueueSearch(params);

    // Шаг 2: ждём завершения поиска (поллинг)
    await pollUntilComplete(request_id);

    // Шаг 3: получаем отели
    const hotels = await getHotels(request_id);

    return Response.json({
      success: true,
      request_id,
      hotels: hotels.hotels,
      hotels_count: hotels.hotels_count,
      filters: hotels.filters,
    });

  } catch (err) {
    console.error('Search error:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Ошибка поиска' },
      { status: 500 }
    );
  }
}
