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

    // Шаг 2: ждём завершения поиска (поллинг).
    //
    // Раньше таймаут выбрасывал ошибку, и человек видел «не удалось загрузить»
    // даже когда часть операторов уже всё нашла: мы ждём, пока закончат ВСЕ,
    // и один подвисший хоронил всю выдачу. Так 01.10 перестали открываться
    // Египет, ОАЭ и Вьетнам — ровно на 31-й секунде.
    //
    // Теперь таймаут не фатален: забираем то, что успело найтись. Выдача
    // может быть неполной, но это лучше пустого экрана с ошибкой.
    //
    // 45 секунд, а не 30: холодный поиск по дальним направлениям у Level Travel
    // занимает 23–31 секунду, и прежний лимит резал его на самом краю. ОАЭ
    // и Вьетнам из-за этого отдавали пусто, хотя туры есть — на повторном
    // запросе те же даты приходили из их кэша за секунду.
    //
    // Выше не поднимаем: nginx на сервере рвёт запрос по proxy_read_timeout,
    // а он стоит по умолчанию в 60 секунд.
    let complete = true;
    try {
      await pollUntilComplete(request_id, 45_000);
    } catch {
      complete = false;
      console.warn(`[search] таймаут поллинга, отдаём частичную выдачу: ${request_id}`);
    }

    // Шаг 3: получаем отели
    const hotels = await getHotels(request_id);

    return Response.json({
      success: true,
      request_id,
      // нужен клиенту, чтобы собрать ссылку на карточку отеля в WL
      search_type,
      // false — часть операторов не успела ответить, выдача неполная
      complete,
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
