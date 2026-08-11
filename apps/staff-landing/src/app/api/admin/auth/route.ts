import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  createAdminSessionToken,
  isAdminConfigured,
  readAdminSession,
  STAFF_ADMIN_COOKIE,
  verifyAdminPassword,
} from '@/lib/admin-auth'
import { listAccessLogs } from '@/lib/access-log'

export async function GET(request: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 503 })
  }
  if (!readAdminSession(request)) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const limit = Number(request.nextUrl.searchParams.get('limit') ?? '200')
  const entries = await listAccessLogs(limit)
  return NextResponse.json({ ok: true, entries })
}

export async function POST(req: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 503 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const password = typeof body.password === 'string' ? body.password : ''
  if (!verifyAdminPassword(password)) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const token = createAdminSessionToken()
  if (!token) {
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 503 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(STAFF_ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  })
  return res
}

export async function DELETE(request: NextRequest) {
  if (!readAdminSession(request)) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(STAFF_ADMIN_COOKIE)
  return res
}
