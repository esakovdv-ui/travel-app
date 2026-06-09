import { NextResponse } from 'next/server';
import { updateTagLabel } from '@/lib/repositories';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const label = String(body.label ?? '').trim();

  if (!label || label.length > 40) {
    return NextResponse.json({ error: 'Некорректное название тега (не пустое, до 40 символов)' }, { status: 400 });
  }

  const tag = updateTagLabel(id, label);
  if (!tag) {
    return NextResponse.json({ error: 'Тег не найден' }, { status: 404 });
  }
  return NextResponse.json(tag);
}
