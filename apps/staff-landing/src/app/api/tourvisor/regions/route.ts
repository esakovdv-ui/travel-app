import { NextResponse } from 'next/server'
import { getRegions } from '@/lib/tourvisor/reference'
import { tourvisorErrorResponse } from '@/lib/tourvisor/errors'

/**
 * Курорты для поиска по regionIds.
 *
 * Без countryId отдаём справочник целиком — 676 курортов по 93 странам,
 * 35 КБ. Одним запросом дешевле, чем шестьюдесятью тремя по стране, и
 * позволяет заполнить кэш вкладки заранее: выбор страны становится
 * мгновенным для любой, а не только для заранее прогретых.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('countryId')

  let countryId: number | undefined
  if (raw !== null) {
    countryId = Number(raw)
    if (!Number.isInteger(countryId) || countryId <= 0) {
      return NextResponse.json(
        { error: 'invalid_params', details: [{ field: 'countryId', message: 'countryId должен быть положительным числом' }] },
        { status: 400 },
      )
    }
  }

  try {
    const data = await getRegions(countryId)
    return NextResponse.json({ data })
  } catch (e) {
    return tourvisorErrorResponse(e, 'regions')
  }
}
