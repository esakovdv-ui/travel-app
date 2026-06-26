import {
  parseBookingPrice,
  parseKidAges,
  parsePositiveInt,
} from '@/lib/bitrix-rebooking-lead';

export type RebookingContext = {
  order: string;
  cert: string;
  name: string;
  people?: number;
  kids?: number;
  kidAges: number[];
  price?: number;
  nights?: number;
  date?: string;
  registeredAt: number;
};

const TTL_MS = 30 * 60 * 1000;
const store = new Map<string, RebookingContext>();

function pruneExpired() {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (now - value.registeredAt > TTL_MS) store.delete(key);
  }
}

export function registerRebookingContext(input: Omit<RebookingContext, 'registeredAt'>) {
  pruneExpired();
  const entry: RebookingContext = { ...input, registeredAt: Date.now() };
  store.set(input.order, entry);
  return entry;
}

export function getRebookingContextByOrder(order: string): RebookingContext | undefined {
  pruneExpired();
  const entry = store.get(order);
  if (!entry) return undefined;
  if (Date.now() - entry.registeredAt > TTL_MS) {
    store.delete(order);
    return undefined;
  }
  return entry;
}

/** Most recent rebooking session for motrip.ru when referer is missing. */
export function findRecentRebookingContext(maxAgeMs = 15 * 60 * 1000): RebookingContext | undefined {
  pruneExpired();
  const now = Date.now();
  let best: RebookingContext | undefined;
  for (const entry of store.values()) {
    const age = now - entry.registeredAt;
    if (age > maxAgeMs) continue;
    if (!best || entry.registeredAt > best.registeredAt) best = entry;
  }
  return best;
}

export function parseRebookingParamsFromUrl(rawUrl: string): Omit<RebookingContext, 'registeredAt'> | null {
  try {
    const url = new URL(rawUrl);
    if (!url.pathname.includes('/rebooking')) return null;
    const params = url.searchParams;
    const order = params.get('order')?.trim();
    if (!order) return null;
    const kids = parsePositiveInt(params.get('kids')) ?? 0;
    return {
      order,
      cert: params.get('cert')?.trim() || '',
      name: params.get('name')?.trim() || '',
      people: parsePositiveInt(params.get('people')),
      kids,
      kidAges: parseKidAges(
        {
          kid1: params.get('kid1'),
          kid2: params.get('kid2'),
          kid3: params.get('kid3'),
        },
        kids
      ),
      price: parseBookingPrice(params.get('price')),
      nights: parsePositiveInt(params.get('nights')),
      date: params.get('date')?.trim() || '',
    };
  } catch {
    return null;
  }
}

export function parseRebookingContextFromBody(body: Record<string, unknown>): Omit<RebookingContext, 'registeredAt'> | null {
  const order = typeof body.order === 'string' ? body.order.trim() : '';
  if (!order) return null;
  const kids = parsePositiveInt(body.kids) ?? 0;
  return {
    order,
    cert: typeof body.cert === 'string' ? body.cert.trim() : '',
    name: typeof body.name === 'string' ? body.name.trim() : '',
    people: parsePositiveInt(body.people),
    kids,
    kidAges: parseKidAges(body, kids),
    price: parseBookingPrice(body.price),
    nights: parsePositiveInt(body.nights),
    date: typeof body.date === 'string' ? body.date.trim() : '',
  };
}
