import {
  normalizeLeadPhone,
  parseBookingPrice,
  parsePositiveInt,
  type RebookingTourInfo,
} from '@/lib/bitrix-rebooking-lead';
import { enqueueRebookingLead } from '@/lib/rebooking-lead-store';
import {
  findRecentRebookingContext,
  parseRebookingParamsFromUrl,
  type RebookingContext,
} from '@/lib/rebooking-context';
import { findRecentRebookingVisitContext } from '@/lib/rebooking-visit-store';

export type TourvisorOrderRecord = Record<string, unknown>;

const MOTRIP_DOMAINS = ['motrip.ru'];
const PROCESSED_TTL_MS = 24 * 60 * 60 * 1000;
const processedOrderIds = new Map<string, number>();

function pruneProcessed() {
  const now = Date.now();
  for (const [id, ts] of processedOrderIds.entries()) {
    if (now - ts > PROCESSED_TTL_MS) processedOrderIds.delete(id);
  }
}

export function wasTourvisorOrderProcessed(orderId: string): boolean {
  pruneProcessed();
  return processedOrderIds.has(orderId);
}

export function markTourvisorOrderProcessed(orderId: string) {
  processedOrderIds.set(orderId, Date.now());
}

export function pickString(record: TourvisorOrderRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function isMotripDomain(domain: string): boolean {
  const normalized = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return MOTRIP_DOMAINS.some((d) => normalized === d || normalized.endsWith('.' + d));
}

export function mapTourvisorOrderToTour(order: TourvisorOrderRecord): RebookingTourInfo {
  const hotelBlock = order.hotel;
  const hotelRecord =
    Array.isArray(hotelBlock) && hotelBlock[0] && typeof hotelBlock[0] === 'object'
      ? (hotelBlock[0] as TourvisorOrderRecord)
      : typeof hotelBlock === 'object' && hotelBlock
        ? (hotelBlock as TourvisorOrderRecord)
        : {};

  const typename = pickString(order, ['typename', 'type_name']);
  const typeCode = pickString(order, ['type']);
  const isSelection =
    /подбор/i.test(typename) || typeCode === '1' || typeCode === '2' || pickString(order, ['istour']) === '0';

  let hotel =
    pickString(order, ['hotelname', 'hotel']) || pickString(hotelRecord, ['name', 'hotelname']);
  if (!hotel && isSelection) hotel = 'Подбор тура';

  return {
    hotel: hotel || undefined,
    country: pickString(order, ['country']) || pickString(hotelRecord, ['country']) || undefined,
    region: pickString(order, ['region', 'resort']) || pickString(hotelRecord, ['region']) || undefined,
    dateFrom:
      pickString(order, ['flydate', 'datefrom', 'startdate']) ||
      pickString(hotelRecord, ['startdate']) ||
      undefined,
    nights: parsePositiveInt(order.nights ?? hotelRecord.nights),
    price: parseBookingPrice(order.price ?? order.tourprice ?? order.cost),
    placement: pickString(order, ['placement']) || pickString(hotelRecord, ['placement']) || undefined,
    meal: pickString(order, ['meal']) || pickString(hotelRecord, ['meal']) || undefined,
    tourvisorOrderId: pickString(order, ['id', 'orderid']),
    orderTypeName: typename || undefined,
    email: pickString(order, ['email', 'mail']) || undefined,
    raw: order,
  };
}

function extractOrderRecords(data: Record<string, unknown>): TourvisorOrderRecord[] {
  const nested = data.orders as Record<string, unknown> | undefined;
  const fromNested = nested?.order;
  if (Array.isArray(fromNested)) return fromNested as TourvisorOrderRecord[];
  if (fromNested && typeof fromNested === 'object') return [fromNested as TourvisorOrderRecord];
  if (data.order && typeof data.order === 'object') return [data.order as TourvisorOrderRecord];
  if (Array.isArray(data.orders)) return data.orders as TourvisorOrderRecord[];
  return [];
}

export async function fetchTourvisorOrderById(orderId: string, type: string): Promise<TourvisorOrderRecord> {
  const authkey = process.env.TOURVISOR_AUTHKEY;
  if (!authkey) throw new Error('misconfigured');

  const endpoint = type === '1' ? 'ordersonline.php' : 'orders.php';
  const url = new URL(`https://tourvisor.ru/xml/${endpoint}`);
  url.searchParams.set('authkey', authkey);
  url.searchParams.set('id', orderId);
  url.searchParams.set('format', 'json');

  const response = await fetch(url.toString(), { cache: 'no-store' });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    console.error('tourvisor-rebooking: fetch order failed', data);
    throw new Error('tourvisor_fetch_failed');
  }

  const records = extractOrderRecords(data);
  const record = records[0];
  if (!record || typeof record !== 'object') throw new Error('tourvisor_order_not_found');
  return record;
}

export async function fetchRecentTourvisorOrders(limit = 5, type = '0'): Promise<TourvisorOrderRecord[]> {
  const authkey = process.env.TOURVISOR_AUTHKEY;
  if (!authkey) throw new Error('misconfigured');

  const endpoint = type === '1' ? 'ordersonline.php' : 'orders.php';
  const url = new URL(`https://tourvisor.ru/xml/${endpoint}`);
  url.searchParams.set('authkey', authkey);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('format', 'json');

  const response = await fetch(url.toString(), { cache: 'no-store' });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error('tourvisor_fetch_failed');
  return extractOrderRecords(data);
}

async function resolveRebookingFromTvOrder(tvOrder: TourvisorOrderRecord): Promise<RebookingContext | null> {
  const referer = pickString(tvOrder, ['referer', 'referrer', 'page', 'sourceurl', 'url']);
  if (referer) {
    const fromUrl = parseRebookingParamsFromUrl(referer);
    if (fromUrl) return { ...fromUrl, registeredAt: Date.now() };
  }

  const domain = pickString(tvOrder, ['domain']);
  if (domain && isMotripDomain(domain)) {
    const fromContext = await findRecentRebookingContext();
    if (fromContext) return fromContext;
    const fromVisit = await findRecentRebookingVisitContext();
    if (fromVisit) {
      return {
        order: fromVisit.order,
        cert: fromVisit.cert,
        name: fromVisit.name,
        people: fromVisit.people,
        kids: fromVisit.kids,
        kidAges: [],
        price: fromVisit.price,
        nights: fromVisit.nights,
        date: fromVisit.date,
        registeredAt: fromVisit.registeredAt,
      };
    }
  }

  return null;
}

function buildClientName(tvOrder: TourvisorOrderRecord, fallback: string): string {
  const direct = pickString(tvOrder, ['name', 'clientname', 'touristname', 'fio']);
  if (direct) return direct;
  const surname = pickString(tvOrder, ['surname', 'lastname']);
  const first = pickString(tvOrder, ['firstname']);
  const otch = pickString(tvOrder, ['otch', 'patronymic']);
  const parts = [surname, first, otch].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return fallback || 'Клиент';
}

function buildComment(tvOrder: TourvisorOrderRecord, eventType?: string): string | undefined {
  const parts: string[] = [];
  const typename = pickString(tvOrder, ['typename', 'type_name']);
  if (typename) parts.push(`Тип заявки TV: ${typename}`);
  if (eventType) parts.push(`Событие: ${eventType}`);
  const comments = pickString(tvOrder, ['comments', 'comment']);
  if (comments) parts.push(`Комментарий клиента: ${comments}`);
  return parts.length ? parts.join('\n') : undefined;
}

export async function captureTourvisorOrderAsLead(options: {
  logPrefix: string;
  tvOrder: TourvisorOrderRecord;
  tourvisorOrderId: string;
  rebooking?: RebookingContext | null;
  eventType?: string;
  visitId?: string;
  captureSource: 'sync' | 'webhook';
}) {
  const { tvOrder, tourvisorOrderId, eventType, captureSource } = options;

  if (wasTourvisorOrderProcessed(tourvisorOrderId)) {
    return { skipped: true as const, reason: 'duplicate' };
  }

  const rebooking = options.rebooking ?? (await resolveRebookingFromTvOrder(tvOrder));
  if (!rebooking) {
    return { skipped: true as const, reason: 'not_rebooking' };
  }

  const phoneRaw =
    pickString(tvOrder, ['phone', 'mobile', 'tel']) ||
    pickString(tvOrder, ['clientphone', 'touristphone']);
  const phone = normalizeLeadPhone(phoneRaw);
  if (!phone) throw new Error('invalid_phone');

  const tour = mapTourvisorOrderToTour(tvOrder);
  tour.tourvisorOrderId = tourvisorOrderId;
  if (!tour.hotel && !tour.country) {
    tour.hotel = eventType === 'NOTOUR' ? 'Подбор тура (нет результатов)' : 'Заявка через Tourvisor';
  }

  const clientName = buildClientName(tvOrder, rebooking.name);
  const { lead, duplicate } = await enqueueRebookingLead({
    visitId: options.visitId,
    order: rebooking.order,
    cert: rebooking.cert,
    name: clientName,
    phone,
    email: tour.email,
    people: rebooking.people,
    kids: rebooking.kids,
    kidAges: rebooking.kidAges,
    price: rebooking.price,
    nights: rebooking.nights,
    date: rebooking.date || undefined,
    tour,
    comment: buildComment(tvOrder, eventType),
    captureSource,
    tourvisorOrderId,
    eventType,
  });

  if (!duplicate) {
    markTourvisorOrderProcessed(tourvisorOrderId);
  }

  return {
    skipped: false as const,
    queued: true as const,
    leadId: lead.id,
    duplicate,
    order: rebooking.order,
    bitrixPending: lead.bitrixStatus === 'pending',
  };
}

/** @deprecated use captureTourvisorOrderAsLead */
export const submitTourvisorOrderToBitrix = captureTourvisorOrderAsLead;

export async function captureRecentTourvisorOrderAsLead(options: {
  logPrefix: string;
  rebooking: RebookingContext;
  eventType?: string;
  maxAgeSeconds?: number;
  visitId?: string;
}) {
  const maxAgeMs = (options.maxAgeSeconds ?? 120) * 1000;
  const orders = await fetchRecentTourvisorOrders(8, '0');
  const now = Date.now();

  for (const tvOrder of orders) {
    const tvOrderId = pickString(tvOrder, ['id', 'orderid']);
    if (!tvOrderId || wasTourvisorOrderProcessed(tvOrderId)) continue;

    const domain = pickString(tvOrder, ['domain']);
    if (domain && !isMotripDomain(domain)) continue;

    const dateStr = pickString(tvOrder, ['date']);
    const timeStr = pickString(tvOrder, ['time']);
    if (dateStr) {
      const [d, m, y] = dateStr.split('.').map(Number);
      const [hh = 0, mm = 0, ss = 0] = timeStr.split(':').map(Number);
      const created = new Date(y, m - 1, d, hh, mm, ss).getTime();
      if (Number.isFinite(created) && now - created > maxAgeMs) continue;
    }

    const phone = normalizeLeadPhone(pickString(tvOrder, ['phone', 'mobile', 'tel']));
    if (!phone) continue;

    return captureTourvisorOrderAsLead({
      logPrefix: options.logPrefix,
      tvOrder,
      tourvisorOrderId: tvOrderId,
      rebooking: options.rebooking,
      eventType: options.eventType,
      visitId: options.visitId,
      captureSource: 'sync',
    });
  }

  throw new Error('tourvisor_order_not_found');
}

/** @deprecated use captureRecentTourvisorOrderAsLead */
export const syncRecentTourvisorOrderToBitrix = captureRecentTourvisorOrderAsLead;

