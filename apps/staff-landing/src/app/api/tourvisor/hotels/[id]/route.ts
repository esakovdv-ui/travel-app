import { NextResponse } from 'next/server'
import { getHotelDescription } from '@/lib/tourvisor/hotel'
import { tourvisorErrorResponse } from '@/lib/tourvisor/errors'

// Раздел 6.1 ТЗ — расширенная карточка отеля, подгружается лениво по клику «Подробнее».
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const data = await getHotelDescription(id)
    return NextResponse.json(data)
  } catch (e) {
    return tourvisorErrorResponse(e, 'hotels')
  }
}
