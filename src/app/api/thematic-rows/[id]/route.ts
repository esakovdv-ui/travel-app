import { NextRequest, NextResponse } from 'next/server';
import { readThematicRows, fetchRowHotels } from '@/lib/thematic-rows';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rows = readThematicRows();
  const config = rows.find(r => r.id === id && r.enabled);

  if (!config) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const hotels = await fetchRowHotels(config.id, config.search);
    return NextResponse.json({ hotels });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
