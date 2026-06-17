import { NextResponse } from 'next/server';
import {
  clamp,
  mapCampLeadError,
  normalizeLeadPhone,
  parseLeadUtm,
  submitCampLead,
} from '@/lib/bitrix-camp-lead';

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

  try {
    const result = await submitCampLead({
      logPrefix: 'raduga-lead',
      landing: 'raduga',
      name,
      phone,
      shift,
      source: typeof body.source === 'string' ? body.source : undefined,
      utm: parseLeadUtm(body.utm),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown';
    const error = mapCampLeadError(message);
    const status = error === 'misconfigured' ? 500 : 502;
    return NextResponse.json({ ok: false, error }, { status });
  }
}
