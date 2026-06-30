import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import type { UtmFields } from '@/lib/bitrix-camp-lead';

export const rebookingAnnulBitrixStatusSchema = z.enum(['sent', 'failed']);
export type RebookingAnnulBitrixStatus = z.infer<typeof rebookingAnnulBitrixStatusSchema>;

export const rebookingAnnulRecordSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  visitId: z.string().optional(),
  order: z.string().min(1),
  cert: z.string(),
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().optional(),
  comment: z.string().optional(),
  people: z.number().int().nonnegative().optional(),
  kids: z.number().int().nonnegative().optional(),
  kidAges: z.array(z.number()).optional(),
  price: z.number().nonnegative().optional(),
  nights: z.number().int().positive().optional(),
  date: z.string().optional(),
  utm: z
    .object({
      utm_source: z.string().optional(),
      utm_medium: z.string().optional(),
      utm_campaign: z.string().optional(),
      utm_content: z.string().optional(),
      utm_term: z.string().optional(),
    })
    .optional(),
  bitrixStatus: rebookingAnnulBitrixStatusSchema,
  bitrixItemId: z.number().optional(),
  bitrixError: z.string().optional(),
});

export type RebookingAnnulRecord = z.infer<typeof rebookingAnnulRecordSchema>;

const MAX_RECORDS = 5000;
const DEDUP_MS = 24 * 60 * 60 * 1000;
const runtimeAnnulsPath =
  process.env.REBOOKING_ANNULS_PATH ?? path.join(process.cwd(), 'storage/rebooking-annuls.json');

function makeAnnulId() {
  return `rba-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readAnnulsRaw(): Promise<RebookingAnnulRecord[]> {
  try {
    const raw = await fs.readFile(runtimeAnnulsPath, 'utf8');
    return z.array(rebookingAnnulRecordSchema).parse(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function writeAnnuls(records: RebookingAnnulRecord[]) {
  await fs.mkdir(path.dirname(runtimeAnnulsPath), { recursive: true });
  await fs.writeFile(runtimeAnnulsPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
}

export type RecordRebookingAnnulInput = {
  visitId?: string;
  order: string;
  cert: string;
  name: string;
  phone?: string;
  email?: string;
  comment?: string;
  people?: number;
  kids?: number;
  kidAges?: number[];
  price?: number;
  nights?: number;
  date?: string;
  utm?: UtmFields;
  bitrixStatus: RebookingAnnulBitrixStatus;
  bitrixItemId?: number;
  bitrixError?: string;
};

function findRecentSentDuplicate(
  records: RebookingAnnulRecord[],
  order: string
): RebookingAnnulRecord | undefined {
  const now = Date.now();
  return records.find((record) => {
    if (record.order !== order || record.bitrixStatus !== 'sent') return false;
    const created = Date.parse(record.createdAt);
    return Number.isFinite(created) && now - created <= DEDUP_MS;
  });
}

export async function recordRebookingAnnul(
  input: RecordRebookingAnnulInput
): Promise<{ record: RebookingAnnulRecord; duplicate: boolean }> {
  const records = await readAnnulsRaw();

  if (input.bitrixStatus === 'sent') {
    const existing = findRecentSentDuplicate(records, input.order);
    if (existing) return { record: existing, duplicate: true };
  }

  const record = rebookingAnnulRecordSchema.parse({
    id: makeAnnulId(),
    createdAt: new Date().toISOString(),
    visitId: input.visitId,
    order: input.order,
    cert: input.cert || '',
    name: input.name || 'Клиент',
    phone: input.phone?.slice(0, 30),
    email: input.email?.slice(0, 120),
    comment: input.comment?.slice(0, 2000),
    people: input.people,
    kids: input.kids,
    kidAges: input.kidAges?.length ? input.kidAges : undefined,
    price: input.price,
    nights: input.nights,
    date: input.date,
    utm: input.utm && Object.keys(input.utm).length ? input.utm : undefined,
    bitrixStatus: input.bitrixStatus,
    bitrixItemId: input.bitrixItemId,
    bitrixError: input.bitrixError?.slice(0, 240),
  });

  records.unshift(record);
  if (records.length > MAX_RECORDS) records.length = MAX_RECORDS;
  await writeAnnuls(records);
  return { record, duplicate: false };
}

export async function listRebookingAnnuls(options?: {
  order?: string;
  status?: RebookingAnnulBitrixStatus | 'all';
  limit?: number;
}) {
  let records = await readAnnulsRaw();
  const orderFilter = options?.order?.trim();
  if (orderFilter) {
    records = records.filter((record) => record.order.includes(orderFilter));
  }
  const status = options?.status ?? 'all';
  if (status !== 'all') {
    records = records.filter((record) => record.bitrixStatus === status);
  }
  const limit = options?.limit ?? 500;
  return records.slice(0, limit);
}
