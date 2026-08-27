import { NextResponse } from 'next/server';
import {
  clamp,
  mapPodborLeadError,
  normalizeLeadPhone,
  parseLeadUtm,
  parsePodborLeadAnswers,
  submitPodborLead,
} from '@/lib/bitrix-podbor-lead';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  // honeypot
  if (typeof body.website === 'string' && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true });
  }

  const name = clamp(body.name, 100);
  const rawPhone = clamp(body.phone, 30);
  if (!name || !rawPhone) {
    return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
  }

  const phone = normalizeLeadPhone(rawPhone);
  if (!phone) {
    return NextResponse.json({ ok: false, error: 'invalid_phone' }, { status: 400 });
  }

  if (body.consent !== true) {
    return NextResponse.json({ ok: false, error: 'consent_required' }, { status: 400 });
  }

  const sessionId = clamp(body.sessionId, 80) || undefined;
  const answers = parsePodborLeadAnswers(body.answers);
  const utm = parseLeadUtm(body.utm);

  try {
    const result = await submitPodborLead({
      logPrefix: 'podbor-lead',
      name,
      phone,
      answers,
      utm,
      sessionId,
    });
    return NextResponse.json({
      ok: true,
      dealId: result.dealId,
      duplicate: result.duplicate,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown';
    const error = mapPodborLeadError(message);
    const status = error === 'misconfigured' ? 500 : 502;
    return NextResponse.json({ ok: false, error }, { status });
  }
}
