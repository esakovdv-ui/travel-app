const BASE_URL = 'https://api.level.travel';

const HEADERS = {
  'Authorization': `Token token="${process.env.LEVEL_TRAVEL_API_KEY}"`,
  'Accept': 'application/vnd.leveltravel.v3.7',
};

export interface SearchParams {
  fromCity?: string;
  toCountry: string;
  toCity?: string;
  adults: number;
  // Вариант А: конкретная дата + ночи
  startDate?: string;
  nights?: string;
  // Вариант Б: диапазон дат
  startDateFrom?: string;
  startDateTill?: string;
  endDateFrom?: string;
  endDateTill?: string;
  endDate?: string;
  kids?: number;
  kidsAges?: string;
  stars?: string;
  meal?: string;
  priceMin?: number;
  priceMax?: number;
  searchType?: 'hotel' | 'package' | 'auto';
}

/** YYYY-MM-DD или DD.MM.YYYY → DD.MM.YYYY (формат Level Travel API) */
function toDisplayDate(date: string): string {
  if (!date) return '';
  if (date.includes('-')) return date.split('-').reverse().join('.');
  return date;
}

/** Автовыбор типа поиска: RU → hotel, остальные → package */
function resolveSearchType(type: SearchParams['searchType'], country: string): string {
  if (!type || type === 'auto') return country === 'RU' ? 'hotel' : 'package';
  return type;
}

// 1. Добавить поиск в очередь
export async function enqueueSearch(params: SearchParams) {
  const searchType = resolveSearchType(params.searchType, params.toCountry);

  const p: Record<string, string> = {
    from_city: params.fromCity ?? 'Moscow',
    to_country: params.toCountry,
    adults: String(params.adults),
    search_type: searchType,
  };

  if (params.toCity)    p.to_city   = params.toCity;
  if (params.stars)     p.stars     = params.stars;
  if (params.meal)      p.meal      = params.meal;
  if (params.priceMin)  p.price_min = String(params.priceMin);
  if (params.priceMax)  p.price_max = String(params.priceMax);

  // Дети
  if (params.kids && params.kids > 0) {
    p.kids = String(params.kids);
    if (params.kidsAges) p.kids_ages = params.kidsAges;
  }

  // Вариант А: конкретная дата + ночи (API ожидает DD.MM.YYYY)
  if (params.startDate) p.start_date = toDisplayDate(params.startDate);
  if (params.nights)    p.nights     = params.nights;
  if (params.endDate)   p.end_date   = toDisplayDate(params.endDate);

  // Вариант Б: диапазон дат
  if (params.startDateFrom) p.start_date_from = params.startDateFrom;
  if (params.startDateTill) p.start_date_till = params.startDateTill;
  if (params.endDateFrom)   p.end_date_from   = params.endDateFrom;
  if (params.endDateTill)   p.end_date_till   = params.endDateTill;

  const query = new URLSearchParams(p);
  const res = await fetch(`${BASE_URL}/search/enqueue?${query}`, { headers: HEADERS });
  const text = await res.text();
  if (!res.ok) throw new Error(`Enqueue failed ${res.status}: ${text.slice(0, 300)}`);

  const data = JSON.parse(text);
  if (!data.request_id) throw new Error(`No request_id in response: ${text.slice(0, 200)}`);

  return data as { request_id: string };
}

// 2. Проверить статус поиска
export async function checkStatus(requestId: string) {
  const res = await fetch(
    `${BASE_URL}/search/status?request_id=${encodeURIComponent(requestId)}&show_size=true`,
    { headers: HEADERS }
  );
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
  return res.json() as Promise<{ status: Record<string, string>; size?: number }>;
}

// 3. Получить список отелей
export async function getHotels(requestId: string) {
  const res = await fetch(
    `${BASE_URL}/search/get_grouped_hotels?request_id=${encodeURIComponent(requestId)}`,
    { headers: HEADERS }
  );
  if (!res.ok) throw new Error(`Get hotels failed: ${res.status}`);
  return res.json();
}

const FINAL_STATUSES = new Set(['completed', 'failed', 'skipped', 'all_filtered', 'cached', 'no_results']);

// Проверка — все ли операторы завершили поиск
export function isSearchComplete(status: Record<string, string>): boolean {
  return Object.values(status).length > 0 &&
    Object.values(status).every(s => FINAL_STATUSES.has(s));
}

// Поллинг статуса с таймаутом (сначала дожидаемся завершения, потом берём отели)
export async function pollUntilComplete(requestId: string, maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const data = await checkStatus(requestId);
    if (isSearchComplete(data.status)) return data;
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('Search timeout');
}
