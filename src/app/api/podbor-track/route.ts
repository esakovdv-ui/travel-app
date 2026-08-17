import { NextResponse } from 'next/server';
import { z } from 'zod';
import { podborAnswersSchema, podborUtmSchema, trackPodborSession } from '@/lib/podbor-response-store';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  sessionId: z.string().min(8).max(80),
  type: z.enum(['start', 'step', 'handoff']),
  step: z.string().min(1).max(40).optional(),
  answers: podborAnswersSchema.optional(),
  embedded: z.boolean().optional(),
  utm: podborUtmSchema.optional(),
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

  const referer = request.headers.get('referer') ?? undefined;
  const userAgent = request.headers.get('user-agent') ?? undefined;

  const session = await trackPodborSession({
    ...parsed.data,
    referer,
    userAgent,
  });

  return NextResponse.json({ ok: true, sessionId: session.id, status: session.status });
}
