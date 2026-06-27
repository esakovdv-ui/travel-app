import { NextResponse } from 'next/server';
import { z } from 'zod';
import { trackRebookingVisitEvent } from '@/lib/rebooking-visit-store';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  visitId: z.string().min(1).optional(),
  order: z.string().min(1),
  eventType: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  tour: z
    .object({
      hotel: z.string().optional(),
      country: z.string().optional(),
      region: z.string().optional(),
      tourvisorOrderId: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const visit = await trackRebookingVisitEvent(parsed.data);
  return NextResponse.json({ ok: true, visitId: visit?.id ?? null });
}
