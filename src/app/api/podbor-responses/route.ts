import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  isPodborAdminPassword,
  listPodborSessions,
  podborSessionsToTsv,
} from '@/lib/podbor-response-store';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  password: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['started', 'in_progress', 'completed', 'all']).optional().default('all'),
  format: z.enum(['json', 'tsv']).optional().default('json'),
  limit: z.coerce.number().int().min(1).max(10000).optional().default(5000),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    password: url.searchParams.get('password') ?? '',
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
    status: url.searchParams.get('status') ?? 'all',
    format: url.searchParams.get('format') ?? 'json',
    limit: url.searchParams.get('limit') ?? '5000',
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Неверный запрос.' }, { status: 400 });
  }

  if (!isPodborAdminPassword(parsed.data.password)) {
    return NextResponse.json({ error: 'Неверный пароль.' }, { status: 401 });
  }

  const sessions = await listPodborSessions({
    from: parsed.data.from,
    to: parsed.data.to,
    status: parsed.data.status,
    limit: parsed.data.limit,
  });

  if (parsed.data.format === 'tsv') {
    const tsv = podborSessionsToTsv(sessions);
    return new NextResponse(tsv, {
      headers: {
        'Content-Type': 'text/tab-separated-values; charset=utf-8',
        'Content-Disposition': 'attachment; filename="podbor-responses.tsv"',
        'Cache-Control': 'no-store',
      },
    });
  }

  return NextResponse.json(
    { ok: true, sessions, total: sessions.length },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
