import { NextResponse } from 'next/server'
import { getRooms } from '@/lib/tourvisor/hotel'
import { tourvisorErrorResponse } from '@/lib/tourvisor/errors'

// Раздел 6.2 ТЗ — описания номеров, не более 30 id за запрос.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const idsParam = searchParams.get('ids') ?? ''
  const ids = idsParam
    .split(',')
    .map(s => Number(s.trim()))
    .filter(n => Number.isInteger(n) && n > 0)

  if (ids.length === 0) {
    return NextResponse.json([])
  }
  if (ids.length > 30) {
    return NextResponse.json({ error: 'too_many_ids' }, { status: 400 })
  }

  try {
    const data = await getRooms(ids)
    return NextResponse.json(data)
  } catch (e) {
    return tourvisorErrorResponse(e, 'rooms')
  }
}
