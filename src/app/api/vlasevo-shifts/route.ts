import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ADMIN_PASSWORD = process.env.VLASEVO_ADMIN_PASSWORD ?? 'vlasevo2026';
const fallbackShiftsPath = path.join(process.cwd(), 'src/data/vlasevo-shifts.json');
const runtimeShiftsPath = process.env.VLASEVO_SHIFTS_PATH ?? path.join(process.cwd(), 'storage/vlasevo-shifts.json');
const DEFAULT_PROMO_ACCENT_TEXT = 'Летние смены по специальной цене';
const DEBUG_ENDPOINT = 'http://127.0.0.1:7452/ingest/559fd227-ad27-4091-a3b1-b6f5ed56ddbf';
const DEBUG_SESSION_ID = '6bb749';

const shiftSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  dates: z.string().min(1),
  duration: z.string().min(1),
  oldPrice: z.coerce.number().nonnegative(),
  price: z.coerce.number().nonnegative(),
  image: z.string().min(1),
  url: z.string().url(),
  promoAccentText: z.string().optional().default(DEFAULT_PROMO_ACCENT_TEXT),
});

const payloadSchema = z.object({
  password: z.string(),
  shifts: z.array(shiftSchema),
});

function debugLog(payload: {
  runId: string;
  hypothesisId: string;
  location: string;
  message: string;
  data: Record<string, unknown>;
}) {
  fetch(DEBUG_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': DEBUG_SESSION_ID,
    },
    body: JSON.stringify({
      sessionId: DEBUG_SESSION_ID,
      ...payload,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}

async function readShifts() {
  let raw: string;
  let source: 'runtime' | 'fallback' = 'runtime';
  try {
    raw = await fs.readFile(runtimeShiftsPath, 'utf8');
  } catch {
    raw = await fs.readFile(fallbackShiftsPath, 'utf8');
    source = 'fallback';
  }
  return {
    shifts: z.array(shiftSchema).parse(JSON.parse(raw)),
    source,
  };
}

export async function GET() {
  const { shifts, source } = await readShifts();
  // #region agent log
  debugLog({
    runId: 'pre-fix',
    hypothesisId: 'H4',
    location: 'src/app/api/vlasevo-shifts/route.ts:GET',
    message: 'Serving shifts for admin/landing',
    data: { source, shiftsCount: shifts.length, sampleImage: shifts[0]?.image ?? null },
  });
  // #endregion
  return NextResponse.json(shifts, {
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

  await fs.mkdir(path.dirname(runtimeShiftsPath), { recursive: true });
  await fs.writeFile(runtimeShiftsPath, `${JSON.stringify(parsed.data.shifts, null, 2)}\n`, 'utf8');
  // #region agent log
  debugLog({
    runId: 'pre-fix',
    hypothesisId: 'H3',
    location: 'src/app/api/vlasevo-shifts/route.ts:POST',
    message: 'Persisted shifts payload to runtime storage',
    data: { shiftsCount: parsed.data.shifts.length, sampleImage: parsed.data.shifts[0]?.image ?? null },
  });
  // #endregion

  return NextResponse.json({ ok: true, shifts: parsed.data.shifts });
}
