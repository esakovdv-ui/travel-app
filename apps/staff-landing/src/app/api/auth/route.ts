import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 })
  }

  const password = typeof body.password === 'string' ? body.password : ''
  const expected = process.env.STAFF_PASSWORD

  if (!expected) {
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 500 })
  }

  if (password !== expected) {
    return NextResponse.json({ ok: false, error: 'wrong_password' }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}
