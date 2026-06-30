import { NextResponse } from 'next/server';
import {
  clamp,
  mapRebookingLeadError,
  normalizeLeadPhone,
  parseBookingPrice,
  parseKidAges,
  parseLeadUtm,
  parsePositiveInt,
  submitRebookingAnnulment,
} from '@/lib/bitrix-rebooking-lead';
import { markRebookingVisitSubmitted } from '@/lib/rebooking-visit-store';

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
  if (!order) {
    return NextResponse.json({ ok: false, error: 'missing_order' }, { status: 400 });
  }

  const rawPhone = clamp(body.phone, 30);
  const phone = rawPhone ? normalizeLeadPhone(rawPhone) : undefined;
  if (rawPhone && !phone) {
    return NextResponse.json({ ok: false, error: 'invalid_phone' }, { status: 400 });
  }

  const kids = parsePositiveInt(body.kids) ?? 0;
  const visitId = clamp(body.visitId, 80) || undefined;

  try {
    const result = await submitRebookingAnnulment({
      logPrefix: 'rebooking-annul',
      order,
      cert: clamp(body.cert, 100),
      name: clamp(body.name, 200) || 'Клиент',
      phone,
      email: clamp(body.email, 120) || undefined,
      comment: clamp(body.comment, 2000) || undefined,
      people: parsePositiveInt(body.people),
      kids,
      kidAges: parseKidAges(body, kids),
      price: parseBookingPrice(body.price),
      nights: parsePositiveInt(body.nights),
      date: clamp(body.date, 30) || undefined,
      utm: parseLeadUtm(body),
    });

    await markRebookingVisitSubmitted({
      visitId,
      order,
      phone,
      email: clamp(body.email, 120) || undefined,
      leadSource: 'direct',
      eventType: 'ANNUL_REQUEST',
      bitrixLeadId: result.itemId,
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      itemId: result.itemId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.error('rebooking-annul: failed', message);
    return NextResponse.json(
      { ok: false, error: mapRebookingLeadError(message) },
      { status: 502 }
    );
  }
}
