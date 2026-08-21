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

/** Справочник целиком уже загружали — второй раз не ходим. */
let allLoaded: Promise<void> | null = null

/**
 * Прогреть курорты всех стран одним запросом.
 *
 * Справочник целиком — 676 курортов по 93 странам, 35 КБ, около полусекунды.
 * Дешевле, чем 63 запроса по стране, и снимает паузу для любой страны, а не
 * только для заранее выбранных. На сервере ответ живёт сутки, так что до
 * Tourvisor доходит один запрос в день на всех.
 */
export function prefetchAllRegions(): Promise<void> {
  if (allLoaded) return allLoaded

  allLoaded = staffFetch('/api/tourvisor/regions')
    .then(r => (r.ok ? r.json() : { data: [] }))
    .then(j => {
      const list: RegionOption[] = Array.isArray(j.data) ? j.data : []
      if (list.length === 0) return
      const byCountry = new Map<number, RegionOption[]>()
      for (const region of list) {
        const bucket = byCountry.get(region.countryId)
        if (bucket) bucket.push(region)
        else byCountry.set(region.countryId, [region])
      }
      // Не затираем то, что уже успели загрузить поштучно.
      for (const [countryId, regions] of byCountry) {
        if (!cache.has(countryId)) cache.set(countryId, regions)
      }
    })
    .catch(() => {
      // Разрешаем повторную попытку: справочник не критичен, но полезен.
      allLoaded = null
    })

  return allLoaded
}
