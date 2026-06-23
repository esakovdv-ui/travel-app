// Расширенная карточка отеля (раздел 6 ТЗ) — описание + номера.
// Лимит 120 запросов/мин, в суточную поисковую квоту не входит.

import { tvFetch } from './client'
import type { HotelDescription, HotelRoom } from './types'

export function getHotelDescription(hotelId: string) {
  return tvFetch<HotelDescription>(`/hotels/${hotelId}`, {
    revalidate: 60 * 60 * 12, // 12 часов
  })
}

// Не более 30 id за запрос (ограничение Tourvisor) — вызывающая сторона режет на чанки.
export function getRooms(ids: number[]) {
  return tvFetch<HotelRoom[]>('/rooms', {
    params: { ids: ids.join(',') },
  })
}
