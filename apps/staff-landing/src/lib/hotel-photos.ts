'use client'

import { staffFetch } from '@/lib/staff-client'

/**
 * Фотографии отеля для галереи в карточке.
 *
 * В выдаче поиска приходит ровно одна ссылка (picturelink), а остальные живут
 * в отдельном запросе на отель — у типового отеля их два десятка. Шаблона у
 * ссылок нет: слаг отеля плюс произвольные номера («cimen-614100.jpg»),
 * вычислить их из id нельзя.
 *
 * Поэтому запрашиваем по требованию — когда человек начал листать, а не для
 * каждой карточки в списке. При сотне карточек упреждающая загрузка упёрлась
 * бы в лимит эндпоинта (120 запросов в минуту), а листают единицы. Ответ
 * сервер держит 12 часов, так что повторные просмотры бесплатны.
 */

const cache = new Map<number, string[]>()
const inFlight = new Map<number, Promise<string[]>>()

/** Уже загруженные — чтобы отрисовать точки без ожидания. */
export function cachedPhotos(hotelId: number): string[] | null {
  return cache.get(hotelId) ?? null
}

export function loadPhotos(hotelId: number): Promise<string[]> {
  const ready = cache.get(hotelId)
  if (ready) return Promise.resolve(ready)

  const running = inFlight.get(hotelId)
  if (running) return running

  const request = staffFetch(`/api/tourvisor/hotels/${hotelId}`)
    .then(r => (r.ok ? r.json() : null))
    .then((j): string[] => {
      const raw: unknown = j?.data?.images ?? j?.images
      const list = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
      // Ссылки приходят без схемы («//static.tourvisor.ru/…»).
      const urls = list.map(u => (u.startsWith('//') ? `https:${u}` : u))
      cache.set(hotelId, urls)
      return urls
    })
    .catch(() => {
      // Неудачу не кэшируем: следующая попытка сходит в сеть заново.
      return [] as string[]
    })
    .finally(() => { inFlight.delete(hotelId) })

  inFlight.set(hotelId, request)
  return request
}
