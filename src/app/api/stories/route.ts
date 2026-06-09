import { NextResponse } from 'next/server';
import { listStoriesPaginated } from '@/lib/repositories';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10));
  const limit  = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '8', 10)));
  const tag    = searchParams.get('tag') ?? undefined;

  const result = listStoriesPaginated({ offset, limit, tagSlug: tag || undefined });
  return NextResponse.json(result);
}
