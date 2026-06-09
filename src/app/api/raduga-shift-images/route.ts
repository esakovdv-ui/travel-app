import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ADMIN_PASSWORD = process.env.RADUGA_ADMIN_PASSWORD ?? 'raduga2026';
const runtimeImagesDir = process.env.RADUGA_SHIFT_IMAGES_DIR ?? path.join(process.cwd(), 'storage/raduga-shift-images');
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

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
    .slice(0, 70) || 'raduga-shift';
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = String(formData.get('password') ?? '');
  const file = formData.get('file');
  const shiftId = slugify(String(formData.get('shiftId') ?? 'raduga-shift'));

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

  return NextResponse.json({ url: `/api/raduga-shift-images/${filename}` });
}
