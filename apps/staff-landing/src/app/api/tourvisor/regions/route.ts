import { NextResponse } from 'next/server'
import { getRegions } from '@/lib/tourvisor/reference'
import { tourvisorErrorResponse } from '@/lib/tourvisor/errors'

/** Курорты выбранной страны — для поиска по regionIds. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const countryId = Number(searchParams.get('countryId'))

  if (!Number.isInteger(countryId) || countryId <= 0) {
    return NextResponse.json(
      { error: 'invalid_params', details: [{ field: 'countryId', message: 'countryId обязателен' }] },
      { status: 400 },
    )
  }

  try {
    const data = await getRegions(countryId)
    return NextResponse.json({ data })
  } catch (e) {
    return tourvisorErrorResponse(e, 'regions')
  }
}
