import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import type { RebookingTourInfo } from '@/lib/bitrix-rebooking-lead';
import type { RebookingContext } from '@/lib/rebooking-context';

export const rebookingVisitStatusSchema = z.enum(['visited', 'searched', 'submitted']);
export type RebookingVisitStatus = z.infer<typeof rebookingVisitStatusSchema>;

export const rebookingVisitSchema = z.object({
  id: z.string().min(1),
  order: z.string().min(1),
  cert: z.string(),
  name: z.string(),
  people: z.number().int().nonnegative().optional(),
  kids: z.number().int().nonnegative().optional(),
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
  visitedAt: z.string().min(1),
  lastEventAt: z.string().min(1),
  lastEvent: z.string().optional(),
  status: rebookingVisitStatusSchema,
  selectedHotel: z.string().optional(),
  selectedCountry: z.string().optional(),
  selectedRegion: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  tourvisorOrderId: z.string().optional(),
  leadSource: z.enum(['direct', 'sync', 'webhook']).optional(),
  bitrixLeadId: z.number().optional(),
  userAgent: z.string().optional(),
  referer: z.string().optional(),
});

export type RebookingVisit = z.infer<typeof rebookingVisitSchema>;

const MAX_VISITS = 5000;
const MATCH_AGE_MS = 48 * 60 * 60 * 1000;
const runtimeVisitsPath =
  process.env.REBOOKING_VISITS_PATH ?? path.join(process.cwd(), 'storage/rebooking-visits.json');

const SEARCH_EVENTS = new Set([
  'TOURSELECTION',
  'BOOKTOUR',
  'ORDERTOUR',
  'HELPTOUR',
  'NOTOUR',
  'HELPCART',
]);

function makeVisitId() {
  return `rb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readVisitsRaw(): Promise<RebookingVisit[]> {
  try {
    const raw = await fs.readFile(runtimeVisitsPath, 'utf8');
    return z.array(rebookingVisitSchema).parse(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function writeVisits(visits: RebookingVisit[]) {
  await fs.mkdir(path.dirname(runtimeVisitsPath), { recursive: true });
  await fs.writeFile(runtimeVisitsPath, `${JSON.stringify(visits, null, 2)}\n`, 'utf8');
}

function mergeStatus(current: RebookingVisitStatus, next: RebookingVisitStatus): RebookingVisitStatus {
  const rank: Record<RebookingVisitStatus, number> = {
    visited: 0,
    searched: 1,
    submitted: 2,
  };
  return rank[next] > rank[current] ? next : current;
}

function tourToSelection(tour?: Partial<RebookingTourInfo>) {
  if (!tour) return {};
  return {
    selectedHotel: tour.hotel?.slice(0, 300),
    selectedCountry: tour.country?.slice(0, 120),
    selectedRegion: tour.region?.slice(0, 120),
    tourvisorOrderId: tour.tourvisorOrderId?.slice(0, 40),
  };
}

function findVisitIndex(visits: RebookingVisit[], visitId?: string, order?: string) {
  if (visitId) {
    const byId = visits.findIndex((item) => item.id === visitId);
    if (byId >= 0) return byId;
  }
  if (!order) return -1;

  const now = Date.now();
  let bestIndex = -1;
  let bestTs = 0;
  visits.forEach((item, index) => {
    if (item.order !== order) return;
    const ts = Date.parse(item.lastEventAt || item.visitedAt);
    if (!Number.isFinite(ts) || now - ts > MATCH_AGE_MS) return;
    if (ts >= bestTs) {
      bestTs = ts;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function patchVisit(
  visit: RebookingVisit,
  patch: {
    eventType?: string;
    lastEvent?: string;
    tour?: Partial<RebookingTourInfo>;
    phone?: string;
    email?: string;
    status?: RebookingVisitStatus;
    leadSource?: RebookingVisit['leadSource'];
    bitrixLeadId?: number;
    tourvisorOrderId?: string;
    selectedHotel?: string;
    selectedCountry?: string;
    selectedRegion?: string;
  }
): RebookingVisit {
  const now = new Date().toISOString();
  const eventType = patch.eventType || patch.lastEvent;
  const selection = tourToSelection(patch.tour);
  const hasSelection = Boolean(
    selection.selectedHotel || selection.selectedCountry || selection.selectedRegion
  );
  const isSearchEvent = eventType ? SEARCH_EVENTS.has(eventType.toUpperCase()) : false;

  let status = visit.status;
  if (patch.status) {
    status = mergeStatus(status, patch.status);
  } else if (hasSelection || isSearchEvent) {
    status = mergeStatus(status, 'searched');
  }

  return rebookingVisitSchema.parse({
    ...visit,
    selectedHotel: selection.selectedHotel || patch.selectedHotel || visit.selectedHotel,
    selectedCountry: selection.selectedCountry || patch.selectedCountry || visit.selectedCountry,
    selectedRegion: selection.selectedRegion || patch.selectedRegion || visit.selectedRegion,
    tourvisorOrderId: selection.tourvisorOrderId || patch.tourvisorOrderId || visit.tourvisorOrderId,
    phone: patch.phone || visit.phone,
    email: patch.email || visit.email,
    leadSource: patch.leadSource || visit.leadSource,
    bitrixLeadId: patch.bitrixLeadId ?? visit.bitrixLeadId,
    lastEvent: eventType || patch.lastEvent || visit.lastEvent,
    lastEventAt: now,
    status,
  });
}

export function isRebookingAdminPassword(password: string): boolean {
  return password === (process.env.REBOOKING_ADMIN_PASSWORD ?? 'rebooking2026');
}

export type CreateRebookingVisitInput = Omit<RebookingContext, 'registeredAt' | 'kidAges'> & {
  utm?: RebookingVisit['utm'];
  userAgent?: string;
  referer?: string;
};

export async function createRebookingVisit(input: CreateRebookingVisitInput): Promise<RebookingVisit> {
  const now = new Date().toISOString();
  const visit = rebookingVisitSchema.parse({
    id: makeVisitId(),
    order: input.order,
    cert: input.cert || '',
    name: input.name || '',
    people: input.people,
    kids: input.kids,
    price: input.price,
    nights: input.nights,
    date: input.date || undefined,
    utm: input.utm && Object.keys(input.utm).length ? input.utm : undefined,
    visitedAt: now,
    lastEventAt: now,
    lastEvent: 'visit',
    status: 'visited',
    userAgent: input.userAgent?.slice(0, 500),
    referer: input.referer?.slice(0, 500),
  });

  const visits = await readVisitsRaw();
  visits.unshift(visit);
  if (visits.length > MAX_VISITS) visits.length = MAX_VISITS;
  await writeVisits(visits);
  return visit;
}

export async function trackRebookingVisitEvent(input: {
  visitId?: string;
  order: string;
  eventType?: string;
  tour?: Partial<RebookingTourInfo>;
  phone?: string;
  email?: string;
}) {
  const visits = await readVisitsRaw();
  const index = findVisitIndex(visits, input.visitId, input.order);
  if (index < 0) return null;

  visits[index] = patchVisit(visits[index], {
    eventType: input.eventType,
    tour: input.tour,
    phone: input.phone?.slice(0, 30),
    email: input.email?.slice(0, 120),
  });
  await writeVisits(visits);
  return visits[index];
}

export async function markRebookingVisitSubmitted(input: {
  visitId?: string;
  order: string;
  phone?: string;
  email?: string;
  tour?: Partial<RebookingTourInfo>;
  leadSource: 'direct' | 'sync' | 'webhook';
  bitrixLeadId?: number;
  eventType?: string;
}) {
  const visits = await readVisitsRaw();
  const index = findVisitIndex(visits, input.visitId, input.order);
  if (index < 0) return null;

  visits[index] = patchVisit(visits[index], {
    eventType: input.eventType || 'lead_submitted',
    tour: input.tour,
    phone: input.phone?.slice(0, 30),
    email: input.email?.slice(0, 120),
    status: 'submitted',
    leadSource: input.leadSource,
    bitrixLeadId: input.bitrixLeadId,
  });
  await writeVisits(visits);
  return visits[index];
}

export async function listRebookingVisits(options?: { order?: string; limit?: number }) {
  let visits = await readVisitsRaw();
  const orderFilter = options?.order?.trim();
  if (orderFilter) {
    visits = visits.filter((visit) => visit.order.includes(orderFilter));
  }
  const limit = options?.limit ?? 500;
  return visits.slice(0, limit);
}
