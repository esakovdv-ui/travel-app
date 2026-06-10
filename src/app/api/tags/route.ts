import { NextResponse } from 'next/server';
import { listTags } from '@/lib/repositories';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const onlyWithStories = searchParams.get('withCount') === 'true';
  const tags = await listTags({ onlyWithStories });
  return NextResponse.json(tags);
}
