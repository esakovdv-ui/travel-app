import { timingSafeEqual } from 'crypto'

const DEFAULT_DOMAIN = 'culture.mos.ru'
const LOCAL_PART_RE = /^[a-z0-9._%+-]+$/

function domainsMatch(actual: string, expected: string): boolean {
  const a = Buffer.from(actual)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Проверка корпоративного доступа — только на сервере. */
export function verifyStaffCredential(credential: string): boolean {
  const value = credential.trim().toLowerCase()
  const at = value.lastIndexOf('@')
  if (at < 1 || at >= value.length - 1) return false

  const local = value.slice(0, at)
  const domain = value.slice(at + 1)
  if (!local || local.length > 64 || !LOCAL_PART_RE.test(local)) return false

  const allowed = (process.env.STAFF_EMAIL_DOMAIN ?? DEFAULT_DOMAIN).trim().toLowerCase()
  if (!allowed) return false

  return domainsMatch(domain, allowed)
}

export async function rejectDelay(): Promise<void> {
  const ms = 180 + Math.floor(Math.random() * 220)
  await new Promise(resolve => setTimeout(resolve, ms))
}
