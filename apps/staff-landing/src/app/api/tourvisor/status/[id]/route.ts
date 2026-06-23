import { NextResponse } from 'next/server'
import { getSearchStatus } from '@/lib/tourvisor/search'
import { tourvisorErrorResponse } from '@/lib/tourvisor/errors'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const data = await getSearchStatus(id)
    // Tourvisor возвращает "complete" — фронт ждёт "done".
    if (data.status === 'complete') data.status = 'done'
    return NextResponse.json(data)
  } catch (e) {
    return tourvisorErrorResponse(e, 'status')
  }
}
