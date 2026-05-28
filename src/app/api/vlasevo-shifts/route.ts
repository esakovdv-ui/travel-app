import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ADMIN_PASSWORD = process.env.VLASEVO_ADMIN_PASSWORD ?? 'vlasevo2026';
const fallbackShiftsPath = path.join(process.cwd(), 'src/data/vlasevo-shifts.json');
const runtimeShiftsPath = process.env.VLASEVO_SHIFTS_PATH ?? path.join(process.cwd(), 'storage/vlasevo-shifts.json');

const shiftSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  dates: z.string().min(1),
  duration: z.string().min(1),
  oldPrice: z.coerce.number().nonnegative(),
  price: z.coerce.number().nonnegative(),
  image: z.string().min(1),
  url: z.string().url(),
});

const payloadSchema = z.object({
  password: z.string(),
  shifts: z.array(shiftSchema),
});

async function readShifts() {
  let raw: string;
  try {
    raw = await fs.readFile(runtimeShiftsPath, 'utf8');
  } catch {
    raw = await fs.readFile(fallbackShiftsPath, 'utf8');
  }
  return z.array(shiftSchema).parse(JSON.parse(raw));
}

export async function GET() {
  const shifts = await readShifts();
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

  return NextResponse.json({ ok: true, shifts: parsed.data.shifts });
}
