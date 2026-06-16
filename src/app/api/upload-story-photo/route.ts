import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'Файл не передан' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Недопустимый формат файла' }, { status: 415 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Файл слишком большой (макс. 10 МБ)' }, { status: 413 });
  }

  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const name = `${crypto.randomUUID()}.${ext}`;
  const dir = path.join(process.cwd(), 'public', 'uploads', 'stories');

  await mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, name), buffer);

  return NextResponse.json({ url: `/uploads/stories/${name}` });
}
