import { NextResponse } from 'next/server'
import { continueSearch } from '@/lib/tourvisor/search'
import { tourvisorErrorResponse } from '@/lib/tourvisor/errors'

// Расширяет выборку ~+50%. Вызывается фронтом один раз после первого progress=100.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const data = await continueSearch(id)
    return NextResponse.json(data)
  } catch (e) {
    return tourvisorErrorResponse(e, 'continue')
  }
}
