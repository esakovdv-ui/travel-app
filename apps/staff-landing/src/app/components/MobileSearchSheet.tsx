'use client'

import { useState, useEffect, useRef } from 'react'
import styles from './MobileSearchSheet.module.css'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SearchForm {
  countryId: number
  targetDate: string
  dateFlex: 0 | 1 | 2
  nightsFrom: number
  nightsTo: number
  adults: number
  childAges: number[]
}

interface Country { id: number; name: string }

interface Props {
  isOpen: boolean
  onClose: () => void
  form: SearchForm
  countries: Country[]
  popularIds: number[]
  onUpdate: (patch: Partial<SearchForm>) => void
  onSubmit: () => void
  submitting?: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RU_MONTHS_FULL = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
]
const RU_MONTHS_SHORT = [
  'янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек',
]
const RU_WD = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoDate(d: Date): string { return d.toISOString().split('T')[0] }

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return isoDate(d)
}

function chipDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getDate()} ${RU_MONTHS_SHORT[d.getMonth()]}`
}

function nightsBetween(from: string, to: string): number {
  return Math.max(1, Math.round(
    (new Date(to).getTime() - new Date(from).getTime()) / 86400000,
  ))
}

function todayStr(): string { return isoDate(new Date()) }

// ── Sub-components ────────────────────────────────────────────────────────────

function Counter({ value, onChange, min = 0, max = 10 }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number
}) {
  return (
    <div className={styles.counter}>
      <button type="button" className={styles.counterBtn}
        disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>–</button>
      <span className={styles.counterVal}>{value}</span>
      <button type="button" className={styles.counterBtn}
        disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={`${styles.sectionChevron} ${open ? styles.sectionChevronOpen : ''}`}
      xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
      <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
      <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
    </svg>
  )
}

function MonthGrid({ year, month, calFrom, calTo, onDay }: {
  year: number; month: number
  calFrom: string | null; calTo: string | null
  onDay: (d: string) => void
}) {
  const today = todayStr()
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7 // Mon = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  function dayStr(d: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  return (
    <div className={styles.calMonth}>
      <div className={styles.calMonthName}>{RU_MONTHS_FULL[month]} {year}</div>
      <div className={styles.calGrid}>
        {RU_WD.map(w => <div key={w} className={styles.calWd}>{w}</div>)}
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />
          const ds = dayStr(day)
          const past = ds < today
          const isStart = calFrom === ds
          const isEnd = calTo === ds
          const inRange = !!(calFrom && calTo && ds > calFrom && ds < calTo)
          return (
            <button
              key={day} type="button" disabled={past}
              onClick={() => !past && onDay(ds)}
              className={[
                styles.calDay,
                past ? styles.calDayPast : '',
                isStart ? styles.calDayStart : '',
                isEnd ? styles.calDayEnd : '',
                inRange ? styles.calDayRange : '',
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

// ── Main component ────────────────────────────────────────────────────────────

type Step = 'destination' | 'dates' | 'travelers' | null

const DEFAULT_FORM: SearchForm = {
  countryId: 4,
  targetDate: (() => { const d = new Date(); d.setDate(d.getDate() + 21); return isoDate(d) })(),
  dateFlex: 0,
  nightsFrom: 7,
  nightsTo: 14,
  adults: 2,
  childAges: [],
}

export function MobileSearchSheet({
  isOpen, onClose, form, countries, popularIds, onUpdate, onSubmit, submitting,
}: Props) {
  const [step, setStep] = useState<Step>('destination')
  const [calFrom, setCalFrom] = useState<string | null>(null)
  const [calTo, setCalTo] = useState<string | null>(null)
  const [monthsShown, setMonthsShown] = useState(4)
  const calRef = useRef<HTMLDivElement>(null)

  // Sync calendar state when sheet opens
  useEffect(() => {
    if (!isOpen) return
    setStep('destination')
    setCalFrom(form.targetDate || null)
    setCalTo(form.targetDate ? offsetDate(form.targetDate, form.nightsTo) : null)
    setMonthsShown(4)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const popular = popularIds
    .map(id => countries.find(c => c.id === id))
    .filter(Boolean) as Country[]

  const selectedCountry = countries.find(c => c.id === form.countryId)

  // Section summary texts
  const destinationSummary = selectedCountry?.name ?? 'Выберите страну'

  const datesSummary = calFrom && calTo
    ? `${chipDate(calFrom)} – ${chipDate(calTo)}, ${nightsBetween(calFrom, calTo)} ночей`
    : calFrom
    ? `${chipDate(calFrom)} – выберите выезд`
    : 'Выберите даты'

  const travelersSummary = [
    `${form.adults} взр.`,
    ...(form.childAges.length > 0
      ? [`${form.childAges.length} ${form.childAges.length === 1 ? 'реб.' : 'дет.'}`]
      : []),
  ].join(', ')

  function scrollToCal() {
    setTimeout(() => calRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  function toggleStep(s: Step) {
    setStep(prev => {
      if (prev !== s && s === 'dates') scrollToCal()
      return prev === s ? null : s
    })
  }

  // Список месяцев для отображения: начиная с текущего, monthsShown штук
  const calMonths = Array.from({ length: monthsShown }, (_, i) => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() + i, 1)
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  function handleDay(ds: string) {
    if (!calFrom || calTo) {
      // Start new selection
      setCalFrom(ds)
      setCalTo(null)
      onUpdate({ targetDate: ds })
    } else {
      // Complete range
      const [from, to] = ds < calFrom ? [ds, calFrom] : [calFrom, ds]
      setCalFrom(from)
      setCalTo(to)
      const nights = nightsBetween(from, to)
      onUpdate({ targetDate: from, nightsFrom: nights, nightsTo: nights })
      // Auto-advance to travelers after short delay
      setTimeout(() => setStep('travelers'), 350)
    }
  }

  function handleClear() {
    onUpdate(DEFAULT_FORM)
    setCalFrom(DEFAULT_FORM.targetDate)
    setCalTo(offsetDate(DEFAULT_FORM.targetDate, DEFAULT_FORM.nightsTo))
    setStep('destination')
  }

  return (
    <div className={styles.overlay}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <button className={styles.headerBtn} onClick={onClose} aria-label="Закрыть">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
            <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
          </svg>
        </button>
        <h2 className={styles.headerTitle}>Поиск тура</h2>
        <button className={styles.headerClear} onClick={handleClear}>Очистить</button>
      </div>

      {/* ── Accordion content ── */}
      <div className={styles.content}>

        {/* Куда */}
        <div className={styles.section}>
          <button
            className={`${styles.sectionHead} ${step === 'destination' ? styles.sectionHeadOpen : ''}`}
            onClick={() => toggleStep('destination')}
          >
            <div className={styles.sectionText}>
              <span className={styles.sectionLabel}>Куда</span>
              <span className={styles.sectionValue}>{destinationSummary}</span>
            </div>
            <ChevronIcon open={step === 'destination'} />
          </button>
          {step === 'destination' && (
            <div className={styles.sectionBody}>
              <div className={styles.countryList}>
                {popular.map(c => (
                  <button
                    key={c.id}
                    className={`${styles.countryRow} ${c.id === form.countryId ? styles.countryRowActive : ''}`}
                    onClick={() => { onUpdate({ countryId: c.id }); setStep('dates') }}
                  >
                    <span>{c.name}</span>
                    {c.id === form.countryId && <CheckIcon />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Когда */}
        <div className={styles.section}>
          <button
            className={`${styles.sectionHead} ${step === 'dates' ? styles.sectionHeadOpen : ''}`}
            onClick={() => toggleStep('dates')}
          >
            <div className={styles.sectionText}>
              <span className={styles.sectionLabel}>Когда</span>
              <span className={styles.sectionValue}>{datesSummary}</span>
            </div>
            <ChevronIcon open={step === 'dates'} />
          </button>
          {step === 'dates' && (
            <div className={styles.sectionBody}>
              {/* Date chips */}
              <div className={styles.dateChips}>
                <div className={`${styles.dateChip} ${calFrom ? styles.dateChipFilled : ''}`}>
                  <span>{calFrom ? chipDate(calFrom) : 'Заезд'}</span>
                  {calFrom && (
                    <button className={styles.dateChipReset}
                      onClick={() => { setCalFrom(null); setCalTo(null) }} aria-label="Сбросить дату заезда">×</button>
                  )}
                </div>
                <svg className={styles.dateChipArrow} xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                  <path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z" />
                </svg>
                <div className={`${styles.dateChip} ${calTo ? styles.dateChipFilled : ''}`}>
                  <span>{calTo ? chipDate(calTo) : 'Выезд'}</span>
                  {calTo && (
                    <button className={styles.dateChipReset}
                      onClick={() => setCalTo(null)} aria-label="Сбросить дату выезда">×</button>
                  )}
                </div>
              </div>

              {/* Flex toggle — сразу под чипами, до календаря */}
              <div className={styles.flexWrap}>
                <div className={styles.flexLabel}>Гибкость дат</div>
                <div className={styles.flexBtns}>
                  {([0, 1, 2] as const).map(f => (
                    <button
                      key={f}
                      className={`${styles.flexBtn} ${form.dateFlex === f ? styles.flexBtnActive : ''}`}
                      onClick={() => onUpdate({ dateFlex: f })}
                    >
                      {f === 0 ? 'Точно' : `±${f} ${f === 1 ? 'день' : 'дня'}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Месяцы: начиная с текущего, по 4 за раз */}
              <div ref={calRef}>
                {calMonths.map(({ year, month }) => (
                  <MonthGrid key={`${year}-${month}`} year={year} month={month} calFrom={calFrom} calTo={calTo} onDay={handleDay} />
                ))}
              </div>
              <button className={styles.loadMoreBtn} onClick={() => setMonthsShown(n => n + 4)}>
                Загрузить другие даты
              </button>
            </div>
          )}
        </div>

        {/* Кто едет */}
        <div className={styles.section}>
          <button
            className={`${styles.sectionHead} ${step === 'travelers' ? styles.sectionHeadOpen : ''}`}
            onClick={() => toggleStep('travelers')}
          >
            <div className={styles.sectionText}>
              <span className={styles.sectionLabel}>Кто едет</span>
              <span className={styles.sectionValue}>{travelersSummary}</span>
            </div>
            <ChevronIcon open={step === 'travelers'} />
          </button>
          {step === 'travelers' && (
            <div className={styles.sectionBody}>
              <div className={styles.travelerRow}>
                <div className={styles.travelerName}>Взрослые</div>
                <Counter value={form.adults} min={1} max={6}
                  onChange={v => onUpdate({ adults: v })} />
              </div>
              {form.childAges.map((age, i) => (
                <div key={i} className={`${styles.childRow} ${styles.travelerRowBorder}`}>
                  <div className={styles.travelerName}>Ребёнок {i + 1}</div>
                  <div className={styles.childRowRight}>
                    <select
                      className={styles.childAgeSelect}
                      value={age}
                      onChange={e => {
                        const ages = [...form.childAges]
                        ages[i] = Number(e.target.value)
                        onUpdate({ childAges: ages })
                      }}
                    >
                      {Array.from({ length: 18 }, (_, n) => n).map(n => (
                        <option key={n} value={n}>{n} лет</option>
                      ))}
                    </select>
                    <button
                      className={styles.childRemove}
                      onClick={() => onUpdate({ childAges: form.childAges.filter((_, j) => j !== i) })}
                      aria-label={`Удалить ребёнка ${i + 1}`}
                    >×</button>
                  </div>
                </div>
              ))}
              {form.childAges.length < 3 && (
                <button
                  className={styles.addChildBtn}
                  onClick={() => onUpdate({ childAges: [...form.childAges, 5] })}
                >
                  + Добавить ребёнка
                </button>
              )}
            </div>
          )}
        </div>

      </div>

      {/* ── Sticky footer ── */}
      <div className={styles.footer}>
        <button className={styles.searchBtn} onClick={onSubmit} disabled={submitting}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
            <path d="M232.49,215.51,185,168a92.12,92.12,0,1,0-17,17l47.53,47.54a12,12,0,0,0,17-17ZM44,112a68,68,0,1,1,68,68A68.07,68.07,0,0,1,44,112Z" />
          </svg>
          {submitting ? 'Переходим…' : 'Поиск'}
        </button>
      </div>
    </div>
  )
}
