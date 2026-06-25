import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  bookingModeSchema,
  readVlasevoPromoStore,
  shiftSchema,
  writeVlasevoPromoStore,
} from '@/lib/vlasevo-promo-store';

export const dynamic = 'force-dynamic';

const ADMIN_PASSWORD = process.env.VLASEVO_PROMO_ADMIN_PASSWORD ?? 'vlasevo-promo2026';

const payloadSchema = z.object({
  password: z.string(),
  bookingMode: bookingModeSchema.optional(),
  shifts: z.array(shiftSchema),
});

export async function GET() {
  const store = await readVlasevoPromoStore();
  return NextResponse.json(store, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(request: Request) {
  const parsed = payloadSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: 'Проверьте заполнение смен.' }, { status: 400 });
  }

  if (parsed.data.password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Неверный пароль.' }, { status: 401 });
  }

  const store = await writeVlasevoPromoStore({
    bookingMode: parsed.data.bookingMode ?? 'direct',
    shifts: parsed.data.shifts,
  });

  return NextResponse.json({ ok: true, ...store });
}
