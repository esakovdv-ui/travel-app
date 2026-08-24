'use client'

import { staffFetch } from '@/lib/staff-client'

/**
 * Порядок курортов по наблюдённым предложениям.
 *
 * Сервер знает, какие курорты реально приходили в выдаче по стране и месяцу
 * заезда (см. lib/tourvisor/region-availability.ts). Мы поднимаем их наверх,
 * чтобы человек не тыкал наугад в курорт, где на его даты пусто.
 *
 * Никого не скрываем. Состав операторов у Tourvisor меняется от поиска к
 * поиску — замер по России дал 12 курортов в одном прогоне и 9 в другом,
 * более полном, — поэтому отсутствие курорта в журнале не доказывает, что он
 * пуст. Порядок подсказывает, но не отнимает выбор.
 */

export interface Availability {
  /** Наблюдений достаточно, чтобы менять порядок. */
  known: boolean
  /** id курортов, по которым предложения точно были. */
  seen: Set<number>
}

const UNKNOWN: Availability = { known: false, seen: new Set() }

const cache = new Map<string, Availability>()
const inFlight = new Map<string, Promise<Availability>>()

function key(countryId: number, dateFrom: string): string {
  return `${countryId}:${dateFrom.slice(0, 7)}`
}

export function cachedAvailability(countryId: number, dateFrom: string): Availability | null {
  if (!countryId || !dateFrom) return null
  return cache.get(key(countryId, dateFrom)) ?? null
}

export function loadAvailability(countryId: number, dateFrom: string): Promise<Availability> {
  if (!countryId || !dateFrom) return Promise.resolve(UNKNOWN)

  const k = key(countryId, dateFrom)
  const ready = cache.get(k)
  if (ready) return Promise.resolve(ready)

  const running = inFlight.get(k)
  if (running) return running

  const request = staffFetch(
    `/api/tourvisor/region-availability?countryId=${countryId}&dateFrom=${encodeURIComponent(dateFrom)}`,
  )
    .then(r => (r.ok ? r.json() : null))
    .then((j): Availability => {
      if (!j?.known || !Array.isArray(j.seen)) return UNKNOWN
      const value = { known: true, seen: new Set<number>(j.seen) }
      cache.set(k, value)
      return value
    })
    // Журнал — подсказка, а не условие работы: без него просто обычный порядок.
    .catch(() => UNKNOWN)
    .finally(() => { inFlight.delete(k) })

  inFlight.set(k, request)
  return request
}

/** Сообщить журналу, какие курорты вернул завершившийся поиск. */
export function reportSeenRegions(
  countryId: number,
  dateFrom: string,
  regionIds: number[],
): void {
  if (!countryId || !dateFrom) return

  // Свежая запись делает кэш вкладки устаревшим — иначе форма поиска будет
  // показывать порядок, снятый до этого же поиска.
  cache.delete(key(countryId, dateFrom))

  void staffFetch('/api/tourvisor/region-availability', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ countryId, dateFrom, regionIds }),
  }).catch(() => {
    // Не мешаем человеку смотреть выдачу из-за неудачной записи в журнал.
  })
}
