import { NextResponse } from 'next/server'
import { tvFetch } from '@/lib/tourvisor/client'
import { tourvisorErrorResponse } from '@/lib/tourvisor/errors'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ searchId: string }> }
) {
  const { searchId } = await params
  const { searchParams } = new URL(request.url)
  const tourId = searchParams.get('tourId')

  try {
    const data = await tvFetch<unknown>(`/tours/search/${searchId}/flights`, {
      params: tourId ? { tourId } : undefined,
    })
    console.log('[flights API]', searchId, tourId, JSON.stringify(data).slice(0, 600))
    return NextResponse.json(data)
  } catch (e) {
    console.log('[flights API error]', searchId, tourId, e)
    return tourvisorErrorResponse(e, 'flights')
  }
}
