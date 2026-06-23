// Маппинг ошибок Tourvisor → HTTP-ответы наружу (раздел 9 ТЗ).
// Тело ответа Tourvisor никогда не светим наружу — только лог на сервере.

import { NextResponse } from 'next/server'
import { TourvisorError } from './client'

export function tourvisorErrorResponse(e: unknown, context: string): NextResponse {
  if (e instanceof TourvisorError) {
    console.error(`tourvisor:${context}`, e.status, e.body)

    if (e.status === 401) {
      // Невалидный/отсутствующий токен — generic-сообщение фронту.
      return NextResponse.json({ error: 'service_unavailable' }, { status: 502 })
    }
    if (e.status === 403) {
      // Раздел API не активирован тарифом — фронт скрывает расширенную карточку.
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    if (e.status === 429) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }
    if (e.status === 404) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'tv_error' }, { status: 502 })
  }

  console.error(`tourvisor:${context}`, e)
  return NextResponse.json({ error: 'fetch_error' }, { status: 502 })
}
