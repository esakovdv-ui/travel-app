// Расширенная карточка отеля (раздел 6 ТЗ) — описание + номера.
// Лимит 120 запросов/мин, в суточную поисковую квоту не входит.

import { tvFetch } from './client'
import { decodeEntities, sanitizeHtml } from '../sanitize-html'
import type { HotelDescription, HotelRoom } from './types'

// Поля, которые фронт выводит через dangerouslySetInnerHTML. Чистим их здесь,
// на сервере, чтобы разметка третьей стороны не доезжала до браузера как есть.
const DESCRIPTION_HTML_FIELDS = [
  'description', 'place', 'territory', 'beach', 'list',
  'available', 'free', 'servicesPay', 'inRoom', 'child', 'animation',
] as const
const ROOM_HTML_FIELDS = ['description', 'comment', 'sleepingPlaces'] as const

type Dict = Record<string, unknown>

function cleanFields(obj: unknown, fields: readonly string[]): void {
  if (!obj || typeof obj !== 'object') return
  const target = obj as Dict
  for (const field of fields) {
    if (typeof target[field] === 'string') {
      target[field] = sanitizeHtml(target[field])
    }
  }
}

export async function getHotelDescription(hotelId: string): Promise<HotelDescription> {
  const data = await tvFetch<HotelDescription>(`/hotels/${hotelId}`, {
    revalidate: 60 * 60 * 12, // 12 часов
  })

  const dict = data as unknown as Dict
  cleanFields(dict.common, DESCRIPTION_HTML_FIELDS)
  cleanFields(dict.infrastructure, DESCRIPTION_HTML_FIELDS)
  cleanFields(dict.meals, DESCRIPTION_HTML_FIELDS)
  cleanFields(dict.services, DESCRIPTION_HTML_FIELDS)
  cleanFields(dict.rooms, DESCRIPTION_HTML_FIELDS)

  // Адрес приходит с сущностями («Atat&#252;rk Cad») и выводится как обычный
  // текст, поэтому его достаточно раскодировать.
  const common = dict.common as Dict | undefined
  if (common && typeof common.address === 'string') {
    common.address = decodeEntities(common.address)
  }

  return data
}

// Не более 30 id за запрос (ограничение Tourvisor) — вызывающая сторона режет на чанки.
export async function getRooms(ids: number[]): Promise<HotelRoom[]> {
  const rooms = await tvFetch<HotelRoom[]>('/rooms', {
    params: { ids: ids.join(',') },
  })
  if (Array.isArray(rooms)) {
    for (const room of rooms) cleanFields(room, ROOM_HTML_FIELDS)
  }
  return rooms
}
