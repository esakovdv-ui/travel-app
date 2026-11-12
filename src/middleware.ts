import { NextRequest, NextResponse } from 'next/server';
import { verifyJwtToken } from '@/lib/jwt';
import { SESSION_COOKIE, JWT_SECRET } from '@/lib/session';

import { captureFirstTouch, FIRST_TOUCH_COOKIE } from '@/lib/mytrip-attribution';

function withFirstTouch(request: NextRequest, response: NextResponse): NextResponse {
  if (
    request.method === 'GET' &&
    request.headers.get('accept')?.includes('text/html') &&
    !request.headers.get('purpose')?.includes('prefetch') &&
    !request.headers.get('sec-purpose')?.includes('prefetch') &&
    !request.cookies.has(FIRST_TOUCH_COOKIE)
  ) {
    response.cookies.set(FIRST_TOUCH_COOKIE, captureFirstTouch(request.nextUrl.searchParams), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    response.headers.set('Cache-Control', 'private, no-store');
  }
  return response;
}

const PROTECTED = ['/account'];

/**
 * Админки, закрытые Basic-авторизацией.
 *
 * До 08.10.2026 /admin и /podbor-admin отдавались вообще без проверки:
 * обзор, отзывы, истории, теги и подборки мог открыть кто угодно.
 * Матчер middleware покрывал только /account.
 *
 * Пароль берётся из ADMIN_PANEL_PASSWORD. Отдельная переменная, а не общий
 * ADMIN_PASSWORD: тот уже занят под лендинги «Радуга» и «Власьево».
 */
const ADMIN_AREAS = ['/admin', '/podbor-admin'];

function requireBasicAuth(request: NextRequest): NextResponse | null {
  const expected = process.env.ADMIN_PANEL_PASSWORD?.trim();

  // Пароль не задан — закрываемся, а не открываемся.
  if (!expected) {
    return new NextResponse('Админка не настроена: не задан ADMIN_PANEL_PASSWORD', {
      status: 503,
    });
  }

  const header = request.headers.get('authorization') ?? '';
  if (header.startsWith('Basic ')) {
    try {
      const decoded = atob(header.slice(6));
      // Логин не проверяем, он здесь не несёт смысла — важен только пароль.
      const password = decoded.slice(decoded.indexOf(':') + 1);
      if (password === expected) return null;
    } catch {
      // битый заголовок — просто просим ввести заново
    }
  }

  return new NextResponse('Требуется авторизация', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Admin", charset="UTF-8"' },
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdmin = ADMIN_AREAS.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (isAdmin) {
    const denied = requireBasicAuth(request);
    if (denied) return denied;
    return NextResponse.next();
  }

  const isProtected = PROTECTED.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (!isProtected) return withFirstTouch(request, NextResponse.next());

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return withFirstTouch(request, NextResponse.redirect(loginUrl));
  }

  const payload = await verifyJwtToken(token, JWT_SECRET);
  if (!payload) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(SESSION_COOKIE);
    return withFirstTouch(request, response);
  }

  return withFirstTouch(request, NextResponse.next());
}

export const config = {
  matcher: ['/account/:path*', '/admin/:path*', '/podbor-admin/:path*', '/((?!api/|_next/|go/mytrip|.*\\.(?!html$)[^/]+$).*)'],
};
