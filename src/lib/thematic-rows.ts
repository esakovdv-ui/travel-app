import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { unstable_cache } from 'next/cache';
import type { HotelData } from '@/components/tours/hotel-card';

export interface ThematicRowSearch {
  toCountry: string;
  toCity?: string;
  adults: number;
  nightsFrom: number;
  nightsTo: number;
  startOffsetDays: number;
  endOffsetDays: number;
  maxResults: number;
}

export interface ThematicRowConfig {
  id: string;
  title: string;
  description: string;
  eyebrow: string;
  href: string;
  enabled: boolean;
  order: number;
  search: ThematicRowSearch;
}

const CONFIG_PATH = path.join(process.cwd(), 'src/data/thematic-rows.json');

export function readThematicRows(): ThematicRowConfig[] {
  const raw = readFileSync(CONFIG_PATH, 'utf-8');
  return JSON.parse(raw);
}

export function writeThematicRows(rows: ThematicRowConfig[]): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(rows, null, 2), 'utf-8');
}

const LT_BASE = 'https://api.level.travel';
const LT_HEADERS = {
  'Authorization': `Token token="${process.env.NEXT_PUBLIC_LT_PARTNER_TOKEN}"`,
  'Accept': 'application/vnd.leveltravel.v3.7',
};

const FINAL_STATUSES = new Set(['completed', 'failed', 'skipped', 'all_filtered', 'cached', 'no_results']);

/** YYYY-MM-DD → DD.MM.YYYY (формат Level Travel API) */
function toDisplayDate(date: string): string {
  if (!date) return '';
  if (date.includes('-')) return date.split('-').reverse().join('.');
  return date;
}

async function ltFetch(url: string, retries = 3): Promise<unknown> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: LT_HEADERS, cache: 'no-store' });
    if (res.ok) return res.json();
    if (res.status === 403 && attempt < retries) {
      // Rate limit — ждём перед повтором
      await new Promise(r => setTimeout(r, 15000 * attempt));
      continue;
    }
    throw new Error(`LT API ${res.status}: ${url}`);
  }
  throw new Error(`LT API: все попытки исчерпаны: ${url}`);
}

// Кэшируем каждый ряд на 6 часов
export const fetchRowHotels = unstable_cache(
  async (rowId: string, search: ThematicRowSearch): Promise<HotelData[]> => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() + search.startOffsetDays);
    // API ожидает DD.MM.YYYY
    const startDateStr = toDisplayDate(startDate.toISOString().split('T')[0]);

    // Тип поиска: RU → hotel, остальные → package
    const searchType = search.toCountry === 'RU' ? 'hotel' : 'package';

    const params = new URLSearchParams({
      from_city: 'Moscow',
      to_country: search.toCountry,
      adults: String(search.adults),
      search_type: searchType,
      start_date: startDateStr,
      nights: String(search.nightsFrom),
    });
    if (search.toCity) params.set('to_city', search.toCity);

    // Шаг 1: запускаем поиск
    const enqueueData = await ltFetch(`${LT_BASE}/search/enqueue?${params}`);
    const request_id: string = enqueueData.request_id;
    if (!request_id) {
      throw new Error(`[thematic-rows] ${rowId}: нет request_id`);
    }

    // Шаг 2: ждём завершения статуса (как в SDK — сначала статус, потом отели)
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const statusData = await ltFetch(
        `${LT_BASE}/search/status?request_id=${encodeURIComponent(request_id)}&show_size=true`
      );
      const statuses: Record<string, string> = statusData.status ?? {};
      const allDone = Object.values(statuses).length > 0 &&
        Object.values(statuses).every(s => FINAL_STATUSES.has(s));

      if (allDone) {
        // Шаг 3: получаем отели один раз после завершения
        const hotelsData = await ltFetch(
          `${LT_BASE}/search/get_grouped_hotels?request_id=${encodeURIComponent(request_id)}`
        );
        const hotels: HotelData[] = hotelsData.hotels ?? [];
        console.log(`[thematic-rows] ${rowId}: ${hotels.length} отелей`);
        return hotels.slice(0, search.maxResults);
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    // Бросаем ошибку вместо return [] — unstable_cache не кэширует результат при ошибке,
    // поэтому следующий запрос снова попробует API (а не получит [] из кэша на 6 часов)
    throw new Error(`[thematic-rows] ${rowId}: timeout`);
  },
  ['thematic-row-hotels'],
  { revalidate: 6 * 60 * 60, tags: ['thematic-rows'] }
);
