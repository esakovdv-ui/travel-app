'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { staffFetch } from '@/lib/staff-client'
import { MonthGrid, monthsFromNow, nextRange } from './MonthGrid'
import { dateRangeToTarget, flexLabel, nightsBetween, offsetDate, searchDateFrom, shortDate } from '@/lib/date-utils'
import { nightsLabel, yearsLabel } from '@/lib/plural'
import { reachGoal, StaffGoals } from '@/lib/metrika'
import styles from '../page.module.css'

interface Country { id: number; name: string }

const POPULAR_COUNTRY_IDS = [4, 1, 2, 16, 9, 47, 13, 46, 8, 12]

// ── Icons ─────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
      <path d="M232.49,215.51,185,168a92.12,92.12,0,1,0-17,17l47.53,47.54a12,12,0,0,0,17-17ZM44,112a68,68,0,1,1,68,68A68.07,68.07,0,0,1,44,112Z" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
      <path d="M128,64a40,40,0,1,0,40,40A40,40,0,0,0,128,64Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,128Zm0-112a88.1,88.1,0,0,0-88,88c0,31.4,14.51,64.68,42,96.25a254.19,254.19,0,0,0,41.45,38.3,8,8,0,0,0,9.18,0A254.19,254.19,0,0,0,174,200.25c27.45-31.57,42-64.85,42-96.25A88.1,88.1,0,0,0,128,16Zm0,206c-16.53-13-72-60.75-72-118a72,72,0,0,1,144,0C200,161.23,144.53,209,128,222Z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
      <path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Z" />
    </svg>
  )
}

function PeopleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
      <path d="M244.8,150.4a8,8,0,0,1-11.2-1.6A51.6,51.6,0,0,0,192,128a8,8,0,0,1-7.37-4.89,8,8,0,0,1,0-6.22A8,8,0,0,1,192,112a24,24,0,1,0-23.24-30,8,8,0,1,1-15.5-4A40,40,0,1,1,219,117.51a67.94,67.94,0,0,1,27.43,21.68A8,8,0,0,1,244.8,150.4ZM190.92,212a8,8,0,1,1-13.84,8,57,57,0,0,0-98.16,0,8,8,0,1,1-13.84-8,72.06,72.06,0,0,1,33.74-29.92,48,48,0,1,1,58.36,0A72.06,72.06,0,0,1,190.92,212ZM128,176a32,32,0,1,0-32-32A32,32,0,0,0,128,176ZM72,120a8,8,0,0,0-8-8A24,24,0,1,1,87.24,82a8,8,0,1,0,15.5-4A40,40,0,1,0,37,117.51,67.94,67.94,0,0,0,9.6,139.19a8,8,0,1,0,12.8,9.61A51.6,51.6,0,0,1,64,128,8,8,0,0,0,72,120Z" />
    </svg>
  )
}

// ── Counter ───────────────────────────────────────────────────────────────────

function Counter({ value, onChange, min = 0, max = 10 }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number
}) {
  return (
    <div className={styles.counter}>
      <button type="button" className={styles.counterBtn}
        onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>–</button>
      <span className={styles.counterVal}>{value}</span>
      <button type="button" className={styles.counterBtn}
        onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>+</button>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CAL_CLASSES = {
  calMonth: styles.calMonth,
  calMonthName: styles.calMonthName,
  calGrid: styles.calGrid,
  calWd: styles.calWd,
  calDay: styles.calDay,
  calDayPast: styles.calDayPast,
  calDayStart: styles.calDayStart,
  calDayEnd: styles.calDayEnd,
  calDayRange: styles.calDayRange,
}

/** Подпись сегмента «Когда»: «26 авг – 2 сен · 7 ночей · ±2 дня». */
function whenLabel(from: string, to: string | null, flex: number): string {
  if (!from) return 'Выберите даты'
  if (!to) return `${shortDate(from)} – выберите выезд`
  const parts = [`${shortDate(from)} – ${shortDate(to)}`, nightsLabel(nightsBetween(from, to))]
  if (flex > 0) parts.push(flexLabel(flex))
  return parts.join(' · ')
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  initialCountryId?: number
  initialDateFrom?: string
  initialDateTo?: string
  initialNightsFrom?: number
  initialNightsTo?: number
  initialAdults?: number
  initialChildAges?: number[]
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HeaderSearchBar({
  initialCountryId = 0,
  initialDateFrom = '',
  initialDateTo = '',
  initialNightsFrom = 7,
  initialNightsTo = 14,
  initialAdults = 1,
  initialChildAges = [],
}: Props) {
  const router = useRouter()
  const searchRef = useRef<HTMLDivElement>(null)
  // «Ночей» больше нет отдельной панелью — количество ночей задаётся
  // выбором диапазона в календаре, как в мобильной шторке.
  const [openPanel, setOpenPanel] = useState<'destination'|'dates'|'travelers'|null>(null)
  const [countryQuery, setCountryQuery] = useState('')
  const [countries, setCountries] = useState<Country[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [monthsShown, setMonthsShown] = useState(2)

  // Поиск с самой /tours ведёт на тот же маршрут: компонент не размонтируется,
  // и без этого сброса кнопка навсегда залипала в «Ищем…».
  const pathname = usePathname()
  const urlQuery = useSearchParams()
  useEffect(() => { setSubmitting(false) }, [pathname, urlQuery])

  const { targetDate: initTarget, dateFlex: initFlex } =
    dateRangeToTarget(initialDateFrom, initialDateTo)

  const [form, setForm] = useState({
    countryId: initialCountryId,
    targetDate: initTarget,
    dateFlex: initFlex,
    nightsFrom: initialNightsFrom,
    nightsTo: initialNightsTo,
    adults: initialAdults,
    childAges: initialChildAges,
  })

  // Диапазон в календаре: заезд — из targetDate, выезд — плюс текущие ночи.
  const [calFrom, setCalFrom] = useState<string | null>(initTarget || null)
  const [calTo, setCalTo] = useState<string | null>(
    initTarget ? offsetDate(initTarget, initialNightsTo) : null,
  )

  function handleDay(iso: string) {
    const { from, to } = nextRange(iso, calFrom, calTo)
    setCalFrom(from)
    setCalTo(to)
    if (!to) {
      setForm(p => ({ ...p, targetDate: from }))
      return
    }
    const nights = nightsBetween(from, to)
    setForm(p => ({ ...p, targetDate: from, nightsFrom: nights, nightsTo: nights }))
  }

  function resetRange() {
    setCalFrom(null)
    setCalTo(null)
    setForm(p => ({ ...p, targetDate: '' }))
  }

  useEffect(() => {
    staffFetch('/api/tourvisor/countries')
      .then(r => r.json())
      .then(json => {
        const list: Country[] = Array.isArray(json.data) ? json.data : []
        setCountries(list)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!openPanel) return
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setOpenPanel(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openPanel])

  function togglePanel(panel: typeof openPanel) {
    setOpenPanel(p => p === panel ? null : panel)
  }

  const selectedCountry = countries.find(c => c.id === form.countryId)
  const filteredCountries = countryQuery
    ? countries.filter(c => c.name.toLowerCase().includes(countryQuery.toLowerCase()))
    : countries
  const travelersLabel = [
    `${form.adults} взр.`,
    ...(form.childAges.length > 0 ? [`${form.childAges.length} дет.`] : []),
  ].join(' · ')

  function addChild() {
    setForm(p => p.childAges.length >= 3 ? p : { ...p, childAges: [...p.childAges, 5] })
  }
  function removeChild(i: number) {
    setForm(p => ({ ...p, childAges: p.childAges.filter((_, j) => j !== i) }))
  }
  function setChildAge(i: number, age: number) {
    setForm(p => ({ ...p, childAges: p.childAges.map((a, j) => j === i ? age : a) }))
  }

  const handleSearch = useCallback(() => {
    if (!form.countryId || !form.targetDate) return
    setSubmitting(true)
    reachGoal(StaffGoals.searchSubmit, {
      country_id: form.countryId,
      country: selectedCountry?.name || '',
      nights_from: form.nightsFrom,
      nights_to: form.nightsTo,
      adults: form.adults,
      source: 'header',
    })
    const qs = new URLSearchParams({
      countryId: String(form.countryId),
      countryName: selectedCountry?.name || '',
      dateFrom: searchDateFrom(form.targetDate, form.dateFlex),
      dateTo: offsetDate(form.targetDate, form.dateFlex),
      nightsFrom: String(form.nightsFrom),
      nightsTo: String(form.nightsTo),
      adults: String(form.adults),
    })
    if (form.childAges.length > 0) qs.set('childs', form.childAges.join(','))
    router.push(`/tours?${qs.toString()}`)
  }, [router, form, selectedCountry])

  const canSearch = form.countryId > 0 && !!calFrom && !!calTo

  return (
    <div className={styles.searchBarPill} role="search" ref={searchRef}>

      {/* ── Куда ── */}
      <div className={`${styles.searchSeg} ${openPanel === 'destination' ? styles.searchSegActive : ''}`}>
        <button
          type="button"
          className={styles.searchSegTrigger}
          onClick={() => togglePanel('destination')}
          aria-expanded={openPanel === 'destination'}
          aria-haspopup="dialog"
        >
          <span className={styles.searchSegRow}>
            <PinIcon />
            <span className={styles.searchSegLabel}>Куда</span>
          </span>
          <span className={styles.searchSegValue}>
            {selectedCountry?.name ?? 'Выберите страну'}
          </span>
        </button>
        {openPanel === 'destination' && (
          <div className={styles.searchPopover}>
            {!countryQuery && (() => {
              const popular = POPULAR_COUNTRY_IDS
                .map(id => countries.find(c => c.id === id))
                .filter(Boolean) as Country[]
              if (popular.length === 0) return null
              return (
                <>
                  <div className={styles.popoverSectionLabel}>Популярные</div>
                  <div className={styles.popoverPopularGrid}>
                    {popular.map(c => (
                      <button
                        key={c.id}
                        className={`${styles.popoverPopularBtn} ${c.id === form.countryId ? styles.popoverPopularBtnActive : ''}`}
                        onClick={() => { setForm(p => ({ ...p, countryId: c.id })); setOpenPanel(null) }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                  <div className={styles.popoverDivider} />
                  <div className={styles.popoverSectionLabel}>Все страны</div>
                </>
              )
            })()}
            <input
              autoFocus
              className={styles.popoverSearch}
              placeholder="Поиск страны..."
              value={countryQuery}
              onChange={e => setCountryQuery(e.target.value)}
            />
            <div className={styles.popoverList}>
              {filteredCountries.map(c => (
                <button
                  key={c.id}
                  className={`${styles.popoverItem} ${c.id === form.countryId ? styles.popoverItemActive : ''}`}
                  onClick={() => {
                    setForm(p => ({ ...p, countryId: c.id }))
                    setCountryQuery('')
                    setOpenPanel(null)
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className={styles.searchDivider} aria-hidden="true" />

      {/* ── Когда: даты, гибкость и ночи одним сегментом ── */}
      <div className={`${styles.searchSeg} ${styles.searchSegWhen} ${openPanel === 'dates' ? styles.searchSegActive : ''}`}>
        <button
          type="button"
          className={styles.searchSegTrigger}
          onClick={() => togglePanel('dates')}
          aria-expanded={openPanel === 'dates'}
          aria-haspopup="dialog"
        >
          <span className={styles.searchSegRow}>
            <CalendarIcon />
            <span className={styles.searchSegLabel}>Когда</span>
          </span>
          <span className={styles.searchSegValue}>
            {whenLabel(calFrom ?? '', calTo, form.dateFlex)}
          </span>
        </button>
        {openPanel === 'dates' && (
          <div className={`${styles.searchPopover} ${styles.searchPopoverWide}`}>

            {/* Заезд → выезд */}
            <div className={styles.dateChips}>
              <div className={`${styles.dateChip} ${calFrom ? styles.dateChipFilled : ''}`}>
                <span>{calFrom ? shortDate(calFrom) : 'Заезд'}</span>
              </div>
              <span className={styles.dateChipArrow} aria-hidden="true">→</span>
              <div className={`${styles.dateChip} ${calTo ? styles.dateChipFilled : ''}`}>
                <span>{calTo ? shortDate(calTo) : 'Выезд'}</span>
              </div>
              {(calFrom || calTo) && (
                <button type="button" className={styles.dateChipsReset} onClick={resetRange}>
                  Сбросить
                </button>
              )}
            </div>

            {calFrom && calTo && (
              <div className={styles.nightsHint}>
                {nightsLabel(nightsBetween(calFrom, calTo))} в отеле
              </div>
            )}

            {/* Гибкость вылета */}
            <label className={styles.popoverLabel}>Гибкость дат вылета</label>
            <div className={styles.flexBtns}>
              {([0, 1, 2] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  className={`${styles.flexBtn} ${form.dateFlex === f ? styles.flexBtnActive : ''}`}
                  onClick={() => setForm(p => ({ ...p, dateFlex: f }))}
                >
                  {flexLabel(f)}
                </button>
              ))}
            </div>

            {/* Календарь */}
            <div className={styles.calMonths}>
              {monthsFromNow(monthsShown).map(({ year, month }) => (
                <MonthGrid
                  key={`${year}-${month}`}
                  year={year}
                  month={month}
                  calFrom={calFrom}
                  calTo={calTo}
                  onDay={handleDay}
                  classes={CAL_CLASSES}
                />
              ))}
            </div>
            <button type="button" className={styles.calMoreBtn} onClick={() => setMonthsShown(n => n + 2)}>
              Показать ещё месяцы
            </button>
          </div>
        )}
      </div>
      <div className={styles.searchDivider} aria-hidden="true" />

      {/* ── Кто едет + Поиск ── */}
      <div className={`${styles.searchSeg} ${styles.searchSegLast} ${openPanel === 'travelers' ? styles.searchSegActive : ''}`}>
        <button
          type="button"
          className={styles.searchSegTrigger}
          onClick={() => togglePanel('travelers')}
          aria-expanded={openPanel === 'travelers'}
          aria-haspopup="dialog"
        >
          <span className={styles.searchSegRow}>
            <PeopleIcon />
            <span className={styles.searchSegLabel}>Кто едет</span>
          </span>
          <span className={styles.searchSegValue}>{travelersLabel}</span>
        </button>
        <button
          type="button"
          className={styles.searchSubmit}
          onClick={handleSearch}
          disabled={submitting || !canSearch}
          aria-label="Найти туры"
        >
          <SearchIcon />
          {/* Короткая надпись: «Переходим…» была заметно шире «Поиска»
              и распирала пилюлю на узком десктопе. */}
          <span>{submitting ? 'Ищем…' : 'Поиск'}</span>
        </button>
        {openPanel === 'travelers' && (
          <div className={styles.searchPopover}>
            <div className={styles.travelerRow}>
              <div>
                <div className={styles.travelerLabel}>Взрослые</div>
                <div className={styles.travelerSub}>От 18 лет</div>
              </div>
              <Counter value={form.adults} min={1} max={6}
                onChange={v => setForm(p => ({ ...p, adults: v }))} />
            </div>
            <div className={styles.travelerDivider} />
            <div className={styles.travelerRow}>
              <div>
                <div className={styles.travelerLabel}>Дети</div>
                <div className={styles.travelerSub}>До 17 лет</div>
              </div>
              <Counter value={form.childAges.length} min={0} max={3}
                onChange={v => v > form.childAges.length ? addChild() : removeChild(form.childAges.length - 1)} />
            </div>
            {form.childAges.map((age, i) => (
              <div key={i} className={styles.childAgeRow}>
                <span className={styles.travelerSub}>Ребёнок {i + 1}</span>
                <select className={styles.popoverSelect} style={{ width: 'auto' }}
                  value={age} onChange={e => setChildAge(i, Number(e.target.value))}>
                  {Array.from({ length: 18 }, (_, n) => n).map(n => (
                    <option key={n} value={n}>{yearsLabel(n)}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
