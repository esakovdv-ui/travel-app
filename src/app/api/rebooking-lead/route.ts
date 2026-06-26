import { NextResponse } from 'next/server';
import {
  clamp,
  mapRebookingLeadError,
  normalizeLeadPhone,
  parseBookingPrice,
  parseKidAges,
  parseLeadUtm,
  parsePositiveInt,
  parseTourFromBody,
  submitRebookingLead,
} from '@/lib/bitrix-rebooking-lead';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  if (typeof body.website === 'string' && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true });
  }

  const order = clamp(body.order, 100);
  const name = clamp(body.name, 200);
  const cert = clamp(body.cert, 100);
  const rawPhone = clamp(body.phone, 30);
  const comment = clamp(body.comment, 2000);
  const destination = clamp(body.destination, 120);

  if (!order || !rawPhone) {
    return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
  }

  const phone = normalizeLeadPhone(rawPhone);
  if (!phone) {
    return NextResponse.json({ ok: false, error: 'invalid_phone' }, { status: 400 });
  }

  const tour =
    parseTourFromBody(body.tour) ||
    (destination ? { country: destination, hotel: 'Заявка через Tourvisor' } : undefined);
  if (!tour) {
    return NextResponse.json({ ok: false, error: 'missing_tour' }, { status: 400 });
  }

  const people = parsePositiveInt(body.people);
  const kids = parsePositiveInt(body.kids) ?? 0;
  const kidAges = parseKidAges(body, kids);
  const price = parseBookingPrice(body.price);
  const nights = parsePositiveInt(body.nights);
  const date = clamp(body.date, 30);

  try {
    const result = await submitRebookingLead({
      logPrefix: 'rebooking-lead',
      order,
      cert,
      name: name || 'Клиент',
      phone,
      comment,
      destination: destination || undefined,
      people,
      kids,
      kidAges,
      price,
      nights,
      date: date || undefined,
      tour,
      utm: parseLeadUtm(body.utm),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown';
    const error = mapRebookingLeadError(message);
    const status = error === 'misconfigured' ? 500 : 502;
    return NextResponse.json({ ok: false, error }, { status });
  }
}
