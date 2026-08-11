import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { appendAccessLog, normalizeCredential } from '@/lib/access-log'
import { rejectDelay, verifyStaffCredential } from '@/lib/staff-access'
import { attachStaffSessionCookie, isStaffSessionValid, STAFF_SESSION_COOKIE } from '@/lib/staff-session'

function misconfigured() {
  return NextResponse.json({ ok: false }, { status: 503 })
}

function clientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || null
  return req.headers.get('x-real-ip')
}

function clientUserAgent(req: Request): string | null {
  return req.headers.get('user-agent')
}

export async function GET() {
  if (!process.env.STAFF_SESSION_SECRET?.trim()) {
    return misconfigured()
  }
  const token = (await cookies()).get(STAFF_SESSION_COOKIE)?.value
  if (!(await isStaffSessionValid(token))) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}

export async function POST(req: Request) {
  if (!process.env.STAFF_SESSION_SECRET?.trim()) {
    return misconfigured()
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const credential = typeof body.password === 'string' ? body.password : ''
  const email = normalizeCredential(credential)
  const success = verifyStaffCredential(credential)

  try {
    await appendAccessLog({
      email,
      success,
      ip: clientIp(req),
      userAgent: clientUserAgent(req),
    })
  } catch {
    // Не блокируем вход, если лог не записался.
  }

  if (!success) {
    await rejectDelay()
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  return await attachStaffSessionCookie(NextResponse.json({ ok: true }))
}
