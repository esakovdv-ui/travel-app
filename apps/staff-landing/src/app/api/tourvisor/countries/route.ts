import { NextResponse } from 'next/server'
import { getCountries, DEFAULT_DEPARTURE_ID } from '@/lib/tourvisor/reference'
import { tourvisorErrorResponse } from '@/lib/tourvisor/errors'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const departureIdParam = searchParams.get('departureId')
  const departureId = departureIdParam ? Number(departureIdParam) : DEFAULT_DEPARTURE_ID

  try {
    const data = await getCountries(departureId)
    return NextResponse.json({ data })
  } catch (e) {
    return tourvisorErrorResponse(e, 'countries')
  }
}
