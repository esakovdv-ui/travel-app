import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { readStaffSession, STAFF_SESSION_COOKIE } from '@/lib/staff-session'

export async function middleware(request: NextRequest) {
  if (await readStaffSession(request)) {
    return NextResponse.next()
  }

  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const login = new URL('/', request.url)
  const res = NextResponse.redirect(login)
  res.cookies.delete(STAFF_SESSION_COOKIE)
  return res
}

export const config = {
  matcher: ['/tours/:path*', '/api/tourvisor/:path*', '/api/lead'],
}
