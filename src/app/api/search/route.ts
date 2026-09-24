import { enqueueSearch, pollUntilComplete, getHotels } from '@/lib/leveltravel';

/** YYYY-MM-DD или DD.MM.YYYY → DD.MM.YYYY (формат Level Travel API) */
function toDisplayDate(date: string | undefined): string | undefined {
  if (!date) return undefined;
  if (date.includes('-')) return date.split('-').reverse().join('.');
  return date;
}

/**
 * Пустой параметр в URL — это отсутствие значения, а не значение «».
 * Без этого в LT уезжали пустые строки вида `endDateTill=`.
 *
 * Поиск это всё равно не чинит: при поиске диапазоном LT требует
 * end_date_from и end_date_till обязательно и на их отсутствие отвечает
 * «invalid date». Здесь мы просто не отправляем мусор.
 */
function str(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const params = {
    fromCity:      str(searchParams.get('fromCity'))  ?? 'Moscow',
    toCountry:     str(searchParams.get('toCountry')) ?? '',
    toCity:        str(searchParams.get('toCity')),
    adults:        Number(searchParams.get('adults') ?? 2),
    // Вариант А (конвертируем в DD.MM.YYYY для API)
    startDate:     toDisplayDate(str(searchParams.get('startDate'))),
    nights:        str(searchParams.get('nights')),
    endDate:       toDisplayDate(str(searchParams.get('endDate'))),
    // Вариант Б
    startDateFrom: str(searchParams.get('startDateFrom')),
    startDateTill: str(searchParams.get('startDateTill')),
    endDateFrom:   str(searchParams.get('endDateFrom')),
    endDateTill:   str(searchParams.get('endDateTill')),
    kids:          searchParams.get('kids') ? Number(searchParams.get('kids')) : undefined,
    kidsAges:      str(searchParams.get('kidsAges')),
    searchType:    (str(searchParams.get('searchType')) ?? 'auto') as 'package' | 'hotel' | 'auto',
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
    const { request_id, search_type } = await enqueueSearch(params);

    // Шаг 2: ждём завершения поиска (поллинг)
    await pollUntilComplete(request_id);

    // Шаг 3: получаем отели
    const hotels = await getHotels(request_id);

    return Response.json({
      success: true,
      request_id,
      // нужен клиенту, чтобы собрать ссылку на карточку отеля в WL
      search_type,
      hotels: hotels.hotels,
      hotels_count: hotels.hotels_count,
      filters: hotels.filters,
    });

  } catch (err) {
    // Полный ответ поставщика остаётся только в серверных логах: он содержит
    // его домен и внутренние коды, наружу такое отдавать нельзя.
    console.error('Search error:', err);
    const raw = err instanceof Error ? err.message : '';
    return Response.json(
      { error: /invalid date|parameters invalid/i.test(raw) ? 'invalid date' : 'search failed' },
      { status: 500 }
    );
  }
}
