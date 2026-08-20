// Простой in-memory лимитер попыток входа.
// Одного процесса Next.js хватает: портал живёт на одном pm2-инстансе.
// При переезде на несколько реплик — заменить на Redis.

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

const WINDOW_MS = 10 * 60 * 1000 // 10 минут
const MAX_ATTEMPTS = 10
const MAX_BUCKETS = 5000 // защита от разрастания при спуфинге IP

/** Достаём IP из заголовков прокси; при отсутствии — общий бакет. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) {
    const first = fwd.split(',')[0]?.trim()
    if (first) return first
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}

function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

/**
 * Считает неудачную попытку. Возвращает, исчерпан ли лимит,
 * и сколько секунд ждать до сброса окна.
 */
export function registerFailure(key: string): { limited: boolean; retryAfterSec: number } {
  const now = Date.now()
  if (buckets.size > MAX_BUCKETS) sweep(now)

  const existing = buckets.get(key)
  const bucket = existing && existing.resetAt > now
    ? existing
    : { count: 0, resetAt: now + WINDOW_MS }

  bucket.count += 1
  buckets.set(key, bucket)

  return {
    limited: bucket.count > MAX_ATTEMPTS,
    retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  }
}

/** Проверка без инкремента — вызывается до разбора тела запроса. */
export function isLimited(key: string): { limited: boolean; retryAfterSec: number } {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) return { limited: false, retryAfterSec: 0 }
  return {
    limited: bucket.count > MAX_ATTEMPTS,
    retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  }
}

/** Успешный вход снимает счётчик. */
export function clearFailures(key: string): void {
  buckets.delete(key)
}
