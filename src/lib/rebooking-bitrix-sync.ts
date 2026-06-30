import { mapRebookingLeadError, submitRebookingLead } from '@/lib/bitrix-rebooking-lead';
import {
  listPendingRebookingLeads,
  updateRebookingLeadBitrix,
  type RebookingQueuedLead,
} from '@/lib/rebooking-lead-store';
import { markRebookingVisitSubmitted } from '@/lib/rebooking-visit-store';

export type RebookingBitrixSyncResult = {
  processed: number;
  sent: number;
  failed: number;
  items: Array<{
    id: string;
    order: string;
    ok: boolean;
    leadId?: number;
    error?: string;
  }>;
};

async function syncOneLead(lead: RebookingQueuedLead) {
  const result = await submitRebookingLead({
    logPrefix: 'rebooking-bitrix-sync',
    order: lead.order,
    cert: lead.cert,
    name: lead.name,
    phone: lead.phone,
    sourcePhone: lead.sourcePhone || lead.phone,
    email: lead.email,
    comment: lead.comment,
    people: lead.people,
    kids: lead.kids,
    kidAges: lead.kidAges,
    price: lead.price,
    nights: lead.nights,
    date: lead.date,
    destination: lead.destination,
    tour: lead.tour,
    utm: lead.utm,
  });

  await updateRebookingLeadBitrix(lead.id, {
    bitrixStatus: 'sent',
    bitrixLeadId: result.leadId,
  });

  await markRebookingVisitSubmitted({
    visitId: lead.visitId,
    order: lead.order,
    phone: lead.sourcePhone || lead.phone,
    email: lead.email,
    tour: lead.tour,
    leadSource: lead.captureSource,
    bitrixLeadId: result.leadId,
    eventType: lead.eventType || 'bitrix_sync',
  }).catch(() => {});

  return result.leadId;
}

export async function syncPendingRebookingLeadsToBitrix(
  limit = 30
): Promise<RebookingBitrixSyncResult> {
  const pending = await listPendingRebookingLeads(limit);
  const items: RebookingBitrixSyncResult['items'] = [];
  let sent = 0;
  let failed = 0;

  for (const lead of pending) {
    try {
      const leadId = await syncOneLead(lead);
      sent += 1;
      items.push({ id: lead.id, order: lead.order, ok: true, leadId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      const mapped = mapRebookingLeadError(message);
      failed += 1;
      await updateRebookingLeadBitrix(lead.id, {
        bitrixStatus: 'failed',
        bitrixError: mapped,
      }).catch(() => {});
      items.push({ id: lead.id, order: lead.order, ok: false, error: mapped });
      console.error('rebooking-bitrix-sync: lead failed', lead.id, message);
    }
  }

  return { processed: pending.length, sent, failed, items };
}
