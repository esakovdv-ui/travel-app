import { NextRequest, NextResponse } from 'next/server';
import { mapRebookingLeadError } from '@/lib/bitrix-rebooking-lead';
import {
  fetchTourvisorOrderById,
  mapTourvisorOrderToTour,
  submitTourvisorOrderToBitrix,
} from '@/lib/tourvisor-rebooking';
import { markRebookingVisitSubmitted } from '@/lib/rebooking-visit-store';
import { parseRebookingParamsFromUrl } from '@/lib/rebooking-context';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get('id')?.trim();
  const type = request.nextUrl.searchParams.get('type')?.trim() || '0';

  if (!orderId) {
    return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
  }

  try {
    const tvOrder = await fetchTourvisorOrderById(orderId, type);
    const result = await submitTourvisorOrderToBitrix({
      logPrefix: 'tourvisor-order-webhook',
      tvOrder,
      tourvisorOrderId: orderId,
    });

    if (result.skipped) {
      return NextResponse.json({ ok: true, skipped: true, reason: result.reason });
    }

    const tour = mapTourvisorOrderToTour(tvOrder);
    const referer = typeof tvOrder.referer === 'string'
      ? tvOrder.referer
      : typeof tvOrder.referrer === 'string'
        ? tvOrder.referrer
        : '';
    const fromUrl = referer ? parseRebookingParamsFromUrl(referer) : null;
    const order = fromUrl?.order;

    if (order) {
      await markRebookingVisitSubmitted({
        order,
        phone: typeof tvOrder.phone === 'string' ? tvOrder.phone : undefined,
        email: tour.email,
        tour,
        leadSource: 'webhook',
        bitrixLeadId: result.leadId,
        eventType: 'webhook',
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, leadId: result.leadId });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown';
    if (message === 'tourvisor_fetch_failed' || message === 'tourvisor_order_not_found') {
      return NextResponse.json({ ok: false, error: message }, { status: 502 });
    }
    const error = mapRebookingLeadError(message);
    const status = error === 'misconfigured' ? 500 : message === 'invalid_phone' ? 422 : 502;
    return NextResponse.json({ ok: false, error }, { status });
  }
}
