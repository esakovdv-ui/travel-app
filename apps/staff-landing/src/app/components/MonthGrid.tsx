'use client'

// Сетка одного месяца с выбором диапазона «заезд — выезд».
// Раньше жила внутри MobileSearchSheet; вынесена, чтобы шапка на десктопе
// использовала ровно тот же календарь, а не свою вторую реализацию.
//
// Классы приходят снаружи: мобильная шторка и шапка оформлены по-разному,
// но поведение и разметка у них общие.

import { RU_MONTHS_FULL, RU_WEEKDAYS, todayIso } from '@/lib/date-utils'

export interface MonthGridClasses {
  calMonth: string
  calMonthName: string
  calGrid: string
  calWd: string
  calDay: string
  calDayPast: string
  calDayStart: string
  calDayEnd: string
  calDayRange: string
}

interface Props {
  year: number
  month: number
  calFrom: string | null
  calTo: string | null
  onDay: (iso: string) => void
  classes: MonthGridClasses
}

export function MonthGrid({ year, month, calFrom, calTo, onDay, classes }: Props) {
  const today = todayIso()
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7 // Пн = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const dayIso = (d: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  return (
    <div className={classes.calMonth}>
      <div className={classes.calMonthName}>{RU_MONTHS_FULL[month]} {year}</div>
      <div className={classes.calGrid}>
        {RU_WEEKDAYS.map(w => <div key={w} className={classes.calWd}>{w}</div>)}
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />
          const ds = dayIso(day)
          const past = ds < today
          const isStart = calFrom === ds
          const isEnd = calTo === ds
          const inRange = !!(calFrom && calTo && ds > calFrom && ds < calTo)
          return (
            <button
              key={day}
              type="button"
              disabled={past}
              onClick={() => !past && onDay(ds)}
              aria-pressed={isStart || isEnd}
              className={[
                classes.calDay,
                past ? classes.calDayPast : '',
                isStart ? classes.calDayStart : '',
                isEnd ? classes.calDayEnd : '',
                inRange ? classes.calDayRange : '',
              ].filter(Boolean).join(' ')}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Общая логика клика по дню: первый клик — заезд, второй — выезд. */
export function nextRange(
  clicked: string,
  from: string | null,
  to: string | null,
): { from: string; to: string | null } {
  if (!from || to) return { from: clicked, to: null }
  return clicked < from ? { from: clicked, to: from } : { from, to: clicked }
}

/** Список месяцев начиная с текущего. */
export function monthsFromNow(count: number): { year: number; month: number }[] {
  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    return { year: d.getFullYear(), month: d.getMonth() }
  })
}
