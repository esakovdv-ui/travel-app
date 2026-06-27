import { NextResponse } from 'next/server';
import {
  parseRebookingContextFromBody,
  registerRebookingContext,
} from '@/lib/rebooking-context';
import { createRebookingVisit } from '@/lib/rebooking-visit-store';

export const dynamic = 'force-dynamic';

function parseUtmFromBody(body: Record<string, unknown>) {
  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
  const utm: Record<string, string> = {};
  keys.forEach((key) => {
    const value = body[key];
    if (typeof value === 'string' && value.trim()) utm[key] = value.trim();
  });
  return Object.keys(utm).length ? utm : undefined;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const context = parseRebookingContextFromBody(body);
  if (!context) {
    return NextResponse.json({ ok: false, error: 'missing_order' }, { status: 400 });
  }

  registerRebookingContext(context);

  const visit = await createRebookingVisit({
    ...context,
    utm: parseUtmFromBody(body),
    userAgent: request.headers.get('user-agent') ?? undefined,
    referer: request.headers.get('referer') ?? undefined,
  });

  return NextResponse.json({ ok: true, visitId: visit.id });
}
