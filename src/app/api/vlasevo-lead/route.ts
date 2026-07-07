import { NextResponse } from 'next/server';
import {
  clamp,
  mapCampLeadError,
  normalizeLeadPhone,
  parseBookingPrice,
  parseLeadUtm,
  syncCampLead,
  updateCampLead,
  type CampLeadQualification,
  type CampLanding,
} from '@/lib/bitrix-camp-lead';
import {
  findRecentDuplicateVlasevoLead,
  getVlasevoLeadById,
  saveVlasevoLead,
  updateVlasevoLeadBitrix,
  updateVlasevoLeadQualification,
  updateVlasevoLeadTopLevel,
  type VlasevoLead,
} from '@/lib/vlasevo-lead-store';

export const dynamic = 'force-dynamic';

const RESPONSE_BUDGET_MS = 5000;

function resolveLanding(body: Record<string, unknown>): CampLanding {
  const landing = clamp(body.landing, 30);
  if (landing === 'vlasevo-promo') return 'vlasevo-promo';
  return 'vlasevo';
}

function buildLeadQualificationPatch(
  existing: CampLeadQualification | undefined,
  lead: Pick<VlasevoLead, 'name' | 'phone'>
) {
  const patch: CampLeadQualification = {};
  if (!existing?.applicantFullName) patch.applicantFullName = lead.name;
  if (!existing?.contactPhone) patch.contactPhone = lead.phone;
  return patch;
}

async function syncExistingLeadToBitrix(lead: VlasevoLead) {
  const qualificationPatch = buildLeadQualificationPatch(lead.qualification, lead);
  const leadWithPatchedQualification =
    Object.keys(qualificationPatch).length > 0
      ? await updateVlasevoLeadQualification(lead.id, { qualification: qualificationPatch })
      : lead;
  const currentLead = leadWithPatchedQualification ?? lead;

  if (currentLead.bitrixDealId) {
    const result = await syncCampLead({
      logPrefix: 'vlasevo-lead-dedupe',
      dealId: currentLead.bitrixDealId,
      landing: currentLead.landing,
      name: currentLead.name,
      phone: currentLead.phone,
      shift: currentLead.shift,
      bookingPrice: currentLead.bookingPrice,
      source: currentLead.source,
      utm: currentLead.utm,
      qualification: currentLead.qualification,
    });
    const nextLead = await updateVlasevoLeadBitrix(currentLead.id, {
      bitrixStatus: 'sent',
      bitrixDealId: result.dealId,
      bitrixContactId: result.contactId ?? currentLead.bitrixContactId,
    });
    return { lead: nextLead ?? currentLead, bitrixResult: result, bitrixPending: false };
  }

  const result = await syncCampLead({
    logPrefix: 'vlasevo-lead-dedupe',
    landing: currentLead.landing,
    name: currentLead.name,
    phone: currentLead.phone,
    shift: currentLead.shift,
    bookingPrice: currentLead.bookingPrice,
    source: currentLead.source,
    utm: currentLead.utm,
    qualification: currentLead.qualification,
  });
  const nextLead = await updateVlasevoLeadBitrix(currentLead.id, {
    bitrixStatus: 'sent',
    bitrixDealId: result.dealId,
    bitrixContactId: result.contactId ?? undefined,
  });
  return { lead: nextLead ?? currentLead, bitrixResult: result, bitrixPending: false };
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

  const duplicateLead = await findRecentDuplicateVlasevoLead({ phone, shift });
  if (duplicateLead) {
    const mergedLead = await updateVlasevoLeadTopLevel(duplicateLead.id, {
      name,
      landing: landing === 'vlasevo-promo' ? 'vlasevo-promo' : 'vlasevo',
      bookingPrice,
      source,
      utm,
    });
    const reusedLead = mergedLead ?? duplicateLead;

    const syncMode = process.env.BITRIX_SYNC_MODE?.trim().toLowerCase();
    if (syncMode === 'relay') {
      return NextResponse.json({
        ok: true,
        saved: true,
        deduplicated: true,
        leadId: reusedLead.id,
        bitrixPending: reusedLead.bitrixStatus !== 'sent',
        bitrixSyncMode: 'relay',
      });
    }

    try {
      const outcome = await syncExistingLeadToBitrix(reusedLead);
      return NextResponse.json({
        ok: true,
        saved: true,
        deduplicated: true,
        leadId: outcome.lead.id,
        ...outcome.bitrixResult,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      const bitrixError = mapCampLeadError(message);
      await updateVlasevoLeadBitrix(reusedLead.id, {
        bitrixStatus: reusedLead.bitrixDealId ? 'sent' : 'failed',
        bitrixDealId: reusedLead.bitrixDealId,
        bitrixContactId: reusedLead.bitrixContactId,
        bitrixError,
      }).catch((updateError) => {
        console.error('vlasevo-lead: failed to mark duplicate lead sync failed', updateError);
      });
      return NextResponse.json({
        ok: true,
        saved: true,
        deduplicated: true,
        leadId: reusedLead.id,
        bitrixPending: true,
      });
    }
  }

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

  // The lead is already stored locally and visible in the admin panel, so we
  // never need to make the user wait on Bitrix. Attempt the Bitrix submission,
  // but only hold the HTTP response for up to RESPONSE_BUDGET_MS. If Bitrix is
  // slow/unreachable, we answer "success" immediately and let the submission
  // finish in the background, updating the lead status when it resolves.
  const submission = syncCampLead({
    logPrefix: 'vlasevo-lead',
    landing,
    name,
    phone,
    shift,
    bookingPrice,
    source,
    utm,
  })
    .then(async (result) => {
      await updateVlasevoLeadBitrix(savedLead.id, {
        bitrixStatus: 'sent',
        bitrixDealId: result.dealId,
        bitrixContactId: result.contactId ?? undefined,
      }).catch((updateError) => {
        console.error('vlasevo-lead: failed to mark lead sent', updateError);
      });
      const latestLead = await getVlasevoLeadById(savedLead.id).catch(() => null);
      if (latestLead?.qualification) {
        await updateCampLead({
          logPrefix: 'vlasevo-lead',
          dealId: result.dealId,
          landing,
          name: latestLead.name,
          phone: latestLead.phone,
          shift: latestLead.shift,
          bookingPrice: latestLead.bookingPrice,
          source: latestLead.source,
          utm: latestLead.utm,
          qualification: latestLead.qualification,
        }).catch((updateError) => {
          console.error('vlasevo-lead: failed to sync qualification after deal creation', updateError);
        });
      }
      return { status: 'sent' as const, result };
    })
    .catch(async (e) => {
      const message = e instanceof Error ? e.message : 'unknown';
      const error = mapCampLeadError(message);
      await updateVlasevoLeadBitrix(savedLead.id, {
        bitrixStatus: 'failed',
        bitrixError: error,
      }).catch((updateError) => {
        console.error('vlasevo-lead: failed to mark lead failed', updateError);
      });
      console.error('vlasevo-lead: Bitrix failed, lead saved locally', savedLead.id, message);
      return { status: 'failed' as const };
    });

  const timeoutMarker = Symbol('bitrix-timeout');
  const outcome = await Promise.race([
    submission,
    new Promise<typeof timeoutMarker>((resolve) => {
      setTimeout(() => resolve(timeoutMarker), RESPONSE_BUDGET_MS);
    }),
  ]);

  if (outcome !== timeoutMarker && outcome.status === 'sent') {
    return NextResponse.json({
      ok: true,
      saved: true,
      leadId: savedLead.id,
      ...outcome.result,
    });
  }

  // Timed out (submission keeps running in the background) or failed quickly.
  // Either way the lead is safely stored, so we report success to the user.
  return NextResponse.json({
    ok: true,
    saved: true,
    leadId: savedLead.id,
    bitrixPending: true,
  });
}
