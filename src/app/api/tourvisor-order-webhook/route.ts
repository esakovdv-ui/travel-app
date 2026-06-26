import { NextRequest, NextResponse } from 'next/server';
import {
  clamp,
  mapRebookingLeadError,
  normalizeLeadPhone,
  parseBookingPrice,
  parseKidAges,
  parsePositiveInt,
  submitRebookingLead,
  type RebookingTourInfo,
} from '@/lib/bitrix-rebooking-lead';

export const dynamic = 'force-dynamic';

type TourvisorOrderRecord = Record<string, unknown>;

function pickString(record: TourvisorOrderRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function parseRebookingParamsFromUrl(rawUrl: string) {
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

function mapTourvisorOrderToTour(order: TourvisorOrderRecord): RebookingTourInfo {
  const hotelBlock = order.hotel;
  const hotelRecord =
    Array.isArray(hotelBlock) && hotelBlock[0] && typeof hotelBlock[0] === 'object'
      ? (hotelBlock[0] as TourvisorOrderRecord)
      : typeof hotelBlock === 'object' && hotelBlock
        ? (hotelBlock as TourvisorOrderRecord)
        : {};

  return {
    hotel: pickString(order, ['hotelname', 'hotel']) || pickString(hotelRecord, ['name', 'hotelname']),
    country: pickString(order, ['country']) || pickString(hotelRecord, ['country']),
    region: pickString(order, ['region', 'resort']) || pickString(hotelRecord, ['region']),
    dateFrom: pickString(order, ['flydate', 'datefrom', 'startdate']) || pickString(hotelRecord, ['startdate']),
    nights: parsePositiveInt(order.nights ?? hotelRecord.nights),
    price: parseBookingPrice(order.price ?? order.tourprice ?? order.cost),
    placement: pickString(order, ['placement']) || pickString(hotelRecord, ['placement']),
    meal: pickString(order, ['meal']) || pickString(hotelRecord, ['meal']),
    tourvisorOrderId: pickString(order, ['id', 'orderid']),
    raw: order,
  };
}

async function fetchTourvisorOrder(orderId: string, type: string) {
  const authkey = process.env.TOURVISOR_AUTHKEY;
  if (!authkey) throw new Error('misconfigured');

  const url = new URL('https://tourvisor.ru/xml/orders.php');
  url.searchParams.set('authkey', authkey);
  url.searchParams.set('id', orderId);
  url.searchParams.set('type', type);
  url.searchParams.set('format', 'json');

  const response = await fetch(url.toString(), { cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('tourvisor-order-webhook: orders.php failed', data);
    throw new Error('tourvisor_fetch_failed');
  }

  const record =
    (data?.order as TourvisorOrderRecord | undefined) ||
    (Array.isArray(data?.orders) ? (data.orders[0] as TourvisorOrderRecord) : undefined) ||
    (data as TourvisorOrderRecord);

  if (!record || typeof record !== 'object') {
    throw new Error('tourvisor_order_not_found');
  }
  return record;
}

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get('id')?.trim();
  const type = request.nextUrl.searchParams.get('type')?.trim() || '0';

  if (!orderId) {
    return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
  }

  try {
    const tvOrder = await fetchTourvisorOrder(orderId, type);
    const referer = pickString(tvOrder, ['referer', 'referrer', 'page', 'sourceurl', 'url']);
    const rebooking = referer ? parseRebookingParamsFromUrl(referer) : null;

    if (!rebooking) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'not_rebooking' });
    }

    const phoneRaw =
      pickString(tvOrder, ['phone', 'mobile', 'tel']) ||
      pickString(tvOrder, ['clientphone', 'touristphone']);
    const phone = normalizeLeadPhone(phoneRaw);
    if (!phone) {
      return NextResponse.json({ ok: false, error: 'invalid_phone' }, { status: 422 });
    }

    const tour = mapTourvisorOrderToTour(tvOrder);
    tour.tourvisorOrderId = orderId;

    const name =
      rebooking.name ||
      pickString(tvOrder, ['name', 'clientname', 'touristname', 'fio']) ||
      'Клиент';

    const result = await submitRebookingLead({
      logPrefix: 'tourvisor-order-webhook',
      order: rebooking.order,
      cert: rebooking.cert,
      name,
      phone,
      people: rebooking.people,
      kids: rebooking.kids,
      kidAges: rebooking.kidAges,
      price: rebooking.price,
      nights: rebooking.nights,
      date: rebooking.date || undefined,
      tour,
      comment: clamp(tvOrder.comment, 2000) || undefined,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown';
    if (message === 'tourvisor_fetch_failed' || message === 'tourvisor_order_not_found') {
      return NextResponse.json({ ok: false, error: message }, { status: 502 });
    }
    const error = mapRebookingLeadError(message);
    const status = error === 'misconfigured' ? 500 : 502;
    return NextResponse.json({ ok: false, error }, { status });
  }
}
