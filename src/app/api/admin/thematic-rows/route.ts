import { revalidateTag } from 'next/cache';
import { readThematicRows, writeThematicRows } from '@/lib/thematic-rows';
import type { ThematicRowConfig } from '@/lib/thematic-rows';

export async function GET() {
  try {
    const rows = readThematicRows();
    return Response.json(rows);
  } catch {
    return Response.json({ error: 'Ошибка чтения конфигурации' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const rows: ThematicRowConfig[] = await request.json();
    writeThematicRows(rows);
    // Инвалидируем кэш чтобы главная страница пересчиталась
    revalidateTag('thematic-rows');
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Ошибка сохранения конфигурации' }, { status: 500 });
  }
}
