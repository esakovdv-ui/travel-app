import { timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

export const STAFF_ADMIN_COOKIE = 'staff_admin'

function adminPassword(): string | null {
  const value = process.env.STAFF_ADMIN_PASSWORD?.trim()
  return value || null
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function isAdminConfigured(): boolean {
  return Boolean(adminPassword())
}

export function verifyAdminPassword(password: string): boolean {
  const expected = adminPassword()
  if (!expected) return false
  return safeEqual(password, expected)
}

export function readAdminSession(request: NextRequest): boolean {
  const token = request.cookies.get(STAFF_ADMIN_COOKIE)?.value
  const expected = adminPassword()
  if (!token || !expected) return false
  return safeEqual(token, expected)
}

export function createAdminSessionToken(): string | null {
  return adminPassword()
}
