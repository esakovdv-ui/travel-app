import type { NextRequest, NextResponse } from 'next/server'

export const STAFF_SESSION_COOKIE = 'staff_session'
const SESSION_TTL_SEC = 60 * 60 * 24 * 30 // 30 дней

type SessionPayload = {
  v: 1
  exp: number
}

const encoder = new TextEncoder()

function sessionSecret(): string | null {
  const secret = process.env.STAFF_SESSION_SECRET?.trim()
  return secret && secret.length >= 16 ? secret : null
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

async function hmacSign(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  return Buffer.from(sig).toString('base64url')
}

async function createSessionToken(): Promise<string | null> {
  const secret = sessionSecret()
  if (!secret) return null
  const body = Buffer.from(JSON.stringify({
    v: 1,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC,
  } satisfies SessionPayload)).toString('base64url')
  const sig = await hmacSign(body, secret)
  return `${body}.${sig}`
}

async function verifySessionToken(token: string): Promise<boolean> {
  const secret = sessionSecret()
  if (!secret) return false

  const dot = token.lastIndexOf('.')
  if (dot <= 0) return false

  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = await hmacSign(body, secret)

  if (!bytesEqual(Buffer.from(sig, 'utf8'), Buffer.from(expected, 'utf8'))) {
    return false
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload
    if (payload.v !== 1 || typeof payload.exp !== 'number') return false
    return payload.exp > Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}

export async function isStaffSessionValid(token: string | undefined | null): Promise<boolean> {
  if (!token) return false
  return verifySessionToken(token)
}

export async function attachStaffSessionCookie(res: NextResponse): Promise<NextResponse> {
  const token = await createSessionToken()
  if (!token) return res

  res.cookies.set(STAFF_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SEC,
  })
  return res
}

export async function readStaffSession(request: NextRequest): Promise<boolean> {
  return isStaffSessionValid(request.cookies.get(STAFF_SESSION_COOKIE)?.value)
}
