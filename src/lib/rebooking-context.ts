import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
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

const contextSchema = z.object({
  order: z.string().min(1),
  cert: z.string(),
  name: z.string(),
  people: z.number().int().nonnegative().optional(),
  kids: z.number().int().nonnegative().optional(),
  kidAges: z.array(z.number()),
  price: z.number().nonnegative().optional(),
  nights: z.number().int().positive().optional(),
  date: z.string().optional(),
  registeredAt: z.number(),
});

const TTL_MS = 30 * 60 * 1000;
const MAX_CONTEXTS = 2000;
const runtimeContextPath =
  process.env.REBOOKING_CONTEXT_PATH ?? path.join(process.cwd(), 'storage/rebooking-context.json');

async function readContextsRaw(): Promise<RebookingContext[]> {
  try {
    const raw = await fs.readFile(runtimeContextPath, 'utf8');
    return z.array(contextSchema).parse(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function writeContexts(contexts: RebookingContext[]) {
  await fs.mkdir(path.dirname(runtimeContextPath), { recursive: true });
  await fs.writeFile(runtimeContextPath, `${JSON.stringify(contexts, null, 2)}\n`, 'utf8');
}

function pruneExpired(contexts: RebookingContext[]): RebookingContext[] {
  const now = Date.now();
  return contexts.filter((entry) => now - entry.registeredAt <= TTL_MS);
}

export async function registerRebookingContext(input: Omit<RebookingContext, 'registeredAt'>) {
  const entry: RebookingContext = { ...input, registeredAt: Date.now() };
  let contexts = pruneExpired(await readContextsRaw());
  contexts = contexts.filter((item) => item.order !== entry.order);
  contexts.unshift(entry);
  if (contexts.length > MAX_CONTEXTS) contexts.length = MAX_CONTEXTS;
  await writeContexts(contexts);
  return entry;
}

export async function getRebookingContextByOrder(order: string): Promise<RebookingContext | undefined> {
  const contexts = pruneExpired(await readContextsRaw());
  return contexts.find((entry) => entry.order === order);
}

/** Most recent rebooking session for motrip.ru when referer is missing. */
export async function findRecentRebookingContext(
  maxAgeMs = 30 * 60 * 1000
): Promise<RebookingContext | undefined> {
  const contexts = pruneExpired(await readContextsRaw());
  const now = Date.now();
  let best: RebookingContext | undefined;
  for (const entry of contexts) {
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
