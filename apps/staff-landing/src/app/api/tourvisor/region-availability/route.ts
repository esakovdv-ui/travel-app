import { NextResponse } from 'next/server'
import { getObservation, MIN_SCANS_TO_RANK, recordObservation } from '@/lib/tourvisor/region-availability'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Курорты, которые действительно встречались в выдаче по стране и месяцу.
 *
 * Служит только порядку показа: курорты с подтверждёнными предложениями идут
 * первыми. Никого не скрываем — состав операторов меняется от поиска к
 * поиску, и отсутствие курорта в журнале не доказывает, что он пуст.
 *
 * Отдаём `known: false`, пока наблюдений мало: это честное «не знаем», и
 * клиент оставляет обычный порядок.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const countryId = Number(searchParams.get('countryId'))
  const dateFrom = searchParams.get('dateFrom') ?? ''

  if (!Number.isInteger(countryId) || countryId <= 0 || !DATE_RE.test(dateFrom)) {
    return NextResponse.json({ known: false, seen: [] })
  }

  const observation = await getObservation(countryId, dateFrom)
  if (!observation || observation.scans < MIN_SCANS_TO_RANK) {
    return NextResponse.json({ known: false, seen: [] })
  }

  return NextResponse.json({
    known: true,
    seen: observation.seen,
    scans: observation.scans,
    updatedAt: observation.updatedAt,
  })
}

/**
 * Записать итог завершившегося поиска: какие курорты пришли в выдаче.
 *
 * Пустой regionIds тоже пишем — он поднимает счётчик наблюдений, но ничего
 * не добавляет в seen, и это верно: поиск состоялся, курортов не принёс.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const countryId = Number(body.countryId)
  const dateFrom = typeof body.dateFrom === 'string' ? body.dateFrom : ''
  const regionIds = Array.isArray(body.regionIds)
    ? body.regionIds.filter((v): v is number => Number.isInteger(v) && v > 0)
    : []

  if (!Number.isInteger(countryId) || countryId <= 0 || !DATE_RE.test(dateFrom)) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  try {
    await recordObservation(countryId, dateFrom, regionIds)
  } catch {
    // Журнал — не критичный путь: поиск уже показан человеку.
    return NextResponse.json({ ok: false }, { status: 200 })
  }

  return NextResponse.json({ ok: true })
}
