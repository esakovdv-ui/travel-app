import { timingSafeEqual } from 'crypto'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { NextRequest } from 'next/server'

export const STAFF_ADMIN_COOKIE = 'staff_admin'

function readPasswordFromEnvFile(): string | null {
  try {
    const raw = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
    const line = raw.split(/\r?\n/).find(l => l.startsWith('STAFF_ADMIN_PASSWORD='))
    if (!line) return null
    return line.slice('STAFF_ADMIN_PASSWORD='.length).trim().replace(/^['"]|['"]$/g, '') || null
  } catch {
    return null
  }
}

function adminPassword(): string | null {
  // Динамический доступ + файл — чтобы Next не «запекал» пустое значение на билде
  const fromEnv = process.env['STAFF_ADMIN_PASSWORD']?.trim()
  if (fromEnv) return fromEnv
  return readPasswordFromEnvFile()
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
