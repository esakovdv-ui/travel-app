import { NextResponse } from 'next/server';
import { clamp, mapRebookingLeadError } from '@/lib/bitrix-rebooking-lead';
import {
  getRebookingContextByOrder,
  parseRebookingContextFromBody,
  registerRebookingContext,
} from '@/lib/rebooking-context';
import { syncRecentTourvisorOrderToBitrix } from '@/lib/tourvisor-rebooking';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const parsed = parseRebookingContextFromBody(body);
  if (!parsed) {
    return NextResponse.json({ ok: false, error: 'missing_order' }, { status: 400 });
  }

  registerRebookingContext(parsed);
  const rebooking = getRebookingContextByOrder(parsed.order) ?? { ...parsed, registeredAt: Date.now() };
  const eventType = clamp(body.eventType, 40) || undefined;

  try {
    const result = await syncRecentTourvisorOrderToBitrix({
      logPrefix: 'rebooking-lead-sync',
      rebooking,
      eventType,
      maxAgeSeconds: 180,
    });

    if (result.skipped) {
      return NextResponse.json({ ok: true, skipped: true, reason: result.reason });
    }

    return NextResponse.json({ ok: true, leadId: result.leadId });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown';
    if (message === 'tourvisor_order_not_found') {
      return NextResponse.json({ ok: false, error: 'order_not_ready' }, { status: 202 });
    }
    const error = mapRebookingLeadError(message);
    const status =
      error === 'misconfigured' ? 500 : message === 'invalid_phone' ? 422 : 502;
    return NextResponse.json({ ok: false, error }, { status });
  }
}
