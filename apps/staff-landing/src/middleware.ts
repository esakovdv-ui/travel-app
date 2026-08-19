import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { readStaffSession } from '@/lib/staff-session'

export async function middleware(request: NextRequest) {
  if (await readStaffSession(request)) {
    return NextResponse.next()
  }
  return NextResponse.json({ ok: false }, { status: 401 })
}

// Только API. Страницу /tours намеренно НЕ охраняем здесь.
//
// Портал открывается в iframe на online.mosgortur.ru, а кука сессии для этого
// контекста — третьесторонняя (SameSite=None). Safari и Firefox блокируют такие
// куки по умолчанию. Навигация на /tours — обычный переход, заголовок
// Authorization к нему не подставить, поэтому middleware не увидел бы сессию
// и вернул сотрудника на форму входа: получался бесконечный круг.
//
// Теперь доступ к данным закрыт там, где он и должен быть, — на /api/*, куда
// staffFetch кладёт Bearer-токен из sessionStorage. Сама страница /tours
// секретов не содержит и проверяет сессию на клиенте (см. useStaffGuard).
export const config = {
  matcher: ['/api/tourvisor/:path*', '/api/lead'],
}
