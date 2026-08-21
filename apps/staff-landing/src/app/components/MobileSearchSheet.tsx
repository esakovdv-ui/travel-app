'use client'

import { useState, useEffect, useRef } from 'react'
import { staffFetch } from '@/lib/staff-client'
import styles from './MobileSearchSheet.module.css'
import { MonthGrid, monthsFromNow, nextRange } from './MonthGrid'
import {
  flexLabel,
  isoDate,
  nightsBetween,
  offsetDate,
  shortDate,
} from '@/lib/date-utils'
import { yearsLabel } from '@/lib/plural'

// Отпуск планируют за год вперёд, а календарь открывался на два месяца и
// добавлял по два за нажатие — до следующего лета пять кликов. Tourvisor
// принимает даты минимум на 15 месяцев вперёд (проверено на боевом), так что
// ограничение было только наше. Порог в 18 месяцев — чтобы не плодить
// бесконечную ленту сеток.
const CAL_MONTHS_START = 6
const CAL_MONTHS_STEP = 6
const CAL_MONTHS_MAX = 18

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SearchForm {
  countryId: number
  regionIds: number[]
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

// Даты, календарь и подписи — из общих модулей (см. lib/date-utils, MonthGrid).
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

// ── Main component ────────────────────────────────────────────────────────────

type Step = 'destination' | 'dates' | 'travelers' | null

const DEFAULT_FORM: SearchForm = {
  countryId: 4,
  regionIds: [],
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
  const [monthsShown, setMonthsShown] = useState(CAL_MONTHS_START)
  const calRef = useRef<HTMLDivElement>(null)

  // Sync calendar state when sheet opens
  useEffect(() => {
    if (!isOpen) return
    setStep('destination')
    setCalFrom(form.targetDate || null)
    setCalTo(form.targetDate ? offsetDate(form.targetDate, form.nightsTo) : null)
    setMonthsShown(CAL_MONTHS_START)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Курорты выбранной страны. Не отмечено ничего — ищем по всей стране.
  const [regions, setRegions] = useState<{ id: number; name: string }[]>([])
  useEffect(() => {
    if (!isOpen || !form.countryId) return
    let cancelled = false
    staffFetch(`/api/tourvisor/regions?countryId=${form.countryId}`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(j => { if (!cancelled) setRegions(Array.isArray(j.data) ? j.data : []) })
      .catch(() => { if (!cancelled) setRegions([]) })
    return () => { cancelled = true }
  }, [isOpen, form.countryId])

  if (!isOpen) return null

  const popular = popularIds
    .map(id => countries.find(c => c.id === id))
    .filter(Boolean) as Country[]

  const selectedCountry = countries.find(c => c.id === form.countryId)


  // Section summary texts
  const destinationSummary = selectedCountry?.name ?? 'Выберите страну'

  const datesSummary = calFrom && calTo
    ? `${shortDate(calFrom)} – ${shortDate(calTo)}, ${nightsBetween(calFrom, calTo)} ночей`
    : calFrom
    ? `${shortDate(calFrom)} – выберите выезд`
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
  const calMonths = monthsFromNow(monthsShown)

  function handleDay(ds: string) {
    const { from, to } = nextRange(ds, calFrom, calTo)
    setCalFrom(from)
    setCalTo(to)
    if (!to) {
      onUpdate({ targetDate: from })
      return
    }
    const nights = nightsBetween(from, to)
    // Выбранный вручную диапазон — это точный ответ на вопрос «когда».
    // Гибкость по умолчанию ±2 дня превращала его в окно вылета 3–7 октября
    // при выбранном 5-м, и человек не понимал, почему выдача не совпадает
    // с тем, что он ткнул. Сбрасываем в ноль; расширить можно осознанно.
    onUpdate({ targetDate: from, nightsFrom: nights, nightsTo: nights, dateFlex: 0 })
    // Диапазон собран — уводим к следующему шагу
    setTimeout(() => setStep('travelers'), 350)
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
              {/* Курорты — необязательное сужение. Помогает не ждать полную
                  выдачу по стране: она набирается три с половиной минуты. */}
              {regions.length > 0 && (
                <>
                  <div className={styles.regionsLabel}>
                    Курорты
                    {form.regionIds.length > 0 && (
                      <button
                        type="button"
                        className={styles.regionsReset}
                        onClick={() => onUpdate({ regionIds: [] })}
                      >
                        вся страна
                      </button>
                    )}
                  </div>
                  <div className={styles.regionsGrid}>
                    {regions.map(rg => {
                      const on = form.regionIds.includes(rg.id)
                      return (
                        <button
                          key={rg.id}
                          type="button"
                          className={`${styles.regionsChip} ${on ? styles.regionsChipOn : ''}`}
                          aria-pressed={on}
                          onClick={() => onUpdate({
                            regionIds: on
                              ? form.regionIds.filter(x => x !== rg.id)
                              : [...form.regionIds, rg.id],
                          })}
                        >
                          {rg.name}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              <div className={styles.countryList}>
                {popular.map(c => (
                  <button
                    key={c.id}
                    className={`${styles.countryRow} ${c.id === form.countryId ? styles.countryRowActive : ''}`}
                    onClick={() => onUpdate({ countryId: c.id, regionIds: [] })}
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
                  <span>{calFrom ? shortDate(calFrom) : 'Заезд'}</span>
                  {calFrom && (
                    <button className={styles.dateChipReset}
                      onClick={() => { setCalFrom(null); setCalTo(null) }} aria-label="Сбросить дату заезда">×</button>
                  )}
                </div>
                <svg className={styles.dateChipArrow} xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                  <path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z" />
                </svg>
                <div className={`${styles.dateChip} ${calTo ? styles.dateChipFilled : ''}`}>
                  <span>{calTo ? shortDate(calTo) : 'Выезд'}</span>
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
                      {flexLabel(f)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Месяцы: начиная с текущего, по 4 за раз */}
              <div ref={calRef}>
                {calMonths.map(({ year, month }) => (
                  <MonthGrid key={`${year}-${month}`} year={year} month={month} calFrom={calFrom} calTo={calTo} onDay={handleDay} classes={CAL_CLASSES} />
                ))}
              </div>
              {monthsShown < CAL_MONTHS_MAX && (
                <button
                  className={styles.loadMoreBtn}
                  onClick={() => setMonthsShown(n => Math.min(n + CAL_MONTHS_STEP, CAL_MONTHS_MAX))}
                >
                  Загрузить другие даты
                </button>
              )}
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
                        <option key={n} value={n}>{yearsLabel(n)}</option>
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
