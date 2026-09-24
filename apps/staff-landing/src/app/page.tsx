'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { staffFetch, setStaffSessionToken } from '@/lib/staff-client'
import { reachGoal, StaffGoals } from '@/lib/metrika'
import { BrandLogo } from './components/Brand'
import { MobileSearchSheet } from './components/MobileSearchSheet'
import { HeaderSearchBar } from './components/HeaderSearchBar'
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

// ─── Icons (Phosphor) ─────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
      <path d="M232.49,215.51,185,168a92.12,92.12,0,1,0-17,17l47.53,47.54a12,12,0,0,0,17-17ZM44,112a68,68,0,1,1,68,68A68.07,68.07,0,0,1,44,112Z" />
    </svg>
  )
}

// ─── How it works ───────────────────────────────────────────────────────────

const HOW_IT_WORKS_STEPS = [
  {
    title: 'Выбираете тур',
    text: 'Находите подходящий тур в поиске: направление, даты, отель, питание и стоимость.',
    icon: 'search',
  },
  {
    title: 'Оставляете заявку',
    text: 'Нажимаете на понравившийся тур и отправляете заявку через портал.',
    icon: 'send',
  },
  {
    title: 'Менеджер подтверждает детали',
    text: 'Менеджер связывается с вами, уточняет детали поездки и подтверждает бронирование.',
    icon: 'check',
  },
  {
    title: 'Вносите предоплату от 5 ₽',
    text: 'После внесения предоплаты стоимость тура фиксируется и не изменяется.',
    icon: 'wallet',
  },
  {
    title: 'Оплачиваете остаток в течение 100 дней',
    text: 'Можно использовать рассрочку/постоплату без скрытых комиссий.',
    icon: 'calendar',
  },
] as const

function StepIcon({ name }: { name: typeof HOW_IT_WORKS_STEPS[number]['icon'] }) {
  const common = { width: 22, height: 22, fill: 'currentColor', viewBox: '0 0 256 256', 'aria-hidden': true as const }
  switch (name) {
    case 'search':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          <path d="M232.49,215.51,185,168a92.12,92.12,0,1,0-17,17l47.53,47.54a12,12,0,0,0,17-17ZM44,112a68,68,0,1,1,68,68A68.07,68.07,0,0,1,44,112Z" />
        </svg>
      )
    case 'send':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          <path d="M231.87,114l-168-95.89A16,16,0,0,0,40.92,37.34l31.45,89.47L40.92,216.12a16,16,0,0,0,22.95,19.11l168-95.89A16,16,0,0,0,231.87,114ZM80.81,214.81l8.36-50.54,27.2,15.09a8,8,0,0,0,7.87,0l27.2-15.09,8.36,50.54ZM71.13,96.57,35.54,37.34,220.46,128Z" />
        </svg>
      )
    case 'check':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          <path d="M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z" />
        </svg>
      )
    case 'wallet':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          <path d="M216,72H56a8,8,0,0,1,0-16H192a8,8,0,0,0,0-16H56A24,24,0,0,0,32,64V192a24,24,0,0,0,24,24H216a16,16,0,0,0,16-16V88A16,16,0,0,0,216,72Zm0,128H56a8,8,0,0,1-8-8V86.63A23.84,23.84,0,0,0,56,88H216Zm-48-60a12,12,0,1,1,12,12A12,12,0,0,1,168,140Z" />
        </svg>
      )
    case 'calendar':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          <path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Z" />
        </svg>
      )
  }
}

function HowItWorks() {
  return (
    <section className={styles.howItWorks} aria-labelledby="how-it-works-title">
      <div className={styles.howItWorksPanel}>
        <h2 id="how-it-works-title" className={styles.howItWorksTitle}>Как это работает</h2>
        <ol className={styles.stepsGrid}>
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <li key={step.title} className={styles.stepCard}>
              <div className={styles.stepTop}>
                <span className={styles.stepIcon}><StepIcon name={step.icon} /></span>
                <span className={styles.stepNum}>{index + 1}</span>
              </div>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepText}>{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
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
    reachGoal(StaffGoals.loginAttempt)
    try {
      const res = await staffFetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: val }),
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        if (typeof data.token === 'string') setStaffSessionToken(data.token)
        reachGoal(StaffGoals.loginSuccess)
        onUnlock()
        return
      }

      reachGoal(StaffGoals.loginFail)
      if (res.status === 429) {
        const wait = Number(res.headers.get('Retry-After') ?? 0)
        const minutes = Math.max(1, Math.ceil(wait / 60))
        setError(`Слишком много попыток. Попробуйте через ${minutes} мин.`)
      } else if (res.status === 503) {
        setError('Портал временно недоступен. Напишите в корпоративный отдел.')
      } else {
        setError('Не удалось войти. Проверьте адрес рабочей почты.')
        setVal('')
      }
    } catch {
      reachGoal(StaffGoals.loginFail)
      setError('Нет связи с сервером. Проверьте интернет и попробуйте снова.')
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
          Вход по рабочей почте — специальные условия бронирования туров
        </p>
        <form onSubmit={submit} className={styles.authForm}>
          {/* Поле раньше было type="password" с плейсхолдером «Пароль», хотя ждёт
              корпоративную почту: сотрудники вбивали пароль от учётки и не входили. */}
          <div className={styles.authField}>
            <label htmlFor="staff-email" className={styles.authLabel}>
              Рабочая почта
            </label>
            <input
              id="staff-email"
              type="email"
              inputMode="email"
              value={val}
              onChange={e => setVal(e.target.value)}
              className="input"
              autoFocus
              autoComplete="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              aria-describedby={error ? 'staff-auth-error' : undefined}
              aria-invalid={error ? true : undefined}
            />
            {/* Подсказки под полем намеренно нет: она называла допустимый домен,
                то есть подсказывала постороннему, как подобрать адрес для входа.
                По той же причине текст ошибки не уточняет, что именно не так. */}
          </div>
          {error && (
            <div id="staff-auth-error" className={styles.authError} role="alert">
              {error}
            </div>
          )}
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

  const [searchExpanded, setSearchExpanded] = useState(false)
  const [countries, setCountries] = useState<Country[]>([])
  const [form, setForm] = useState({
    countryId: 0,
    targetDate: '',
    dateFlex: 2 as 0|1|2,
    nightsFrom: 7,
    nightsTo: 14,
    adults: 1,
    childAges: [] as number[],
    regionIds: [] as number[],
  })

  useEffect(() => {
    staffFetch('/api/auth')
      .then(async res => {
        if (!res.ok) return
        const data = await res.json().catch(() => ({}))
        if (typeof data.token === 'string') setStaffSessionToken(data.token)
        setPhase('landing')
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (phase !== 'landing') return
    staffFetch('/api/tourvisor/countries')
      .then(r => r.json())
      .then(json => {
        const list: Country[] = Array.isArray(json.data) ? json.data : []
        setCountries(list)
      })
      .catch(() => {})
  }, [phase])

  const selectedCountry = countries.find(c => c.id === form.countryId)
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
    for (const id of form.regionIds) qs.append('regionIds', String(id))
    router.push(`/tours?${qs.toString()}`)
  }, [router, form, selectedCountry])


  // ── Gate ───────────────────────────────────────────────────────────────────

  if (phase === 'gate') {
    return <PasswordGate onUnlock={() => setPhase('landing')} />
  }

  // ── Landing (gate + форма поиска) ─────────────────────────────────────────

  return (
    <>
      <main className={styles.landingMain}>
        <div className="shell">
          <section className={styles.landingHero}>
            <p className={styles.landingIntro}>
              Корпоративный портал для сотрудников Мосгортура: здесь можно выбрать тур, оставить заявку
              и забронировать поездку на специальных условиях — с предоплатой от 5&nbsp;₽, фиксацией цены
              и оплатой остатка в течение 100 дней.
            </p>

            <div className={styles.searchRow}>

            {/* ── Mobile collapsed pill (hidden on desktop via CSS) ── */}
            {/* Была <div onClick> с вложенной кнопкой-дублёром: одно действие,
                два элемента, ни один не доступен с клавиатуры. Теперь одна кнопка. */}
            <button
              type="button"
              className={styles.searchCollapsed}
              onClick={() => setSearchExpanded(true)}
              aria-haspopup="dialog"
            >
              <span className={styles.searchCollapsedText}>
                <span>Куда · Когда · Кто едет</span>
              </span>
              <span className={styles.searchSubmit} aria-hidden="true">
                <SearchIcon />
              </span>
            </button>

            {/* Десктопная строка поиска — общий компонент.
                Раньше здесь лежала её третья копия (лендинг / шапка / мобилка). */}
            <div className={styles.searchBarDesktop}>
              <HeaderSearchBar />
            </div>
            </div>

            <div className={styles.searchPills} aria-label="Преимущества для сотрудников">
              <span className={styles.searchPill}>✓ Предоплата от 5 ₽</span>
              <span className={styles.searchPill}>✓ Рассрочка 100 дней</span>
              <span className={styles.searchPill}>✓ Фиксация цены</span>
              <span className={styles.searchPill}>✓ Без скрытых комиссий</span>
              <span className={styles.searchPill}>✓ Гибкий график</span>
            </div>
          </section>

          <HowItWorks />
        </div>
      </main>

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
