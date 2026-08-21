'use client'

import { staffFetch } from '@/lib/staff-client'

export interface RegionOption { id: number; name: string; countryId: number }

/**
 * Курорты стран, уже загруженные в этой вкладке.
 *
 * Запрос к нашему роуту занимает 0.3–0.5 секунды — достаточно, чтобы человек
 * увидел «Загружаем курорты…» вместо чипсов. Список курортов не меняется
 * месяцами, поэтому держим его в памяти вкладки: возврат к стране мгновенный.
 */
const cache = new Map<number, RegionOption[]>()

/** Запросы в полёте — чтобы наведение и клик не дёргали сеть дважды. */
const inFlight = new Map<number, Promise<RegionOption[]>>()

export function cachedRegions(countryId: number): RegionOption[] | null {
  return cache.get(countryId) ?? null
}

export function loadRegions(countryId: number): Promise<RegionOption[]> {
  if (!countryId) return Promise.resolve([])

  const ready = cache.get(countryId)
  if (ready) return Promise.resolve(ready)

  const running = inFlight.get(countryId)
  if (running) return running

  const request = staffFetch(`/api/tourvisor/regions?countryId=${countryId}`)
    .then(r => (r.ok ? r.json() : { data: [] }))
    .then(j => {
      const list: RegionOption[] = Array.isArray(j.data) ? j.data : []
      cache.set(countryId, list)
      return list
    })
    .catch(() => {
      // Не кэшируем неудачу: следующая попытка должна сходить в сеть заново.
      return [] as RegionOption[]
    })
    .finally(() => { inFlight.delete(countryId) })

  inFlight.set(countryId, request)
  return request
}

/** Тихо прогреть кэш — по наведению на страну или при открытии формы. */
export function prefetchRegions(countryId: number): void {
  if (!countryId || cache.has(countryId) || inFlight.has(countryId)) return
  void loadRegions(countryId)
}
