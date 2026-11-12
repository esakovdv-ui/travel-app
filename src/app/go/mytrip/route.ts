import { NextRequest, NextResponse } from 'next/server';
import { FIRST_TOUCH_COOKIE, mytripDestination } from '@/lib/mytrip-attribution';

export function GET(request: NextRequest) {
  const destination = mytripDestination(
    request.nextUrl.searchParams.get('to') ?? '',
    request.cookies.get(FIRST_TOUCH_COOKIE)?.value,
  );
  if (!destination) return new NextResponse('Invalid mytrip destination', { status: 400 });

  const response = NextResponse.redirect(destination, 302);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
