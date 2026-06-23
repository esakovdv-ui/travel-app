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
}

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

  const init: RequestInit & { next?: { revalidate: number } } = {
    headers: { Authorization: `Bearer ${token}` },
  }
  if (options.revalidate !== undefined) {
    init.next = { revalidate: options.revalidate }
  }

  let res: Response
  try {
    res = await fetch(url.toString(), init)
  } catch (e) {
    throw new TourvisorError(0, e instanceof Error ? e.message : 'network_error')
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new TourvisorError(res.status, body)
  }

  return res.json() as Promise<T>
}
