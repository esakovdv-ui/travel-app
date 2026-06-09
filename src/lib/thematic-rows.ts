import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { unstable_cache } from 'next/cache';
import type { HotelData } from '@/components/tours/hotel-card';
import { enqueueSearch, pollUntilComplete, getHotels } from '@/lib/leveltravel';

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

// Кэшируем каждый ряд на 6 часов
export const fetchRowHotels = unstable_cache(
  async (rowId: string, search: ThematicRowSearch): Promise<HotelData[]> => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() + search.startOffsetDays);
    const startDateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD, leveltravel.ts сам конвертирует

    const { request_id } = await enqueueSearch({
      fromCity: 'Moscow',
      toCountry: search.toCountry,
      toCity: search.toCity || undefined,
      adults: search.adults,
      startDate: startDateStr,
      nights: String(search.nightsFrom),
    });

    await pollUntilComplete(request_id, 30000);

    const data = await getHotels(request_id);
    const hotels: HotelData[] = data.hotels ?? [];
    console.log(`[thematic-rows] ${rowId}: ${hotels.length} отелей`);
    return hotels.slice(0, search.maxResults);
  },
  ['thematic-row-hotels'],
  { revalidate: 6 * 60 * 60, tags: ['thematic-rows'] }
);
