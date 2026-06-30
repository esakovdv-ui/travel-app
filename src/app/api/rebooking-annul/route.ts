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
import { recordRebookingAnnul } from '@/lib/rebooking-annul-store';
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
  const rawSourcePhone = clamp(body.sourcePhone, 30) || rawPhone;
  const sourcePhone = rawSourcePhone ? normalizeLeadPhone(rawSourcePhone) : undefined;
  const tourPhone = rawPhone && rawPhone !== rawSourcePhone ? normalizeLeadPhone(rawPhone) : undefined;
  if (rawSourcePhone && !sourcePhone) {
    return NextResponse.json({ ok: false, error: 'invalid_phone' }, { status: 400 });
  }

  const kids = parsePositiveInt(body.kids) ?? 0;
  const visitId = clamp(body.visitId, 80) || undefined;
  const annulInput = {
    order,
    cert: clamp(body.cert, 100),
    name: clamp(body.name, 200) || 'Клиент',
    sourcePhone,
    phone: tourPhone,
    email: clamp(body.email, 120) || undefined,
    comment: clamp(body.comment, 2000) || undefined,
    people: parsePositiveInt(body.people),
    kids,
    kidAges: parseKidAges(body, kids),
    price: parseBookingPrice(body.price),
    nights: parsePositiveInt(body.nights),
    date: clamp(body.date, 30) || undefined,
    utm: parseLeadUtm(body),
  };

  try {
    const result = await submitRebookingAnnulment({
      logPrefix: 'rebooking-annul',
      ...annulInput,
    });

    const { record, duplicate } = await recordRebookingAnnul({
      visitId,
      ...annulInput,
      phone: sourcePhone,
      bitrixStatus: 'sent',
      bitrixItemId: result.itemId,
    });

    await markRebookingVisitSubmitted({
      visitId,
      order,
      phone: sourcePhone,
      email: annulInput.email,
      leadSource: 'direct',
      eventType: 'ANNUL_REQUEST',
      bitrixLeadId: result.itemId,
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      itemId: result.itemId,
      recordId: record.id,
      duplicate,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.error('rebooking-annul: failed', message);

    await recordRebookingAnnul({
      visitId,
      ...annulInput,
      phone: sourcePhone,
      bitrixStatus: 'failed',
      bitrixError: mapRebookingLeadError(message),
    }).catch(() => {});

    return NextResponse.json(
      { ok: false, error: mapRebookingLeadError(message) },
      { status: 502 }
    );
  }
}
