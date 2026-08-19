const LOCAL_PART_RE = /^[a-z0-9._%+-]+$/

/**
 * Базовый домен рабочей почты. Пускаем сам домен и любой его поддомен:
 * mos.ru, culture.mos.ru, dept.mos.ru — да; notmos.ru, mos.ru.evil.com — нет.
 *
 * Раньше здесь было жёсткое равенство с culture.mos.ru, из-за чего
 * сотрудники с других адресов на mos.ru войти не могли.
 */
const DEFAULT_DOMAIN = 'mos.ru'

function isAllowedDomain(domain: string, base: string): boolean {
  if (domain === base) return true
  return domain.endsWith('.' + base)
}

/** Проверка корпоративного доступа — только на сервере. */
export function verifyStaffCredential(credential: string): boolean {
  const value = credential.trim().toLowerCase()
  const at = value.lastIndexOf('@')
  if (at < 1 || at >= value.length - 1) return false

  const local = value.slice(0, at)
  const domain = value.slice(at + 1)
  if (!local || local.length > 64 || !LOCAL_PART_RE.test(local)) return false

  // Домен не должен содержать пробелов и лишних точек по краям.
  if (!/^[a-z0-9.-]+$/.test(domain) || domain.startsWith('.') || domain.endsWith('.')) {
    return false
  }

  const base = (process.env.STAFF_EMAIL_DOMAIN ?? DEFAULT_DOMAIN).trim().toLowerCase()
  if (!base) return false

  return isAllowedDomain(domain, base)
}

export async function rejectDelay(): Promise<void> {
  const ms = 180 + Math.floor(Math.random() * 220)
  await new Promise(resolve => setTimeout(resolve, ms))
}
