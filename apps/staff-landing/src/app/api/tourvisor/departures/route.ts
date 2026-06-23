import { NextResponse } from 'next/server'
import { getDepartures } from '@/lib/tourvisor/reference'
import { tourvisorErrorResponse } from '@/lib/tourvisor/errors'

export async function GET() {
  try {
    const data = await getDepartures()
    return NextResponse.json({ data })
  } catch (e) {
    return tourvisorErrorResponse(e, 'departures')
  }
}
