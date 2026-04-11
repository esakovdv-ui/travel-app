import { NextResponse } from 'next/server';
import { readSearchTags, writeSearchTags, type SearchTag } from '@/lib/search-tags';
import { revalidateTag } from 'next/cache';

export async function GET() {
  try {
    const tags = readSearchTags();
    return NextResponse.json(tags);
  } catch {
    return NextResponse.json({ error: 'Не удалось прочитать теги' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const tags: SearchTag[] = await req.json();
    writeSearchTags(tags);
    revalidateTag('search-tags');
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Не удалось сохранить теги' }, { status: 500 });
  }
}
