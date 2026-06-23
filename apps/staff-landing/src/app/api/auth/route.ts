import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { rejectDelay, verifyStaffCredential } from '@/lib/staff-access'
import { attachStaffSessionCookie, isStaffSessionValid, STAFF_SESSION_COOKIE } from '@/lib/staff-session'

function misconfigured() {
  return NextResponse.json({ ok: false }, { status: 503 })
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

  if (!verifyStaffCredential(credential)) {
    await rejectDelay()
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  return await attachStaffSessionCookie(NextResponse.json({ ok: true }))
}
