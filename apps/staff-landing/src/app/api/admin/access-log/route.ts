import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { listAccessLogs } from '@/lib/access-log'
import { isAdminConfigured, readAdminSession } from '@/lib/admin-auth'

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
