import { NextResponse } from 'next/server';
import {
  clamp,
  mapCampLeadError,
  normalizeLeadPhone,
  parseBookingPrice,
  parseLeadUtm,
  submitCampLead,
  type CampLanding,
} from '@/lib/bitrix-camp-lead';
import { saveVlasevoLead, updateVlasevoLeadBitrix } from '@/lib/vlasevo-lead-store';

export const dynamic = 'force-dynamic';

function resolveLanding(body: Record<string, unknown>): CampLanding {
  const landing = clamp(body.landing, 30);
  if (landing === 'vlasevo-promo') return 'vlasevo-promo';
  return 'vlasevo';
}

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

  const name = clamp(body.name, 100);
  const rawPhone = clamp(body.phone, 30);
  const shift = clamp(body.shift, 200);

  if (!name || !rawPhone || !shift) {
    return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
  }

  const phone = normalizeLeadPhone(rawPhone);
  if (!phone) {
    return NextResponse.json({ ok: false, error: 'invalid_phone' }, { status: 400 });
  }

  const landing = resolveLanding(body);
  const bookingPrice = parseBookingPrice(body.bookingPrice);
  const source = typeof body.source === 'string' ? body.source : undefined;
  const utm = parseLeadUtm(body.utm);

  let savedLead;
  try {
    savedLead = await saveVlasevoLead({
      name,
      phone,
      shift,
      landing,
      bookingPrice,
      source,
      utm,
    });
  } catch (error) {
    console.error('vlasevo-lead: local save failed', error);
    return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 500 });
  }

  const syncMode = process.env.BITRIX_SYNC_MODE?.trim().toLowerCase();
  if (syncMode === 'relay') {
    return NextResponse.json({
      ok: true,
      saved: true,
      leadId: savedLead.id,
      bitrixPending: true,
      bitrixSyncMode: 'relay',
    });
  }

  try {
    const result = await submitCampLead({
      logPrefix: 'vlasevo-lead',
      landing,
      name,
      phone,
      shift,
      bookingPrice,
      source,
      utm,
    });

    await updateVlasevoLeadBitrix(savedLead.id, {
      bitrixStatus: 'sent',
      bitrixDealId: result.dealId,
      bitrixContactId: result.contactId,
    });

    return NextResponse.json({
      ok: true,
      saved: true,
      leadId: savedLead.id,
      ...result,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown';
    const error = mapCampLeadError(message);

    await updateVlasevoLeadBitrix(savedLead.id, {
      bitrixStatus: 'failed',
      bitrixError: error,
    }).catch((updateError) => {
      console.error('vlasevo-lead: failed to update lead status', updateError);
    });

    console.error('vlasevo-lead: Bitrix failed, lead saved locally', savedLead.id, message);

    return NextResponse.json({
      ok: true,
      saved: true,
      leadId: savedLead.id,
      bitrixPending: true,
    });
  }
}
