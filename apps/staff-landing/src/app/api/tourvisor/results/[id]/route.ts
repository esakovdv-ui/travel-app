import { NextResponse } from 'next/server'
import { getSearchResults } from '@/lib/tourvisor/search'
import { tourvisorErrorResponse } from '@/lib/tourvisor/errors'

// Туроператоры, с которыми работает Мосгортур
const ALLOWED_OPERATOR_IDS = new Set([
  11,  // Coral Travel
  12,  // Pegas Touristik
  13,  // Anex Tour
  16,  // Sunmar
  18,  // Библио Глобус
  25,  // FUN&SUN (TUI)
  31,  // Алеан
  36,  // PAC GROUP
  41,  // Дельфин
  43,  // Интурист
  79,  // Мультитур
  161, // OneTouch & Travel
  173, // Островок
  193, // Русские сезоны
])

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? Number(limitParam) : 25

  try {
    const data = await getSearchResults(id, limit)

    // Оставляем только туры от разрешённых ТО, убираем отели без туров
    const filtered = data
      .map(hotel => ({
        ...hotel,
        tours: hotel.tours.filter(t => ALLOWED_OPERATOR_IDS.has(t.operator.id)),
      }))
      .filter(hotel => hotel.tours.length > 0)
      .map(hotel => ({ ...hotel, price: hotel.tours[0].price }))

    return NextResponse.json(filtered)
  } catch (e) {
    return tourvisorErrorResponse(e, 'results')
  }
}
