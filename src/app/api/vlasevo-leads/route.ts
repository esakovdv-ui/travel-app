import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isVlasevoAdminPassword, listVlasevoLeads } from '@/lib/vlasevo-lead-store';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  password: z.string().min(1),
  landing: z.enum(['vlasevo', 'vlasevo-promo', 'all']).optional().default('all'),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(200),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    password: url.searchParams.get('password') ?? '',
    landing: url.searchParams.get('landing') ?? 'all',
    limit: url.searchParams.get('limit') ?? '200',
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Неверный запрос.' }, { status: 400 });
  }

  if (!isVlasevoAdminPassword(parsed.data.password)) {
    return NextResponse.json({ error: 'Неверный пароль.' }, { status: 401 });
  }

  const landingFilter =
    parsed.data.landing === 'all' ? undefined : parsed.data.landing;

  const leads = await listVlasevoLeads({
    landing: landingFilter,
    limit: parsed.data.limit,
  });

  return NextResponse.json(
    { ok: true, leads, total: leads.length },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
