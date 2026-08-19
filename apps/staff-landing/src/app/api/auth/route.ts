import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { rejectDelay, verifyStaffCredential } from '@/lib/staff-access'
import { appendAccessLog, normalizeCredential } from '@/lib/access-log'
import { clientIp, clearFailures, isLimited, registerFailure } from '@/lib/rate-limit'
import {
  attachStaffSessionCookie,
  clearStaffSessionCookie,
  extractSessionTokenFromRequest,
  isStaffSessionValid,
  issueStaffSessionToken,
  STAFF_SESSION_COOKIE,
} from '@/lib/staff-session'

function misconfigured() {
  return NextResponse.json({ ok: false }, { status: 503 })
}

export async function GET(request: Request) {
  if (!process.env.STAFF_SESSION_SECRET?.trim()) {
    return misconfigured()
  }
  const cookieToken = (await cookies()).get(STAFF_SESSION_COOKIE)?.value
  const token = extractSessionTokenFromRequest(request, cookieToken)
  if (!(await isStaffSessionValid(token))) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  return NextResponse.json({ ok: true, token })
}

/** Выход: гасим куку. Токен из sessionStorage чистит клиент. */
export async function DELETE() {
  return clearStaffSessionCookie(NextResponse.json({ ok: true }))
}

export async function POST(req: Request) {
  if (!process.env.STAFF_SESSION_SECRET?.trim()) {
    return misconfigured()
  }

  const ip = clientIp(req)
  const pre = isLimited(ip)
  if (pre.limited) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(pre.retryAfterSec) } },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const credential = typeof body.password === 'string' ? body.password : ''

  // Журнал попыток входа — его показывает админка /admin.
  try {
    await appendAccessLog({
      email: normalizeCredential(credential),
      success: verifyStaffCredential(credential),
      ip: ip === 'unknown' ? null : ip,
      userAgent: req.headers.get('user-agent'),
    })
  } catch {
    // Не блокируем вход, если лог не записался.
  }

  if (!verifyStaffCredential(credential)) {
    const { limited, retryAfterSec } = registerFailure(ip)
    await rejectDelay()
    if (limited) {
      return NextResponse.json(
        { ok: false, error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
      )
    }
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const token = await issueStaffSessionToken()
  if (!token) return misconfigured()

  clearFailures(ip)
  const res = NextResponse.json({ ok: true, token })
  return attachStaffSessionCookie(res, token)
}
