'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { staffFetch, setStaffSessionToken } from './staff-client'

export type GuardState = 'checking' | 'ok' | 'denied'

/**
 * Клиентская проверка сессии для страниц вне middleware.
 *
 * Запрос идёт через staffFetch, поэтому уходит и кука, и Bearer-токен из
 * sessionStorage — второй работает даже там, где браузер режет третьесторонние
 * куки (портал внутри iframe на online.mosgortur.ru).
 */
export function useStaffGuard(): GuardState {
  const router = useRouter()
  const [state, setState] = useState<GuardState>('checking')

  useEffect(() => {
    let cancelled = false

    staffFetch('/api/auth')
      .then(async res => {
        if (cancelled) return
        if (!res.ok) {
          setState('denied')
          router.replace('/')
          return
        }
        // Сервер отдаёт актуальный токен — освежаем его в sessionStorage,
        // чтобы вкладка, открытая по прямой ссылке, тоже могла ходить в API.
        const data = await res.json().catch(() => ({}))
        if (typeof data.token === 'string') setStaffSessionToken(data.token)
        setState('ok')
      })
      .catch(() => {
        if (!cancelled) setState('denied')
      })

    return () => { cancelled = true }
  }, [router])

  return state
}
