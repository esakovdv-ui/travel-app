'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { BrandLogo, MgtBadge } from './components/Brand'
import { MobileSearchSheet } from './components/MobileSearchSheet'
import styles from './page.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Country { id: number; name: string }

// IDs популярных направлений по убыванию числа заявок
const POPULAR_COUNTRY_IDS = [4, 1, 2, 16, 9, 47, 13, 46, 8, 12]
// Турция, Египет, Таиланд, Вьетнам, ОАЭ, Россия, Китай, Абхазия, Мальдивы, Шри-Ланка

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RU_MONTHS = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']

function formatDateLabel(dateStr: string, flex: number): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const base = `${d.getDate()} ${RU_MONTHS[d.getMonth()]}`
  if (flex === 0) return base
  return `${base} ±${flex} ${flex === 1 ? 'день' : 'дня'}`
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// ─── Counter ±1 ───────────────────────────────────────────────────────────────

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

// ─── Icons (Phosphor) ─────────────────────────────────────────────────────────

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

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
      <path d="M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23ZM188.9,190.34A88,88,0,0,1,65.66,67.11a89,89,0,0,1,31.4-26A106,106,0,0,0,96,56a104.11,104.11,0,0,0,104,104,106,106,0,0,0,14.92-1.06A89,89,0,0,1,188.9,190.34Z" />
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

// ─── Password Gate ────────────────────────────────────────────────────────────

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [val, setVal] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: val }),
      })
      if (res.ok) {
        sessionStorage.setItem('staff_access', '1')
        onUnlock()
      } else {
        setError('Неверный пароль')
        setVal('')
      }
    } catch {
      setError('Ошибка соединения')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.authPage}>
      <div className={styles.authCard}>
        <div className={styles.authLogoWrap}>
          <BrandLogo />
        </div>
        <div className={styles.authDivider} />
        <h1 className={styles.authTitle}>Портал для сотрудников</h1>
        <p className={styles.authSub}>
          Введите пароль для доступа к специальным условиям бронирования туров
        </p>
        <form onSubmit={submit} className={styles.authForm}>
          <input
            type="password"
            placeholder="Пароль"
            value={val}
            onChange={e => setVal(e.target.value)}
            className="input"
            autoFocus
            autoComplete="current-password"
          />
          {error && <div className={styles.authError}>{error}</div>}
          <button
            type="submit"
            disabled={loading || !val}
            className="btn btn-red btn-block btn-lg"
          >
            {loading ? 'Проверяем…' : 'Войти'}
          </button>
        </form>
        <div className={styles.tricolorLine}>
          <span className={`${styles.dot} ${styles.dotBlue}`} />
          <span className={`${styles.dot} ${styles.dotRed}`} />
          <span className={`${styles.dot} ${styles.dotYellow}`} />
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
// Только gate → landing (форма поиска). Searching/results — теперь /tours (раздел 2.2 ТЗ).

type Phase = 'gate' | 'landing'

export default function StaffPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('gate')
  const [submitting, setSubmitting] = useState(false)

  const searchRef = useRef<HTMLDivElement>(null)
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [openPanel, setOpenPanel] = useState<'destination'|'dates'|'nights'|'travelers'|null>(null)
  const [countryQuery, setCountryQuery] = useState('')
  const [countries, setCountries] = useState<Country[]>([])
  const [form, setForm] = useState({
    countryId: 0,
    targetDate: '',
    dateFlex: 2 as 0|1|2,
    nightsFrom: 7,
    nightsTo: 14,
    adults: 1,
    childAges: [] as number[],
  })

  useEffect(() => {
    if (sessionStorage.getItem('staff_access')) setPhase('landing')
  }, [])

  useEffect(() => {
    fetch('/api/tourvisor/countries')
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

  function handleFormUpdate(patch: Partial<typeof form>) {
    setForm(p => ({ ...p, ...patch }))
  }

  const handleSearch = useCallback(() => {
    if (!form.countryId || !form.targetDate) return
    setSubmitting(true)
    const qs = new URLSearchParams({
      countryId: String(form.countryId),
      countryName: selectedCountry?.name || '',
      dateFrom: offsetDate(form.targetDate, -form.dateFlex),
      dateTo: offsetDate(form.targetDate, form.dateFlex),
      nightsFrom: String(form.nightsFrom),
      nightsTo: String(form.nightsTo),
      adults: String(form.adults),
    })
    if (form.childAges.length > 0) qs.set('childs', form.childAges.join(','))
    router.push(`/tours?${qs.toString()}`)
  }, [router, form, selectedCountry])

  const canSearch = form.countryId > 0 && form.targetDate !== ''

  // ── Gate ───────────────────────────────────────────────────────────────────

  if (phase === 'gate') {
    return <PasswordGate onUnlock={() => setPhase('landing')} />
  }

  // ── Landing (gate + форма поиска) ─────────────────────────────────────────

  return (
    <>
      {/* ── Header ── */}
      <header className={styles.siteHeader}>
        <div className="shell">
          <div className={styles.headerInner}>
            <BrandLogo />
            <div className={styles.staffTab} role="tab" aria-selected="true">
              <span className={styles.staffTabLabel}>Для сотрудников</span>
              <span className={styles.staffTabHint}>Особые условия бронирования</span>
            </div>
            <MgtBadge />
          </div>
        </div>

        {/* Search row */}
        <div className="shell">
          <div className={styles.searchRow} ref={searchRef}>

            {/* ── Mobile collapsed pill (hidden on desktop via CSS) ── */}
            <div className={styles.searchCollapsed} onClick={() => setSearchExpanded(true)}>
              <div className={styles.searchCollapsedText}>
                <span>Куда · Когда · Кто едет</span>
              </div>
              <button
                className={styles.searchSubmit}
                onClick={() => setSearchExpanded(true)}
                aria-label="Найти туры"
              >
                <SearchIcon />
              </button>
            </div>

            {/* ── Full form (visible on desktop, hidden on mobile via CSS) ── */}
            <div className={styles.searchBarPill} role="search">

              {/* ── Куда ── */}
              <div
                className={`${styles.searchSeg} ${openPanel === 'destination' ? styles.searchSegActive : ''}`}
                onClick={() => togglePanel('destination')}
              >
                <span className={styles.searchSegRow}>
                  <PinIcon />
                  <span className={styles.searchSegLabel}>Куда</span>
                </span>
                <span className={styles.searchSegValue}>
                  {selectedCountry?.name ?? 'Выберите страну'}
                </span>
                {openPanel === 'destination' && (
                  <div className={styles.searchPopover} onClick={e => e.stopPropagation()}>
                    {!countryQuery && (() => {
                      const popular = POPULAR_COUNTRY_IDS.map(id => countries.find(c => c.id === id)).filter(Boolean) as Country[]
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

              {/* ── Когда ── */}
              <div
                className={`${styles.searchSeg} ${openPanel === 'dates' ? styles.searchSegActive : ''}`}
                onClick={() => togglePanel('dates')}
              >
                <span className={styles.searchSegRow}>
                  <CalendarIcon />
                  <span className={styles.searchSegLabel}>Когда</span>
                </span>
                <span className={styles.searchSegValue}>
                  {formatDateLabel(form.targetDate, form.dateFlex) || 'Выберите дату'}
                </span>
                {openPanel === 'dates' && (
                  <div className={styles.searchPopover} onClick={e => e.stopPropagation()}>
                    <label className={styles.popoverLabel}>Дата вылета</label>
                    <input
                      type="date"
                      className={styles.popoverDateInput}
                      value={form.targetDate}
                      onChange={e => setForm(p => ({ ...p, targetDate: e.target.value }))}
                    />
                    <label className={styles.popoverLabel} style={{ marginTop: 14 }}>Гибкость дат</label>
                    <div className={styles.flexBtns}>
                      {([0, 1, 2] as const).map(f => (
                        <button
                          key={f}
                          className={`${styles.flexBtn} ${form.dateFlex === f ? styles.flexBtnActive : ''}`}
                          onClick={() => setForm(p => ({ ...p, dateFlex: f }))}
                        >
                          {f === 0 ? 'Точно' : `±${f} ${f === 1 ? 'день' : 'дня'}`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className={styles.searchDivider} aria-hidden="true" />

              {/* ── Ночей ── */}
              <div
                className={`${styles.searchSeg} ${openPanel === 'nights' ? styles.searchSegActive : ''}`}
                onClick={() => togglePanel('nights')}
              >
                <span className={styles.searchSegRow}>
                  <MoonIcon />
                  <span className={styles.searchSegLabel}>Ночей</span>
                </span>
                <span className={styles.searchSegValue}>{form.nightsFrom}–{form.nightsTo}</span>
                {openPanel === 'nights' && (
                  <div className={styles.searchPopover} onClick={e => e.stopPropagation()}>
                    <label className={styles.popoverLabel}>От</label>
                    <select className={styles.popoverSelect} value={form.nightsFrom}
                      onChange={e => setForm(p => ({ ...p, nightsFrom: Number(e.target.value) }))}>
                      {[5,6,7,8,9,10,11,12,14].map(n => <option key={n} value={n}>{n} ночей</option>)}
                    </select>
                    <label className={styles.popoverLabel} style={{ marginTop: 10 }}>До</label>
                    <select className={styles.popoverSelect} value={form.nightsTo}
                      onChange={e => setForm(p => ({ ...p, nightsTo: Number(e.target.value) }))}>
                      {[7,8,9,10,11,12,14,16,21].map(n => <option key={n} value={n}>{n} ночей</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className={styles.searchDivider} aria-hidden="true" />

              {/* ── Кто едет + Поиск (последний сегмент) ── */}
              <div
                className={`${styles.searchSeg} ${styles.searchSegLast} ${openPanel === 'travelers' ? styles.searchSegActive : ''}`}
                onClick={() => togglePanel('travelers')}
              >
                <div className={styles.searchSegText}>
                  <span className={styles.searchSegRow}>
                    <PeopleIcon />
                    <span className={styles.searchSegLabel}>Кто едет</span>
                  </span>
                  <span className={styles.searchSegValue}>{travelersLabel}</span>
                </div>
                <button
                  className={styles.searchSubmit}
                  onClick={e => { e.stopPropagation(); handleSearch() }}
                  disabled={submitting || !canSearch}
                  aria-label="Найти туры"
                >
                  <SearchIcon />
                  <span>{submitting ? 'Переходим…' : 'Поиск'}</span>
                </button>
                {openPanel === 'travelers' && (
                  <div className={styles.searchPopover} onClick={e => e.stopPropagation()}>
                    <div className={styles.travelerRow}>
                      <div>
                        <div className={styles.travelerLabel}>Взрослые</div>
                        <div className={styles.travelerSub}>От 13 лет</div>
                      </div>
                      <Counter value={form.adults} min={1} max={6}
                        onChange={v => setForm(p => ({ ...p, adults: v }))} />
                    </div>
                    <div className={styles.travelerDivider} />
                    <div className={styles.travelerRow}>
                      <div>
                        <div className={styles.travelerLabel}>Дети</div>
                        <div className={styles.travelerSub}>До 12 лет</div>
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
                            <option key={n} value={n}>{n} лет</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Staff advantages */}
            <div className={styles.searchPills} aria-label="Преимущества для сотрудников">
              <span className={styles.searchPill}>✓ Предоплата от 5 ₽</span>
              <span className={styles.searchPill}>✓ Рассрочка 100 дней</span>
              <span className={styles.searchPill}>✓ Фиксация цены</span>
              <span className={styles.searchPill}>✓ Без скрытых комиссий</span>
              <span className={styles.searchPill}>✓ Гибкий график</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main>
        <div className={styles.emptyState}>
          <p className={styles.emptyStateText}>
            Введите параметры поиска выше, чтобы найти туры на особых условиях для сотрудников
          </p>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className={styles.siteFooter}>
        <div className="shell">
          <div className={styles.footerInner}>
            <div className={styles.footerBrand}>
              <BrandLogo />
              <p className={styles.footerTagline}>
                Корпоративный сервис для сотрудников Мосгортура — туры на спецусловиях.
              </p>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <p className={styles.footerCopyright}>МОСГОРТУР/Мои путешествия © 2026</p>
            <div className={styles.footerSocials} aria-label="Социальные сети">
              <a className={styles.footerSocialLink} aria-label="Telegram" href="https://t.me/">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                  <path d="M228.88,26.19a9,9,0,0,0-9.16-1.57L17.06,103.93a14.22,14.22,0,0,0,2.43,27.21L72,141.45V200a15.92,15.92,0,0,0,10,14.83,15.91,15.91,0,0,0,17.51-3.73l25.32-26.26L165,220a15.88,15.88,0,0,0,10.51,4,16.3,16.3,0,0,0,5-.79,15.85,15.85,0,0,0,10.67-11.63L231.77,35A9,9,0,0,0,228.88,26.19Zm-61.14,36L78.15,126.35l-49.6-9.73ZM88,200V152.52l24.79,21.74Zm87.53,8L92.85,135.5l119-85.29Z" />
                </svg>
              </a>
              <a className={styles.footerSocialLink} aria-label="Instagram" href="https://instagram.com/">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                  <path d="M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160ZM176,24H80A56.06,56.06,0,0,0,24,80v96a56.06,56.06,0,0,0,56,56h96a56.06,56.06,0,0,0,56-56V80A56.06,56.06,0,0,0,176,24Zm40,152a40,40,0,0,1-40,40H80a40,40,0,0,1-40-40V80A40,40,0,0,1,80,40h96a40,40,0,0,1,40,40ZM192,76a12,12,0,1,1-12-12A12,12,0,0,1,192,76Z" />
                </svg>
              </a>
            </div>
            <div className={styles.accentLine} aria-hidden="true">
              <span className={`${styles.dot} ${styles.dotBlue}`} />
              <span className={`${styles.dot} ${styles.dotRed}`} />
              <span className={`${styles.dot} ${styles.dotYellow}`} />
            </div>
          </div>
        </div>
      </footer>

      {/* ── Mobile fullscreen search sheet ── */}
      <MobileSearchSheet
        isOpen={searchExpanded}
        onClose={() => setSearchExpanded(false)}
        form={form}
        countries={countries}
        popularIds={POPULAR_COUNTRY_IDS}
        onUpdate={handleFormUpdate}
        onSubmit={handleSearch}
        submitting={submitting}
      />
    </>
  )
}
