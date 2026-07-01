import { NextResponse } from 'next/server';
import {
  clamp,
  normalizeLeadPhone,
  parseBookingPrice,
  parseKidAges,
  parseLeadUtm,
  parsePositiveInt,
  parseTourFromBody,
} from '@/lib/bitrix-rebooking-lead';
import { enqueueRebookingLead } from '@/lib/rebooking-lead-store';
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
  const name = clamp(body.name, 200);
  const cert = clamp(body.cert, 100);
  const phoneRaw = clamp(body.phone, 30);
  const sourcePhoneRaw = clamp(body.sourcePhone, 30);
  const tourPhone = phoneRaw ? normalizeLeadPhone(phoneRaw) : undefined;
  const sourcePhone = sourcePhoneRaw
    ? normalizeLeadPhone(sourcePhoneRaw) || undefined
    : undefined;
  const phone = tourPhone || sourcePhone;

  if (!order || !phone) {
    return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
  }

  const dealIdRaw = clamp(body.dealId, 40) || clamp(body.deal_id, 40) || clamp(body.deal, 40);
  const dealId = dealIdRaw ? dealIdRaw.replace(/\D/g, '') || undefined : undefined;

  const comment = clamp(body.comment, 2000);
  const destination = clamp(body.destination, 120);

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

  const visitId = clamp(body.visitId, 80) || undefined;
  const email = clamp(body.email, 120) || tour.email || undefined;
  const eventType = clamp(body.eventType, 40) || undefined;

  try {
    const { lead, duplicate } = await enqueueRebookingLead({
      visitId,
      order,
      cert,
      name: name || 'Клиент',
      phone,
      sourcePhone: sourcePhone || phone,
      email,
      dealId,
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
      captureSource: 'direct',
      tourvisorOrderId: tour.tourvisorOrderId,
      eventType,
    });

    await markRebookingVisitSubmitted({
      visitId,
      order,
      phone: sourcePhone || phone,
      email,
      tour,
      leadSource: 'direct',
      eventType: eventType || 'ORDERTOUR',
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      queued: true,
      leadId: lead.id,
      duplicate,
      bitrixPending: lead.bitrixStatus === 'pending',
    });
  } catch (e) {
    console.error('rebooking-lead: enqueue failed', e);
    return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 500 });
  }
}
