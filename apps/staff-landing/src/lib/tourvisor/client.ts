// Низкоуровневый HTTP-клиент для tv-search-gateway (JWT).
// Документация: https://api.tourvisor.ru/search/docs

const TV_BASE = 'https://api.tourvisor.ru/search/api/v1'

export class TourvisorError extends Error {
  status: number
  body: string

  constructor(status: number, body: string) {
    super(`Tourvisor API error ${status}`)
    this.status = status
    this.body = body
  }
}

interface TvRequestOptions {
  params?: Record<string, string | number | boolean | undefined>
  /** Next.js fetch cache revalidate, секунды. Не передавать — без кэша. */
  revalidate?: number
  /** Таймаут одной попытки, мс. */
  timeoutMs?: number
  /** Сколько раз повторить при сетевой ошибке / таймауте / 5xx / 429. */
  retries?: number
}

const DEFAULT_TIMEOUT_MS = 12_000
const DEFAULT_RETRIES = 2

/** 5xx и 429 — временные, их имеет смысл повторить. Остальные 4xx — нет. */
function isRetriableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599)
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function tvFetch<T>(path: string, options: TvRequestOptions = {}): Promise<T> {
  const token = process.env.TOURVISOR_TOKEN

  if (!token) {
    // Намеренно не подставляем моки — раздел 0 ТЗ требует останова при отсутствии токена.
    throw new TourvisorError(401, 'TOURVISOR_TOKEN is not configured')
  }

  const url = new URL(`${TV_BASE}${path}`)
  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value))
      }
    }
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const retries   = options.retries ?? DEFAULT_RETRIES

  let lastError = new TourvisorError(0, 'not_attempted')

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(300 * attempt) // 300 мс, затем 600 мс

    const init: RequestInit & { next?: { revalidate: number } } = {
      headers: { Authorization: `Bearer ${token}` },
      // Без таймаута зависший Tourvisor держал бы роут Next.js бесконечно.
      signal: AbortSignal.timeout(timeoutMs),
    }
    if (options.revalidate !== undefined) {
      init.next = { revalidate: options.revalidate }
    }

    let res: Response
    try {
      res = await fetch(url.toString(), init)
    } catch (e) {
      const timedOut = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')
      lastError = new TourvisorError(
        timedOut ? 504 : 0,
        timedOut
          ? `timeout after ${timeoutMs}ms`
          : (e instanceof Error ? e.message : 'network_error'),
      )
      continue
    }

    if (res.ok) {
      // Минутный лимит — 300 запросов, отдаётся в заголовках. Суточной квоты
      // там нет, о ней узнаём только по 429, поэтому логируем хотя бы подход
      // к минутному потолку — иначе рост нагрузки заметить нечем.
      const remaining = Number(res.headers.get('x-ratelimit-remaining'))
      if (Number.isFinite(remaining) && remaining < 50) {
        console.warn(`[tourvisor] rate limit close: ${remaining} left, path=${path}`)
      }
      return res.json() as Promise<T>
    }

    const body = await res.text().catch(() => '')
    lastError = new TourvisorError(res.status, body)
    if (!isRetriableStatus(res.status)) break
  }

  throw lastError
}
