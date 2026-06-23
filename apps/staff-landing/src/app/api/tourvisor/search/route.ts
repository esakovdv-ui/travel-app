import { NextResponse } from 'next/server'
import { startSearch } from '@/lib/tourvisor/search'
import { validateSearchParams } from '@/lib/tourvisor/validate'
import { tourvisorErrorResponse } from '@/lib/tourvisor/errors'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const validation = validateSearchParams({
    countryId: searchParams.get('countryId'),
    dateFrom: searchParams.get('dateFrom'),
    dateTo: searchParams.get('dateTo'),
    nightsFrom: searchParams.get('nightsFrom'),
    nightsTo: searchParams.get('nightsTo'),
    adults: searchParams.get('adults'),
    childs: searchParams.get('childs'),
    hotelCategory: searchParams.get('hotelCategory'),
    hotelRating: searchParams.get('hotelRating'),
    priceFrom: searchParams.get('priceFrom'),
    priceTo: searchParams.get('priceTo'),
    onlyDirect: searchParams.get('onlyDirect'),
  })

  if (!validation.ok) {
    return NextResponse.json({ error: 'invalid_params', details: validation.errors }, { status: 400 })
  }

  try {
    const data = await startSearch(validation.value)
    return NextResponse.json(data)
  } catch (e) {
    return tourvisorErrorResponse(e, 'search')
  }
}
