import { NextRequest, NextResponse } from 'next/server';
import { mapRebookingLeadError } from '@/lib/bitrix-rebooking-lead';
import {
  captureTourvisorOrderAsLead,
  fetchTourvisorOrderById,
  mapTourvisorOrderToTour,
  pickString,
} from '@/lib/tourvisor-rebooking';
import {
  markRebookingVisitSubmitted,
  trackRebookingWebhookCall,
} from '@/lib/rebooking-visit-store';
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
    const referer = pickString(tvOrder, ['referer', 'referrer', 'page', 'sourceurl', 'url']);
    const fromUrl = referer ? parseRebookingParamsFromUrl(referer) : null;

    const result = await captureTourvisorOrderAsLead({
      logPrefix: 'tourvisor-order-webhook',
      tvOrder,
      tourvisorOrderId: orderId,
      captureSource: 'webhook',
    });

    const webhookResult = result.skipped ? `skipped:${result.reason}` : 'lead_queued';
    await trackRebookingWebhookCall({
      tourvisorOrderId: orderId,
      type,
      result: webhookResult,
      order: fromUrl?.order ?? (result.skipped ? undefined : result.order),
    }).catch(() => {});

    if (result.skipped) {
      return NextResponse.json({ ok: true, skipped: true, reason: result.reason });
    }

    const tour = mapTourvisorOrderToTour(tvOrder);
    const order = result.order ?? fromUrl?.order;
    if (order) {
      await markRebookingVisitSubmitted({
        order,
        phone: pickString(tvOrder, ['phone', 'mobile', 'tel']),
        email: tour.email,
        tour,
        leadSource: 'webhook',
        eventType: 'webhook_queued',
      }).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      queued: true,
      leadId: result.leadId,
      bitrixPending: result.bitrixPending,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown';
    await trackRebookingWebhookCall({
      tourvisorOrderId: orderId,
      type,
      result: `error:${message}`,
    }).catch(() => {});

    if (message === 'tourvisor_fetch_failed' || message === 'tourvisor_order_not_found') {
      return NextResponse.json({ ok: false, error: message }, { status: 502 });
    }
    const error = mapRebookingLeadError(message);
    const status = error === 'misconfigured' ? 500 : message === 'invalid_phone' ? 422 : 502;
    return NextResponse.json({ ok: false, error }, { status });
  }
}
