import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import type { RebookingTourInfo } from '@/lib/bitrix-rebooking-lead';
import type { UtmFields } from '@/lib/bitrix-camp-lead';

export const rebookingBitrixStatusSchema = z.enum(['pending', 'sent', 'failed']);
export type RebookingBitrixStatus = z.infer<typeof rebookingBitrixStatusSchema>;

export const rebookingCaptureSourceSchema = z.enum(['direct', 'sync', 'webhook']);
export type RebookingCaptureSource = z.infer<typeof rebookingCaptureSourceSchema>;

const tourSchema = z.object({
  hotel: z.string().optional(),
  country: z.string().optional(),
  region: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  nights: z.number().int().positive().optional(),
  price: z.number().nonnegative().optional(),
  placement: z.string().optional(),
  meal: z.string().optional(),
  tourvisorOrderId: z.string().optional(),
  orderTypeName: z.string().optional(),
  email: z.string().optional(),
});

export const rebookingQueuedLeadSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  visitId: z.string().optional(),
  order: z.string().min(1),
  cert: z.string(),
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().optional(),
  comment: z.string().optional(),
  people: z.number().int().nonnegative().optional(),
  kids: z.number().int().nonnegative().optional(),
  kidAges: z.array(z.number()).optional(),
  price: z.number().nonnegative().optional(),
  nights: z.number().int().positive().optional(),
  date: z.string().optional(),
  destination: z.string().optional(),
  tour: tourSchema.optional(),
  utm: z
    .object({
      utm_source: z.string().optional(),
      utm_medium: z.string().optional(),
      utm_campaign: z.string().optional(),
      utm_content: z.string().optional(),
      utm_term: z.string().optional(),
    })
    .optional(),
  captureSource: rebookingCaptureSourceSchema,
  tourvisorOrderId: z.string().optional(),
  eventType: z.string().optional(),
  bitrixStatus: rebookingBitrixStatusSchema,
  bitrixLeadId: z.number().optional(),
  bitrixSyncedAt: z.string().optional(),
  bitrixError: z.string().optional(),
});

export type RebookingQueuedLead = z.infer<typeof rebookingQueuedLeadSchema>;

const MAX_LEADS = 5000;
const DEDUP_MS = 24 * 60 * 60 * 1000;
const runtimeLeadsPath =
  process.env.REBOOKING_LEADS_PATH ?? path.join(process.cwd(), 'storage/rebooking-leads.json');

function makeLeadId() {
  return `rbl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readLeadsRaw(): Promise<RebookingQueuedLead[]> {
  try {
    const raw = await fs.readFile(runtimeLeadsPath, 'utf8');
    return z.array(rebookingQueuedLeadSchema).parse(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function writeLeads(leads: RebookingQueuedLead[]) {
  await fs.mkdir(path.dirname(runtimeLeadsPath), { recursive: true });
  await fs.writeFile(runtimeLeadsPath, `${JSON.stringify(leads, null, 2)}\n`, 'utf8');
}

export type EnqueueRebookingLeadInput = {
  visitId?: string;
  order: string;
  cert: string;
  name: string;
  phone: string;
  email?: string;
  comment?: string;
  people?: number;
  kids?: number;
  kidAges?: number[];
  price?: number;
  nights?: number;
  date?: string;
  destination?: string;
  tour?: RebookingTourInfo;
  utm?: UtmFields;
  captureSource: RebookingCaptureSource;
  tourvisorOrderId?: string;
  eventType?: string;
};

function findDuplicate(
  leads: RebookingQueuedLead[],
  input: EnqueueRebookingLeadInput
): RebookingQueuedLead | undefined {
  const now = Date.now();
  return leads.find((lead) => {
    const created = Date.parse(lead.createdAt);
    if (!Number.isFinite(created) || now - created > DEDUP_MS) return false;
    if (input.tourvisorOrderId && lead.tourvisorOrderId === input.tourvisorOrderId) return true;
    return lead.order === input.order && lead.phone === input.phone;
  });
}

export async function enqueueRebookingLead(
  input: EnqueueRebookingLeadInput
): Promise<{ lead: RebookingQueuedLead; duplicate: boolean }> {
  const leads = await readLeadsRaw();
  const existing = findDuplicate(leads, input);
  if (existing) {
    return { lead: existing, duplicate: true };
  }

  const tour = input.tour
    ? tourSchema.parse({
        hotel: input.tour.hotel,
        country: input.tour.country,
        region: input.tour.region,
        dateFrom: input.tour.dateFrom,
        dateTo: input.tour.dateTo,
        nights: input.tour.nights,
        price: input.tour.price,
        placement: input.tour.placement,
        meal: input.tour.meal,
        tourvisorOrderId: input.tour.tourvisorOrderId,
        orderTypeName: input.tour.orderTypeName,
        email: input.tour.email,
      })
    : undefined;

  const lead = rebookingQueuedLeadSchema.parse({
    id: makeLeadId(),
    createdAt: new Date().toISOString(),
    visitId: input.visitId,
    order: input.order,
    cert: input.cert || '',
    name: input.name || 'Клиент',
    phone: input.phone,
    email: input.email,
    comment: input.comment?.slice(0, 2000),
    people: input.people,
    kids: input.kids,
    kidAges: input.kidAges?.length ? input.kidAges : undefined,
    price: input.price,
    nights: input.nights,
    date: input.date,
    destination: input.destination,
    tour,
    utm: input.utm && Object.keys(input.utm).length ? input.utm : undefined,
    captureSource: input.captureSource,
    tourvisorOrderId: input.tourvisorOrderId,
    eventType: input.eventType,
    bitrixStatus: 'pending',
  });

  leads.unshift(lead);
  if (leads.length > MAX_LEADS) leads.length = MAX_LEADS;
  await writeLeads(leads);
  return { lead, duplicate: false };
}

export async function updateRebookingLeadBitrix(
  leadId: string,
  patch: {
    bitrixStatus: RebookingBitrixStatus;
    bitrixLeadId?: number;
    bitrixError?: string;
  }
): Promise<RebookingQueuedLead | null> {
  const leads = await readLeadsRaw();
  const index = leads.findIndex((item) => item.id === leadId);
  if (index < 0) return null;

  leads[index] = rebookingQueuedLeadSchema.parse({
    ...leads[index],
    ...patch,
    bitrixError: patch.bitrixError?.slice(0, 240),
    bitrixSyncedAt:
      patch.bitrixStatus === 'sent' ? new Date().toISOString() : leads[index].bitrixSyncedAt,
  });
  await writeLeads(leads);
  return leads[index];
}

export async function listRebookingLeads(options?: {
  order?: string;
  status?: RebookingBitrixStatus | 'all';
  limit?: number;
}) {
  let leads = await readLeadsRaw();
  const orderFilter = options?.order?.trim();
  if (orderFilter) {
    leads = leads.filter((lead) => lead.order.includes(orderFilter));
  }
  const status = options?.status ?? 'all';
  if (status !== 'all') {
    leads = leads.filter((lead) => lead.bitrixStatus === status);
  }
  const limit = options?.limit ?? 500;
  return leads.slice(0, limit);
}

export async function listPendingRebookingLeads(limit = 30) {
  const leads = await readLeadsRaw();
  return leads
    .filter((lead) => lead.bitrixStatus === 'pending' || lead.bitrixStatus === 'failed')
    .slice(0, limit);
}

export function isRebookingSyncAuthorized(secret: string): boolean {
  const expected =
    process.env.REBOOKING_BITRIX_SYNC_SECRET?.trim() ||
    process.env.REBOOKING_ADMIN_PASSWORD?.trim() ||
    'rebooking2026';
  return secret === expected;
}
