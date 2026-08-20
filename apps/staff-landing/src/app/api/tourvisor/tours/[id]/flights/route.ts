import { NextResponse } from 'next/server'
import { tvFetch } from '@/lib/tourvisor/client'
import { tourvisorErrorResponse } from '@/lib/tourvisor/errors'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const data = await tvFetch<unknown>(`/tours/${id}/flights`, {
      params: { currency: 'RUB' },
    })
    return NextResponse.json(data)
  } catch (e) {
    return tourvisorErrorResponse(e, 'tour-flights')
  }
}
