import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { rejectDelay, verifyStaffCredential } from '@/lib/staff-access'
import {
  attachStaffSessionCookie,
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

  if (!verifyStaffCredential(credential)) {
    await rejectDelay()
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const token = await issueStaffSessionToken()
  if (!token) return misconfigured()

  const res = NextResponse.json({ ok: true, token })
  return attachStaffSessionCookie(res, token)
}
