import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ADMIN_PASSWORD = process.env.VLASEVO_ADMIN_PASSWORD ?? 'vlasevo2026';
const runtimeImagesDir = process.env.VLASEVO_SHIFT_IMAGES_DIR ?? path.join(process.cwd(), 'storage/vlasevo-shift-images');
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DEBUG_ENDPOINT = 'http://127.0.0.1:7452/ingest/559fd227-ad27-4091-a3b1-b6f5ed56ddbf';
const DEBUG_SESSION_ID = '6bb749';

function extensionFor(type: string) {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'jpg';
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'vlasevo-shift';
}

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

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = String(formData.get('password') ?? '');
  const file = formData.get('file');
  const shiftId = slugify(String(formData.get('shiftId') ?? 'vlasevo-shift'));

  // #region agent log
  debugLog({
    runId: 'pre-fix',
    hypothesisId: 'H1',
    location: 'src/app/api/vlasevo-shift-images/route.ts:POST:entry',
    message: 'Upload endpoint received request',
    data: {
      passwordMatches: password === ADMIN_PASSWORD,
      hasFile: file instanceof File,
      fileType: file instanceof File ? file.type : null,
      fileSize: file instanceof File ? file.size : null,
      shiftId,
    },
  });
  // #endregion

  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Неверный пароль.' }, { status: 401 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Выберите файл изображения.' }, { status: 400 });
  }

  if (!allowedTypes.has(file.type)) {
    return NextResponse.json({ error: 'Можно загрузить JPG, PNG или WebP.' }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Файл должен быть не больше 5 МБ.' }, { status: 400 });
  }

  await fs.mkdir(runtimeImagesDir, { recursive: true });
  const filename = `${shiftId}-${Date.now()}.${extensionFor(file.type)}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(runtimeImagesDir, filename), buffer);

  // #region agent log
  debugLog({
    runId: 'pre-fix',
    hypothesisId: 'H4',
    location: 'src/app/api/vlasevo-shift-images/route.ts:POST:success',
    message: 'Upload endpoint stored file and returned URL',
    data: { filename, url: `/api/vlasevo-shift-images/${filename}` },
  });
  // #endregion

  return NextResponse.json({ url: `/api/vlasevo-shift-images/${filename}` });
}
