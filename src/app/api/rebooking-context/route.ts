import { NextResponse } from 'next/server';
import {
  parseRebookingContextFromBody,
  registerRebookingContext,
} from '@/lib/rebooking-context';

export const dynamic = 'force-dynamic';

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
  return NextResponse.json({ ok: true });
}
