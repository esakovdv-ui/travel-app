import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const runtimeImagesDir = process.env.VLASEVO_SHIFT_IMAGES_DIR ?? path.join(process.cwd(), 'storage/vlasevo-shift-images');
const fallbackImagesDir = path.join(process.cwd(), 'src/data/vlasevo-shift-images');

function safeFilename(value: string) {
  return path.basename(value).replace(/[^a-z0-9а-яё._-]/gi, '');
}

function contentTypeFor(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

export async function GET(_request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename: rawFilename } = await context.params;
  const filename = safeFilename(rawFilename);

  if (!filename) {
    return NextResponse.json({ error: 'Файл не найден.' }, { status: 404 });
  }

  let file: Buffer;
  try {
    file = await fs.readFile(path.join(runtimeImagesDir, filename));
  } catch {
    try {
      file = await fs.readFile(path.join(fallbackImagesDir, filename));
    } catch {
      return NextResponse.json({ error: 'Файл не найден.' }, { status: 404 });
    }
  }

  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': contentTypeFor(filename),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
