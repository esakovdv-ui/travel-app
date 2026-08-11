'use client'

/** Счётчик Метрики (тот же, что на motrip / лендингах). Переопределение: NEXT_PUBLIC_YM_COUNTER_ID */
export const YM_COUNTER_ID = Number(process.env.NEXT_PUBLIC_YM_COUNTER_ID || 109401746)

export const StaffGoals = {
  loginAttempt: 'staff_login_attempt',
  loginSuccess: 'staff_login_success',
  loginFail: 'staff_login_fail',
  searchSubmit: 'staff_search_submit',
  toursResults: 'staff_tours_results',
  hotelOpen: 'staff_hotel_open',
  bookOpen: 'staff_book_open',
  leadSuccess: 'staff_lead_success',
  leadFail: 'staff_lead_fail',
} as const

export type StaffGoal = (typeof StaffGoals)[keyof typeof StaffGoals]

type YmFn = (counterId: number, method: string, ...args: unknown[]) => void

declare global {
  interface Window {
    ym?: YmFn
  }
}

/** Дождаться загрузки ym (счётчик асинхронный). */
function withYm(cb: (ym: YmFn) => void) {
  if (typeof window === 'undefined') return
  if (typeof window.ym === 'function') {
    cb(window.ym)
    return
  }
  let tries = 0
  const timer = window.setInterval(() => {
    tries += 1
    if (typeof window.ym === 'function') {
      window.clearInterval(timer)
      cb(window.ym)
    } else if (tries > 40) {
      window.clearInterval(timer)
    }
  }, 100)
}

export function reachGoal(goal: StaffGoal, params?: Record<string, string | number | boolean>) {
  withYm(ym => {
    if (params && Object.keys(params).length > 0) {
      ym(YM_COUNTER_ID, 'reachGoal', goal, params)
    } else {
      ym(YM_COUNTER_ID, 'reachGoal', goal)
    }
  })
}
