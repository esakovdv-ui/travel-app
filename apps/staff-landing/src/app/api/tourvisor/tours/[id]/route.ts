import { NextResponse } from 'next/server'
import { getTourDetail } from '@/lib/tourvisor/search'
import { tourvisorErrorResponse } from '@/lib/tourvisor/errors'

// Раздел 5 ТЗ — актуальные данные тура в момент выбора (цена при поиске могла устареть).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const currency = searchParams.get('currency') ?? 'RUB'

  try {
    const data = await getTourDetail(id, currency)
    return NextResponse.json(data)
  } catch (e) {
    return tourvisorErrorResponse(e, 'tours')
  }
}
