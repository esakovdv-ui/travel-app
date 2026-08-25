'use client'

import { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { HeaderSearchBar } from '../components/HeaderSearchBar'
import { MobileSearchSheet } from '../components/MobileSearchSheet'
import type { SearchForm } from '../components/MobileSearchSheet'
import pageStyles from '../page.module.css'
import styles from './page.module.css'
import {
  FiltersSidebar,
  FiltersBottomSheet,
  DEFAULT_FILTERS,
  applyFilters,
  countActiveFilters,
  computeFilterOptions,
} from './FiltersPanel'
import type { FilterState } from './FiltersPanel'
import { reportSeenRegions } from '@/lib/region-availability-client'
import { cachedPhotos, loadPhotos } from '@/lib/hotel-photos'
import { staffFetch } from '@/lib/staff-client'
import { useStaffGuard } from '@/lib/use-staff-guard'
import { useAppHeight } from '@/lib/use-app-height'
import { hotelsLabel, hotelsWord, nightsLabel, secondsWord, toursLabel, toursWord, variantsWord } from '@/lib/plural'
import { dateRangeToTarget, flexLabel, offsetDate, searchDateFrom, shortDate } from '@/lib/date-utils'
import { reachGoal, StaffGoals } from '@/lib/metrika'
import type { HotelSearchResult, HotelDescription, HotelRoom, TourSummary } from '@/lib/tourvisor/types'

const MapView = dynamic(() => import('./MapView'), { ssr: false })

const POPULAR_COUNTRY_IDS = [4, 1, 2, 16, 9, 47, 13, 46, 8, 12]

interface Country { id: number; name: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(n: number) {
  return n.toLocaleString('ru-RU') + ' ₽'
}

function stars(n: number) {
  return '★'.repeat(Math.max(0, Math.min(5, n)))
}

// Показателя реальной популярности (брони, просмотры) Tourvisor не отдаёт,
// поэтому «популярные» — это рейтинг с добивкой по звёздам при равном
// рейтинге. Отели без оценки уходят вниз, а не наверх нулями.
type SortKey = 'popular' | 'price_asc' | 'price_desc' | 'category_desc'

const POLL_INTERVAL_MS = 1500
const RESULTS_LIMIT = 500

// Tourvisor отдаёт выдачу порциями: старт даёт первую, каждый continue —
// следующую. Одного continue мало: на типовом запросе по Турции он даёт 37
// отелей из 189+, причём целых курортов (Бодрум, Мармарис, Белек) в выдаче
// просто нет. Поэтому крутим continue в цикле, пока список растёт.
// Суточная квота тарифа считает старты поиска, continue в неё не входит —
// потолки ниже страхуют от зависания, а не экономят квоту.
// Замер на боевом (Турция, 20–27 сен, 7–10 ночей): раунд занимает ~5 секунд,
// а выдача растёт ровно, без плато — 150 отелей на старте, 387 после двадцати
// раундов и всё ещё прибавляет. Прежние 12 раундов и 45 секунд обрывали её на
// 205 отелях, причём рост шёл до последнего тика: пользователь видел половину.
// Continue не тратит суточную квоту тарифа (она считает старты поиска), так что
// цена длинного окна — только фоновые опросы. Список пополняется на глазах и
// пригоден с первой секунды, поэтому ждать никого не заставляем.
const MAX_EXPAND_ROUNDS   = Number(process.env.NEXT_PUBLIC_TV_MAX_EXPAND_ROUNDS ?? 40)
const EXPAND_BUDGET_MS    = Number(process.env.NEXT_PUBLIC_TV_EXPAND_BUDGET_MS ?? 240_000)
/** Столько раундов подряд без новых отелей считаем концом выдачи. */
const EXPAND_STALL_ROUNDS = 2
/**
 * После стольких отелей полоса загрузки уходит.
 *
 * Полная выдача набирается за три с половиной минуты — столько её и отдаёт
 * Tourvisor. Держать всё это время полосу в шапке незачем: список пригоден
 * с первых секунд и пополняется сам. Ста отелей хватает, чтобы было что
 * листать, дальше догрузка идёт тихо — её выдаёт только растущий счётчик.
 */
const QUIET_AFTER_HOTELS = 100
/** Столько подряд неудачных опросов статуса терпим — Tourvisor отвечает
    404, пока не зарегистрировал только что стартовавший поиск. */
const STATUS_MISS_LIMIT = 6
/** Доля прогресс-бара на первый проход, остаток — на догрузку. */
const FIRST_PASS_WEIGHT = 0.45

// ─── Заявка: телефон и сообщения об ошибках ──────────────────────────────────

/** Телефон считаем заполненным, если сервер сможет его нормализовать: 10 или 11 цифр. */
function isPhoneComplete(input: string): boolean {
  const digits = input.replace(/\D/g, '')
  if (digits.length === 10) return true
  return digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))
}

const LEAD_FALLBACK_ERROR =
  'Не получилось отправить заявку. Проверьте связь и попробуйте ещё раз — ' +
  'если не выйдет, позвоните в корпоративный отдел.'

/** Коды с сервера → текст, по которому сотруднику понятно, что делать. */
async function leadErrorMessage(res: Response): Promise<string> {
  if (res.status === 401) {
    return 'Сессия истекла. Обновите страницу и войдите заново — тур сохранится в результатах поиска.'
  }
  let code = ''
  try {
    code = String(((await res.json()) as { error?: unknown }).error ?? '')
  } catch {
    /* тело не JSON — останемся на общем тексте */
  }
  switch (code) {
    case 'missing_fields':
      return 'Заполните имя и телефон.'
    case 'invalid_phone':
      return 'Проверьте телефон: нужны 11 цифр, например +7 999 123-45-67.'
    case 'misconfigured':
      return 'Приём заявок временно недоступен — мы уже чиним. Позвоните в корпоративный отдел.'
    case 'bitrix_error':
      return 'CRM не приняла заявку. Мы сохранили её в журнале — повторите отправку через минуту или позвоните в корпоративный отдел.'
    default:
      return LEAD_FALLBACK_ERROR
  }
}

const RU_MONTHS_SHORT = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']

function parseTourDate(dateStr: string): Date | null {
  if (!dateStr) return null
  if (dateStr.includes('.')) {
    // DD.MM.YYYY
    const [d, m, y] = dateStr.split('.').map(Number)
    if (!d || !m || !y) return null
    return new Date(y, m - 1, d)
  }
  // YYYY-MM-DD (ISO)
  const iso = new Date(dateStr + 'T00:00:00')
  return isNaN(iso.getTime()) ? null : iso
}

function formatDateShort(d: Date): string {
  return `${d.getDate()} ${RU_MONTHS_SHORT[d.getMonth()]}`
}

function formatDateRange(dateStr: string, nights: number): string {
  const start = parseTourDate(dateStr)
  if (!start) return dateStr
  const end = new Date(start)
  end.setDate(end.getDate() + nights)
  return `${formatDateShort(start)} — ${formatDateShort(end)}`
}

// ─── Flight types & helpers ───────────────────────────────────────────────────

interface FlightLeg {
  number: string
  companyName: string
  companyLogo: string
  plane: string
  cls: string
  depDate: string; depTime: string; depPort: string; depPortName: string
  arrDate: string; arrTime: string; arrPort: string; arrPortName: string
  baggage: number
}

type FlightEntry =
  | { st: 'loading' }
  | { st: 'error' }
  | {
      st: 'ok'
      forward: FlightLeg | null
      backward: FlightLeg | null
      options: number
      outboundCount: number
      inboundCount: number
      priceFrom: number | null
      priceTo: number | null
    }

function parseLeg(raw: any): FlightLeg | null {
  if (!raw || typeof raw !== 'object') return null
  return {
    number:      raw.number ?? '',
    companyName: raw.company?.name ?? '',
    companyLogo: raw.company?.logo ?? '',
    plane:       raw.plane ?? '',
    cls:         raw.class ?? 'Y',
    depDate:     raw.departure?.date ?? '',
    depTime:     raw.departure?.time ?? '',
    depPort:     raw.departure?.port?.id ?? '',
    depPortName: raw.departure?.port?.shortName ?? '',
    arrDate:     raw.arrival?.date ?? '',
    arrTime:     raw.arrival?.time ?? '',
    arrPort:     raw.arrival?.port?.id ?? '',
    arrPortName: raw.arrival?.port?.shortName ?? '',
    baggage:     Number(raw.baggage ?? 0),
  }
}

/**
 * Заглушка вместо рейса.
 *
 * Первым в списке идёт вариант с isDefault, и у чартеров это сплошь и рядом
 * пустышка: номер «SU000», вылет и прилёт в 00:00. Замер на боевом: из 122
 * вариантов такой ровно один — и именно его мы и показывали, пока настоящий
 * рейс «SU2156 12:45 → 18:10» лежал следующей строкой. Отсюда и ощущение,
 * что рейсы не подгружаются: они подгружались, мы рисовали заглушку.
 */
function isStubLeg(raw: any): boolean {
  if (!raw) return true
  const dep = raw.departure?.time ?? ''
  const arr = raw.arrival?.time ?? ''
  const blank = (t: string) => t === '' || t === '00:00'
  return blank(dep) && blank(arr)
}

function parseFlightsResponse(raw: unknown): {
  forward: FlightLeg | null
  backward: FlightLeg | null
  /** Сколько вариантов перелёта предложил оператор. */
  options: number
  /** Из скольких рейсов туда и обратно они складываются. */
  outboundCount: number
  inboundCount: number
  /** Разброс цен между ними: выбор рейса меняет стоимость тура. */
  priceFrom: number | null
  priceTo: number | null
} {
  const r = raw as any
  const list: any[] = Array.isArray(r?.flights) ? r.flights
    : Array.isArray(r?.data?.flights) ? r.data.flights
    : []
  if (list.length === 0) {
    return { forward: null, backward: null, options: 0, outboundCount: 0, inboundCount: 0, priceFrom: null, priceTo: null }
  }

  // Берём первый вариант с настоящим рейсом; если таких нет — что есть.
  const chosen = list.find(f => !isStubLeg(f.forward?.[0])) ?? list[0]

  // Считаем только по настоящим рейсам: у заглушки своя цена, и сравнение с
  // ней давало ложный «разброс» — на замере 99 106 против 115 788, хотя все
  // 121 реальные комбинации стоят ровно одинаково.
  const prices = list
    .filter(f => !isStubLeg(f.forward?.[0]))
    .map(f => Number(f?.price?.value))
    .filter(n => Number.isFinite(n) && n > 0)

  // Комбинаций много (121 на замере), но складываются они из коротких списков:
  // 11 рейсов туда и 11 обратно. Считаем именно их — «ещё 120 вариантов»
  // ничего не говорит, а «11 рейсов туда» говорит.
  const real = list.filter(f => !isStubLeg(f.forward?.[0]))
  const outbound = new Set(real.map(f => f.forward?.[0]?.number).filter(Boolean))
  const inbound  = new Set(real.map(f => f.backward?.[0]?.number).filter(Boolean))

  return {
    forward:  parseLeg(chosen.forward?.[0] ?? null),
    backward: parseLeg(chosen.backward?.[0] ?? null),
    options: list.length,
    outboundCount: outbound.size,
    inboundCount: inbound.size,
    priceFrom: prices.length ? Math.min(...prices) : null,
    priceTo:   prices.length ? Math.max(...prices) : null,
  }
}

function fmtFlightDate(ds: string): string {
  if (!ds) return ''
  if (ds.includes('.')) { const [d, m] = ds.split('.').map(Number); return `${d} ${RU_MONTHS_SHORT[m - 1]}` }
  if (ds.includes('-')) { const [, m, d] = ds.split('-').map(Number); return `${d} ${RU_MONTHS_SHORT[m - 1]}` }
  return ds
}

// ─── Иконки ───────────────────────────────────────────────────────────────────
// Были эмодзи (🏨 🛏 📍 ✈ 🗺 📋) вперемешку с аккуратным SVG-набором Phosphor:
// на Windows и Android они рисуются другим шрифтом и выбиваются из вёрстки.

function PinGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <path d="M128,64a40,40,0,1,0,40,40A40,40,0,0,0,128,64Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,128Zm0-112a88.1,88.1,0,0,0-88,88c0,31.4,14.51,64.68,42,96.25a254.19,254.19,0,0,0,41.45,38.3,8,8,0,0,0,9.18,0A254.19,254.19,0,0,0,174,200.25c27.45-31.57,42-64.85,42-96.25A88.1,88.1,0,0,0,128,16Z" />
    </svg>
  )
}

function PlaneGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <path d="M232,120H197.36L166.4,68.36A16,16,0,0,0,152.66,60H120.4a8,8,0,0,0-6.86,12.11L145.66,120H88L64.8,88A8,8,0,0,0,58.4,84.8H32a8,8,0,0,0-7.6,10.53L38.6,128,24.4,160.67A8,8,0,0,0,32,171.2H58.4A8,8,0,0,0,64.8,168L88,136h57.66l-32.12,47.89A8,8,0,0,0,120.4,196h32.26a16,16,0,0,0,13.74-8.36L197.36,136H232a8,8,0,0,0,0-16Z" />
    </svg>
  )
}

function HotelGlyph() {
  return (
    <svg width="30" height="30" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" opacity="0.35">
      <path d="M240,208H224V96a16,16,0,0,0-16-16H144V32a16,16,0,0,0-24.88-13.32l-88,58.67A16,16,0,0,0,24,90.66V208H8a8,8,0,0,0,0,16H248a8,8,0,0,0,0-16ZM208,96V208H144V96ZM40,90.66,128,32v176H40ZM112,120v16a8,8,0,0,1-16,0V120a8,8,0,1,1,16,0Zm-40,0v16a8,8,0,0,1-16,0V120a8,8,0,1,1,16,0Zm0,56v16a8,8,0,0,1-16,0V176a8,8,0,0,1,16,0Zm40,0v16a8,8,0,0,1-16,0V176a8,8,0,0,1,16,0Z" />
    </svg>
  )
}

function BedGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" opacity="0.35">
      <path d="M240,112H224V64a16,16,0,0,0-16-16H48A16,16,0,0,0,32,64v48H16a8,8,0,0,0-8,8v72a8,8,0,0,0,16,0V184H232v8a8,8,0,0,0,16,0V120A8,8,0,0,0,240,112ZM48,64H208v48H192V96a16,16,0,0,0-16-16H144a16,16,0,0,0-16,16v16H112V96A16,16,0,0,0,96,80H64A16,16,0,0,0,48,96v16H48Zm128,48H144V96h32Zm-80,0H64V96H96ZM24,168V128H232v40Z" />
    </svg>
  )
}

function MapGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <path d="M228.92,49.69a8,8,0,0,0-6.86-1.45L160.93,63.52,99.58,32.84a8,8,0,0,0-5.52-.6l-64,16A8,8,0,0,0,24,56V200a8,8,0,0,0,9.94,7.76l61.13-15.28,61.35,30.68A8,8,0,0,0,160,224a8.13,8.13,0,0,0,1.94-.24l64-16A8,8,0,0,0,232,200V56A8,8,0,0,0,228.92,49.69ZM104,52.94l48,24V203.06l-48-24Zm-64,9.31,48-12V178.5L40,190.5Zm176,131.5-48,12V77.5l48-12Z" />
    </svg>
  )
}

function ListGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z" />
    </svg>
  )
}

function SlidersGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <path d="M40,88H73a32,32,0,0,0,62,0h81a8,8,0,0,0,0-16H135a32,32,0,0,0-62,0H40a8,8,0,0,0,0,16Zm64-24A16,16,0,1,1,88,80,16,16,0,0,1,104,64ZM216,168H199a32,32,0,0,0-62,0H40a8,8,0,0,0,0,16h97a32,32,0,0,0,62,0h17a8,8,0,0,0,0-16Zm-48,24a16,16,0,1,1,16-16A16,16,0,0,1,168,192Z" />
    </svg>
  )
}

// ─── Карточка отеля ───────────────────────────────────────────────────────────

/**
 * «Не нашли подходящее» — выход для того, кто пролистал выдачу впустую.
 *
 * Стоит в конце списка и в обеих пустых выдачах: это те два места, где человек
 * закрывал вкладку. Заявка уходит в CRM так же, как бронь, только менеджер
 * подбирает руками.
 */
function HelpCta({ onClick }: { onClick: () => void }) {
  return (
    <div className={styles.helpCta}>
      <div className={styles.helpCtaText}>
        <div className={styles.helpCtaTitle}>Не нашли подходящий тур?</div>
        <div className={styles.helpCtaHint}>
          Здесь только то, что операторы отдали в поиск. Расскажите, что нужно, —
          менеджер подберёт вариант вручную и поможет забронировать.
        </div>
      </div>
      <button type="button" className={styles.helpCtaBtn} onClick={onClick}>
        Помогите подобрать
      </button>
    </div>
  )
}

/**
 * Всегда доступный вход в подбор.
 *
 * Карточка в конце списка ловит только тех, кто пролистал выдачу до конца.
 * Человеку, который с первого экрана понял, что хочет другого, идти было
 * некуда. Ярлык висит у правого края и не занимает места в раскладке.
 *
 * Отсчитывается от оболочки .toursPage, а не от вьюпорта: во фрейме fixed
 * зацепился бы за высоту растянутого фрейма и уехал бы за экран.
 */
function HelpTab({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className={styles.helpTab}
      onClick={onClick}
      aria-label="Помогите подобрать тур"
    >
      {/* Без иконки. Ярлычок вертикальный, а значок в него не поворачивается —
          самолётик лежал поперёк надписи и цеплял глаз. Текста здесь довольно:
          он и так говорит, что будет по нажатию. */}
      <span className={styles.helpTabLabel}>Подобрать тур</span>
    </button>
  )
}

/**
 * Галерея карточки: первое фото из выдачи, остальные — по требованию.
 *
 * Первый кадр приходит вместе со списком, поэтому карточка рисуется сразу и
 * без единого запроса. Остальные два десятка лежат в отдельном запросе на
 * отель — за ними идём только когда человек начал листать. Иначе сотня
 * карточек в списке разом упёрлась бы в лимит эндпоинта, а листают единицы.
 */
function HotelGallery({ hotel, onOpen }: { hotel: HotelSearchResult; onOpen: () => void }) {
  const first = hotel.picturelink
  const [photos, setPhotos] = useState<string[]>(() => cachedPhotos(hotel.id) ?? (first ? [first] : []))
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const touchX = useRef<number | null>(null)
  // Длину читаем из ref: сразу после загрузки состояние ещё старое, и
  // перемотка считала бы остаток по одному кадру.
  const photosRef = useRef<string[]>(photos)
  useEffect(() => { photosRef.current = photos }, [photos])

  // Список поменялся (новый поиск) — начинаем с первого кадра.
  useEffect(() => {
    const start = cachedPhotos(hotel.id) ?? (first ? [first] : [])
    setPhotos(start)
    photosRef.current = start
    setIndex(0)
  }, [hotel.id, first])

  /** Подтянуть остальные кадры. Вызываем при первом же намерении листать. */
  const ensurePhotos = useCallback(async () => {
    if (cachedPhotos(hotel.id) || loading) return
    setLoading(true)
    const list = await loadPhotos(hotel.id)
    setLoading(false)
    if (list.length > 1) {
      // Кадр из выдачи и первый из галереи — разные файлы одного отеля.
      // Показываем галерею целиком, начиная с того же места.
      setPhotos(list)
      photosRef.current = list
      setIndex(0)
    }
  }, [hotel.id, loading])

  const move = useCallback((delta: number) => {
    setIndex(i => {
      const n = photosRef.current.length
      if (n < 2) return 0
      return (i + delta + n) % n
    })
  }, [])

  /**
   * Шаг по галерее.
   *
   * Дожидаемся загрузки, а потом листаем: если двигать сразу, первый клик
   * уходит в пустоту — кадров ещё один, перематывать нечего, и человеку
   * приходится жать дважды.
   */
  const step = useCallback(async (delta: number) => {
    await ensurePhotos()
    move(delta)
  }, [ensurePhotos, move])

  if (!first && photos.length === 0) {
    return <div className={styles.hotelThumbPlaceholder}><HotelGlyph /></div>
  }

  const many = photos.length > 1

  return (
    <div
      className={styles.hotelGallery}
      onPointerEnter={() => { void ensurePhotos() }}
      onTouchStart={e => { touchX.current = e.touches[0].clientX; void ensurePhotos() }}
      onTouchEnd={e => {
        if (touchX.current == null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        touchX.current = null
        if (Math.abs(dx) > 30) void step(dx < 0 ? 1 : -1)
      }}
    >
      <img
        src={photos[index] ?? first}
        alt={hotel.name}
        className={styles.hotelThumb}
        loading="lazy"
        onClick={e => { e.stopPropagation(); onOpen() }}
      />

      {many && (
        <>
          <button
            type="button"
            className={`${styles.galleryArrow} ${styles.galleryArrowPrev}`}
            onClick={e => { e.stopPropagation(); void step(-1) }}
            aria-label="Предыдущее фото"
          >‹</button>
          <button
            type="button"
            className={`${styles.galleryArrow} ${styles.galleryArrowNext}`}
            onClick={e => { e.stopPropagation(); void step(1) }}
            aria-label="Следующее фото"
          >›</button>
          {/* Точек столько же, сколько кадров, но не больше восьми: у отеля
              бывает за двадцать снимков, и лента точек превращалась в кашу. */}
          <div className={styles.galleryDots} aria-hidden="true">
            {photos.slice(0, 8).map((_, i) => (
              <span
                key={i}
                className={`${styles.galleryDot} ${i === Math.min(index, 7) ? styles.galleryDotOn : ''}`}
              />
            ))}
          </div>
          <div className={styles.galleryCount}>{index + 1}/{photos.length}</div>
        </>
      )}

      {/* Пока не листали — одна стрелка вперёд как приглашение. */}
      {!many && hotel.hasPictures && (
        <button
          type="button"
          className={`${styles.galleryArrow} ${styles.galleryArrowNext}`}
          onClick={e => { e.stopPropagation(); void step(1) }}
          aria-label="Показать фотографии"
        >›</button>
      )}
    </div>
  )
}

function HotelCard({
  hotel,
  selected,
  onSelect,
  onOpen,
}: {
  hotel: HotelSearchResult
  selected: boolean
  /** Тап по карточке — выделить и показать отель на карте. */
  onSelect: () => void
  /** «Смотреть» — открыть карточку отеля с номерами и бронированием. */
  onOpen: () => void
}) {
  const bestTour = hotel.tours[0]

  const ratingClass = hotel.rating >= 4
    ? styles.hotelCardRatingHigh
    : hotel.rating >= 3
      ? styles.hotelCardRatingMid
      : styles.hotelCardRatingLow

  // Карточка на десктопе стала вдвое шире, и прежних трёх строк ей не хватало:
  // середина пустовала. Досыпаем то, что уже пришло в выдаче, без лишних
  // запросов.
  //
  // Показываем только то, что описывает отель целиком либо ту же самую
  // «от»-цену. Номер и тип перелёта сюда не годятся: они у каждого тура свои,
  // а в карточке их несколько — вынесенный наверх номер самого дешёвого
  // выглядел бы как единственный доступный. Дата заезда остаётся: она
  // относится к тому же предложению, что цена и число ночей рядом.
  const specs: string[] = []
  if (hotel.seaDistance && hotel.seaDistance > 0)
    specs.push(`${hotel.seaDistance} м до пляжа`)
  if (bestTour?.date) {
    const start = parseTourDate(bestTour.date)
    if (start) specs.push(`заезд ${formatDateShort(start)}`)
  }

  // Сколько всего вариантов внутри отеля: подсказывает, есть ли смысл заходить.
  const tourCount = hotel.tours.length

  return (
    // Карточка была <div onClick> — с клавиатуры отель нельзя было открыть вовсе.
    <article
      data-hotel-id={hotel.id}
      className={`${styles.hotelCard} ${selected ? styles.hotelCardSelected : ''}`}
      onClick={onSelect}
    >
      <div className={styles.hotelThumbWrap}>
        <HotelGallery hotel={hotel} onOpen={onOpen} />
      </div>

      <div className={styles.hotelCardBody}>
        {/* Звёзды были наложены на фотографию: 0.75rem оранжевым поверх
            снимка, и на светлых кадрах их не было видно. А звёздность
            читают первой, до цены — место ей в тексте. */}
        {hotel.category > 0 && (
          <div className={styles.hotelCardStars} aria-label={`${hotel.category} звёзд`}>
            {stars(hotel.category)}
          </div>
        )}
        <div className={styles.hotelCardTitleRow}>
          <div className={styles.hotelCardName}>{hotel.name}</div>
          {hotel.rating > 0 && (
            <span className={`${styles.hotelCardRatingPill} ${ratingClass}`}>
              {hotel.rating.toFixed(1)}
            </span>
          )}
        </div>

        {(hotel.subRegion?.name || hotel.region?.name) && (
          <div className={styles.hotelCardLocation}>
            <PinGlyph />
            <span>{hotel.subRegion?.name ?? hotel.region?.name}</span>
          </div>
        )}

        {/* Описание приходит в выдаче у всех отелей (замер: 185 из 185) и
            относится к отелю целиком, а не к одному варианту. Показываем
            только на десктопе: там карточка широкая и середина пустует, а на
            телефоне она и без того плотная — см. .hotelCardDesc в стилях. */}
        {hotel.hotelDescription && (
          <div className={styles.hotelCardDesc}>{hotel.hotelDescription}</div>
        )}

        {specs.length > 0 && (
          <div className={styles.hotelCardSpecs}>
            {specs.map(s => (
              <span key={s} className={styles.hotelCardSpec}>{s}</span>
            ))}
          </div>
        )}

        <div className={styles.hotelCardDivider} />

        {bestTour?.meal?.fullName && (
          <div>
            <span className={styles.hotelCardMealBadge}>
              {bestTour.meal.fullName}
            </span>
          </div>
        )}

        <div className={styles.hotelCardFooter}>
          <div className={styles.hotelCardPriceBlock}>
            <div className={styles.hotelCardPriceFrom}>от</div>
            <div className={styles.hotelCardPrice}>
              {hotel.price.toLocaleString('ru-RU')} ₽
            </div>
            {bestTour?.nights && (
              <div className={styles.hotelCardNights}>
                {nightsLabel(bestTour.nights)}
                {tourCount > 1 && ` · ${tourCount} ${variantsWord(tourCount)}`}
              </div>
            )}
          </div>
          <button
            type="button"
            className={styles.hotelCardBookBtn}
            onClick={e => { e.stopPropagation(); onOpen() }}
            aria-label={`Смотреть туры: ${hotel.name}`}
          >
            Смотреть
          </button>
        </div>
      </div>
    </article>
  )
}

// ─── Мини-карта в модалке ─────────────────────────────────────────────────────

function HotelMiniMap({ lat, lng }: { lat: number; lng: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<any>(null)

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? ''
    if (!apiKey || !containerRef.current) return
    let cancelled = false

    const w = window as any
    const init = (ym: any) => {
      if (cancelled || !containerRef.current) return
      const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = ym
      const map = new YMap(
        containerRef.current,
        { location: { center: [lng, lat], zoom: 14 } },
        [new YMapDefaultSchemeLayer(), new YMapDefaultFeaturesLayer()],
      )
      const el = document.createElement('div')
      el.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#e8272a;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4)'
      map.addChild(new YMapMarker({ coordinates: [lng, lat] }, el))
      mapRef.current = map
    }

    if (w.ymaps3) {
      w.ymaps3.ready.then(() => init(w.ymaps3))
    } else {
      const t = setInterval(() => {
        if (w.ymaps3) { clearInterval(t); w.ymaps3.ready.then(() => init(w.ymaps3)) }
      }, 100)
      setTimeout(() => clearInterval(t), 15000)
    }

    return () => {
      cancelled = true
      try { mapRef.current?.destroy?.() } catch {}
      mapRef.current = null
    }
  }, [lat, lng])

  return <div ref={containerRef} className={styles.miniMapWrap} />
}

// ─── Flight UI components ─────────────────────────────────────────────────────

function FlightLegRow({ leg, dir }: { leg: FlightLeg; dir: string }) {
  const cls = leg.cls === 'C' ? 'бизнес' : 'эконом'
  return (
    <div className={styles.flightRow}>
      <span className={styles.flightRowDir}>{dir}</span>
      <div className={styles.flightRowBody}>
        <div className={styles.flightRowTop}>
          <span className={styles.flightRoute}>
            {leg.depPort} {leg.depTime} → {leg.arrPort} {leg.arrTime}
          </span>
          <span className={styles.flightDate}>{fmtFlightDate(leg.depDate)}</span>
        </div>
        <div className={styles.flightRowMeta}>
          {leg.companyLogo && (
            <img src={leg.companyLogo} alt={leg.companyName} className={styles.airlineLogo} />
          )}
          <span className={styles.flightTag}>{leg.companyName} {leg.number}</span>
          {leg.plane && <span className={styles.flightTag}>{leg.plane}</span>}
          <span className={styles.flightTag}>{cls}</span>
          {/* Ноль здесь означает «оператор не указал», а не «багажа нет».
              Замер: у всех 122 вариантов baggage=0 и carryOn пустой. Раньше
              мы на этом основании писали «ручная кладь» — то есть уверенно
              сообщали, что багаж не входит, хотя данных об этом нет. */}
          <span className={styles.flightTag}>
            {leg.baggage > 0 ? `багаж ${leg.baggage} кг` : 'багаж не указан'}
          </span>
        </div>
      </div>
    </div>
  )
}

function FlightSkeleton() {
  return (
    <div className={styles.flightSkeleton}>
      <div className={styles.skeletonLine} style={{ width: '78%' }} />
      <div className={styles.skeletonLine} style={{ width: '55%' }} />
      <div className={styles.skeletonLine} style={{ width: '78%', marginTop: 8 }} />
      <div className={styles.skeletonLine} style={{ width: '60%' }} />
    </div>
  )
}

/**
 * Загрузка в модалке. Раньше здесь крутился спиннер, у рейсов был скелетон,
 * а у списка — прогресс-бар: три разных языка для одного состояния.
 * Форма контента известна заранее, поэтому везде скелетон.
 */
function BlockSkeleton({ lines = 3 }: { lines?: number }) {
  const widths = ['92%', '78%', '85%', '64%', '88%']
  return (
    <div className={styles.flightSkeleton} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={styles.skeletonLine} style={{ width: widths[i % widths.length] }} />
      ))}
    </div>
  )
}

// ─── Группа «номер + туры» ────────────────────────────────────────────────────

interface RoomGroup {
  roomId: number
  room: HotelRoom | null
  name: string
  tours: TourSummary[]
}

function RoomTourGroup({
  group,
  bookTourId,
  onSelectTour,
  onOpenLightbox,
  searchId,
}: {
  group: RoomGroup
  bookTourId: string | null
  onSelectTour: (id: string | null) => void
  onOpenLightbox: (imgs: string[], idx: number) => void
  searchId: string
}) {
  const [listExpanded, setListExpanded] = useState(false)
  const [expandedTourId, setExpandedTourId] = useState<string | null>(null)
  const [flightCache, setFlightCache] = useState<Record<string, FlightEntry>>({})
  const fetchedRef = useRef<Set<string>>(new Set())

  const { room, name, tours } = group
  // Три строки, как у «Слетать» и Level.Travel: они прячут остальное за одной
  // ссылкой и умещают сотню туров в экран. У нас каждый тур был своей строкой,
  // отсюда и стена. Пять — уже перебор, потому что оператора мы не выводим и
  // соседние строки отличаются только ценой.
  const VISIBLE_TOURS = 3
  const shown = listExpanded ? tours : tours.slice(0, VISIBLE_TOURS)

  // Сравнимость: при десяти строках выбор превращался в чтение столбика чисел.
  // Помечаем самый дешёвый и показываем, на сколько дороже каждый следующий.
  const minPrice = tours.length ? Math.min(...tours.map(t => t.price)) : 0

  // Fetch flight details when a tour row is expanded
  useEffect(() => {
    if (!expandedTourId || !searchId) return
    if (!group.tours.some(t => t.id === expandedTourId)) return
    if (fetchedRef.current.has(expandedTourId)) return
    fetchedRef.current.add(expandedTourId)
    setFlightCache(c => ({ ...c, [expandedTourId]: { st: 'loading' } }))
    staffFetch(`/api/tourvisor/tours/${expandedTourId}/flights`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        const parsed = parseFlightsResponse(data)
        setFlightCache(c => ({ ...c, [expandedTourId]: { st: 'ok', ...parsed } }))
      })
      .catch(() => {
        setFlightCache(c => ({ ...c, [expandedTourId]: { st: 'error' } }))
      })
  }, [expandedTourId, searchId, group.tours])

  return (
    <div className={styles.roomBlock}>
      {/* Шапка номера */}
      <div className={styles.roomBlockHead}>
        <div
          className={styles.roomBlockThumbWrap}
          onClick={room?.images?.[0] ? () => onOpenLightbox(room!.images, 0) : undefined}
          style={{ cursor: room?.images?.[0] ? 'zoom-in' : 'default' }}
        >
          {room?.images?.[0] ? (
            <>
              <img src={room.images[0]} alt={name} className={styles.roomBlockThumb} />
              {room.images.length > 1 && (
                <span className={styles.roomBlockThumbCount}>{room.images.length} фото</span>
              )}
            </>
          ) : (
            <div className={styles.roomBlockThumbPlaceholder}><BedGlyph /></div>
          )}
        </div>
        <div className={styles.roomBlockInfo}>
          <div className={styles.roomBlockName}>{name}</div>
          {room && (
            <div className={styles.roomBlockMeta}>
              {room.area != null && <span>{room.area} м²</span>}
              {/* Число комнат приходило в данных, но не выводилось: «2 комнаты,
                  55 м²» отвечает на вопрос о номере лучше, чем одна площадь. */}
              {room.roomCount != null && room.roomCount > 1 && (
                <span>{room.roomCount} комн.</span>
              )}
              {room.bedroomCount != null && room.bedroomCount > 0 && (
                <span>{room.bedroomCount} спал.</span>
              )}
              {/* Балкон и кухня больше не дублируем отдельными плашками: они и
                  так входят в список услуг ниже, который раньше не выводился
                  вовсе. Две плашки из десятка пунктов только сбивали. */}
            </div>
          )}
          <div className={styles.roomBlockMinPrice}>от {formatPrice(tours[0].price)}</div>
        </div>
      </div>

      {/* Описание номера (HTML из Tourvisor) */}
      {room && (room.sleepingPlaces || room.description || room.comment
                || room.services || room.location || room.viewDescription) && (
        <div className={styles.roomDesc}>
          {room.sleepingPlaces && (
            <div dangerouslySetInnerHTML={{ __html: room.sleepingPlaces }} />
          )}
          {/* Услуги номера приходили всегда и не показывались ни разу: «Балкон,
              Кухня, Мягкая мебель, Шкаф или гардероб…». Именно по ним человек
              и выбирает между номерами одного отеля. */}
          {room.services && (
            <div className={styles.roomServices}>
              <div className={styles.roomDescLabel}>В номере</div>
              <div dangerouslySetInnerHTML={{ __html: room.services }} />
            </div>
          )}
          {room.location && (
            <div><span className={styles.roomDescLabel}>Расположение</span>{' '}
              <span dangerouslySetInnerHTML={{ __html: room.location }} /></div>
          )}
          {room.viewDescription && (
            <div><span className={styles.roomDescLabel}>Вид</span>{' '}
              <span dangerouslySetInnerHTML={{ __html: room.viewDescription }} /></div>
          )}
          {room.description && (
            <div dangerouslySetInnerHTML={{ __html: room.description }} />
          )}
          {room.comment && (
            <div dangerouslySetInnerHTML={{ __html: room.comment }} />
          )}
        </div>
      )}

      {/* Туры для этого номера */}
      <div className={styles.roomToursList}>
        {shown.map(tour => {
          const selected = bookTourId === tour.id
          const isExpanded = expandedTourId === tour.id
          // При одном взрослом «₽/чел» дословно повторяет общую цену — на SGL
          // в строке стояли два одинаковых числа подряд.
          const perPerson = tour.adults > 1 ? Math.round(tour.price / tour.adults) : null
          const flight = flightCache[tour.id]
          return (
            <Fragment key={tour.id}>
              {/* Строку раскрывала обёртка <div onClick>. Кнопку в кнопку вложить
                  нельзя, поэтому раскрытие повесили на левую половину, а «Выбрать»
                  осталось отдельной кнопкой — обе доступны с клавиатуры. */}
              <div
                className={`${styles.roomTourRow} ${selected ? styles.roomTourRowSelected : ''} ${isExpanded ? styles.roomTourRowExpanded : ''}`}
              >
                <button
                  type="button"
                  className={styles.roomTourLeft}
                  onClick={() => setExpandedTourId(prev => prev === tour.id ? null : tour.id)}
                  aria-expanded={isExpanded}
                  aria-label={`${formatDateRange(tour.date, tour.nights)}, ${nightsLabel(tour.nights)} — показать рейс`}
                >
                  <span className={styles.tourDate}>{formatDateRange(tour.date, tour.nights)}</span>
                  <span className={styles.tourNights}>{nightsLabel(tour.nights)}</span>
                  {(tour.meal?.fullName || tour.meal?.name) && (
                    <span className={styles.tourMealBadge}>
                      {tour.meal.fullName || tour.meal.name}
                    </span>
                  )}
                  {tour.name && (
                    <span className={styles.tourIncludedBadge} title={tour.name}>
                      <PlaneGlyph /> {tour.name}
                    </span>
                  )}
                  {tour.placement && (
                    <span className={styles.tourRoomTag}>{tour.placement}</span>
                  )}
                  {/* Тип перелёта есть в фильтрах, а в самой строке его не было:
                      человек отбирал по нему и не видел, что выбрал. */}
                  <span className={styles.tourRoomTag}>
                    {tour.isCharter ? 'чартер' : 'регуляр'}
                  </span>
                </button>
                <div className={styles.roomTourRight}>
                  <div className={styles.tourPriceGroup}>
                    <div className={styles.tourPrice}>{formatPrice(tour.price)}</div>
                    {perPerson && (
                      <div className={styles.tourPricePerPerson}>
                        {perPerson.toLocaleString('ru-RU')} ₽/чел
                      </div>
                    )}
                    {tour.price === minPrice ? (
                      <div className={styles.tourCheapest}>самый дешёвый</div>
                    ) : (
                      <div className={styles.tourDiff}>
                        +{(tour.price - minPrice).toLocaleString('ru-RU')} ₽
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className={`${styles.tourSelectBtn} ${selected ? styles.tourSelectBtnActive : ''}`}
                    aria-pressed={selected}
                    onClick={e => {
                      e.stopPropagation()
                      const next = selected ? null : tour.id
                      onSelectTour(next)
                      if (next) setExpandedTourId(next)
                    }}
                  >
                    {selected ? '✓ Выбран' : 'Выбрать'}
                  </button>
                </div>
              </div>

              {/* Детали рейса — для развёрнутого тура */}
              {isExpanded && (
                <div className={styles.flightDetails} onClick={e => e.stopPropagation()}>
                  <div className={styles.flightDetailsLabel}>Рейс</div>
                  {!flight || flight.st === 'loading' ? (
                    <FlightSkeleton />
                  ) : flight.st === 'error' ? (
                    <span className={styles.flightError}>Данные недоступны</span>
                  ) : (
                    <>
                      {flight.forward  && <FlightLegRow leg={flight.forward}  dir="Туда" />}
                      {flight.backward && <FlightLegRow leg={flight.backward} dir="Обратно" />}
                      {!flight.forward && !flight.backward && (
                        <span className={styles.flightError}>Данные рейса не получены</span>
                      )}
                      {/* У оператора обычно не один рейс, и выбор меняет цену
                          тура — на замере разброс составил 16 682 ₽. Раньше об
                          этом не говорилось ничего, и показанный рейс читался
                          как единственно возможный. */}
                      {flight.options > 1 && (
                        <div className={styles.flightAlt}>
                          У оператора {flight.outboundCount} {variantsWord(flight.outboundCount)} вылета
                          {flight.inboundCount > 1 ? ` и ${flight.inboundCount} обратно` : ''}
                          {flight.priceFrom != null && flight.priceTo != null && flight.priceTo > flight.priceFrom
                            ? `, от ${formatPrice(flight.priceFrom)} до ${formatPrice(flight.priceTo)}`
                            : ' по той же цене'}
                          . Удобное время подберёт менеджер.
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </Fragment>
          )
        })}
        {tours.length > VISIBLE_TOURS && (
          <button
            className={styles.showMoreToursBtn}
            onClick={() => setListExpanded(v => !v)}
          >
            {listExpanded
              ? 'Свернуть ↑'
              : `Ещё ${tours.length - VISIBLE_TOURS} ${toursWord(tours.length - VISIBLE_TOURS)} ↓`}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Модалка отеля ────────────────────────────────────────────────────────────

function HotelModal({
  hotel,
  onClose,
  searchId,
}: {
  hotel: HotelSearchResult
  onClose: () => void
  searchId: string
}) {
  const [desc, setDesc]           = useState<HotelDescription | null>(null)
  const [loading, setLoading]     = useState(true)
  const [activeImg, setActiveImg] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxImages, setLightboxImages] = useState<string[]>([])
  const [lightboxIdx, setLightboxIdx] = useState(0)
  const lightboxThumbsRef = useRef<HTMLDivElement>(null)
  const roomsSectionRef   = useRef<HTMLDivElement>(null)
  const [rooms, setRooms] = useState<HotelRoom[]>([])
  const [roomsLoading, setRoomsLoading] = useState(false)
  const [bookTourId, setBookTourId] = useState<string | null>(null)
  const [bookFormOpen, setBookFormOpen] = useState(false)
  const [operatorLink, setOperatorLink] = useState<string | null>(null)
  const [bookName, setBookName]   = useState('')
  const [bookPhone, setBookPhone] = useState('')
  const [bookSubmitting, setBookSubmitting] = useState(false)
  const [bookError, setBookError] = useState('')
  const [bookDone, setBookDone]   = useState(false)

  const images: string[] = desc?.images?.length
    ? desc.images
    : hotel.picturelink ? [hotel.picturelink] : []

  const prevImg = () => setActiveImg(i => (i - 1 + images.length) % images.length)
  const nextImg = () => setActiveImg(i => (i + 1) % images.length)

  // Группируем туры по номеру
  const roomGroups = useMemo<RoomGroup[]>(() => {
    const byRoom: Record<number, TourSummary[]> = {}
    for (const tour of hotel.tours) {
      const key = tour.roomId != null && tour.roomId > 0 ? tour.roomId : 0
      if (!byRoom[key]) byRoom[key] = []
      byRoom[key].push(tour)
    }
    return Object.entries(byRoom)
      .map(([rid, tours]) => {
        const roomId = Number(rid)
        const room = rooms.find(r => r.id === roomId) ?? null
        return {
          roomId,
          room,
          name: room?.name ?? tours[0]?.roomType ?? 'Номер',
          tours: [...tours].sort((a, b) => a.price - b.price),
        }
      })
      .sort((a, b) => a.tours[0].price - b.tours[0].price)
  }, [hotel.tours, rooms])

  const selectedTour = hotel.tours.find(t => t.id === bookTourId) ?? null
  const selectedRoomName = roomGroups.find(g => g.tours.some(t => t.id === bookTourId))?.name ?? ''

  // Загрузка описания отеля
  useEffect(() => {
    staffFetch(`/api/tourvisor/hotels/${hotel.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setDesc(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [hotel.id])

  // Загрузка номеров
  useEffect(() => {
    const ids = [...new Set(hotel.tours.map(t => t.roomId).filter((id): id is number => id != null && id > 0))].slice(0, 30)
    if (ids.length === 0) return
    setRoomsLoading(true)
    staffFetch(`/api/tourvisor/rooms?ids=${ids.join(',')}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: HotelRoom[]) => { setRooms(Array.isArray(data) ? data : []); setRoomsLoading(false) })
      .catch(() => setRoomsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotel.id])

  // Ссылка оператора при выборе тура.
  // Промис держим в ref: заявку могут отправить раньше, чем ссылка догрузится.
  const operatorLinkPromise = useRef<Promise<string | null> | null>(null)

  useEffect(() => {
    if (!bookTourId) { setOperatorLink(null); operatorLinkPromise.current = null; return }
    let cancelled = false
    const p: Promise<string | null> = staffFetch(`/api/tourvisor/tours/${bookTourId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => (data?.operatorLink ?? null) as string | null)
      .catch(() => null)
    operatorLinkPromise.current = p
    // Ответ по предыдущему туру не должен перетереть состояние текущего.
    p.then(link => { if (!cancelled) setOperatorLink(link) })
    return () => { cancelled = true }
  }, [bookTourId])

  // Клавиатура
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxOpen) setLightboxOpen(false)
        else if (bookFormOpen) setBookFormOpen(false)
        else onClose()
      }
      if (lightboxOpen) {
        if (e.key === 'ArrowLeft') setLightboxIdx(i => (i - 1 + lightboxImages.length) % lightboxImages.length)
        if (e.key === 'ArrowRight') setLightboxIdx(i => (i + 1) % lightboxImages.length)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, lightboxOpen, lightboxImages.length, bookFormOpen])

  // Скролл к активной миниатюре в лайтбоксе
  useEffect(() => {
    if (!lightboxOpen || !lightboxThumbsRef.current) return
    const el = lightboxThumbsRef.current.children[lightboxIdx] as HTMLElement | undefined
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [lightboxIdx, lightboxOpen])

  function openLightbox(imgs: string[], idx: number) {
    setLightboxImages(imgs)
    setLightboxIdx(idx)
    setLightboxOpen(true)
  }

  function scrollToRooms() {
    roomsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function handleBook(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!bookTourId || !selectedTour) return
    if (bookSubmitting) return

    const name = bookName.trim()
    const phone = bookPhone.trim()
    if (name.length < 2) {
      setBookError('Укажите, как к вам обращаться — хотя бы имя.')
      return
    }
    if (!isPhoneComplete(phone)) {
      setBookError('Проверьте телефон: нужны 11 цифр, например +7 999 123-45-67.')
      return
    }

    setBookSubmitting(true)
    setBookError('')

    // Ссылка оператора могла ещё не догрузиться — ждём её, но не дольше 3 с.
    const link = operatorLink ?? await Promise.race([
      operatorLinkPromise.current ?? Promise.resolve(null),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 3000)),
    ])

    try {
      const res = await staffFetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tourId: bookTourId,
          name,
          phone,
          tour: (() => {
            const start = parseTourDate(selectedTour.date)
            const end = start ? new Date(start.getTime() + selectedTour.nights * 86400000) : null
            const fmt = (d: Date) =>
              `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
            const fmtIso = (d: Date) =>
              `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            return {
              hotel: hotel.name,
              hotelStars: hotel.category,
              hotelRating: hotel.rating,
              country: hotel.country?.name,
              region: hotel.subRegion?.name ?? hotel.region?.name,
              meal: selectedTour.meal?.fullName || selectedTour.meal?.name,
              nights: selectedTour.nights,
              dateStart: start ? fmt(start) : selectedTour.date,
              dateEnd: end ? fmt(end) : null,
              dateStartIso: start ? fmtIso(start) : null,
              price: selectedTour.price,
              adults: selectedTour.adults,
              childs: selectedTour.childs,
              placement: selectedTour.placement,
              flightProgram: selectedTour.name,
              isCharter: selectedTour.isCharter,
              operator: selectedTour.operator?.russianName || selectedTour.operator?.name,
              operatorLink: link,
            }
          })(),
        }),
      })
      if (!res.ok) throw new Error(await leadErrorMessage(res))
      reachGoal(StaffGoals.leadSuccess, {
        hotel: hotel.name,
        price: selectedTour.price,
        nights: selectedTour.nights,
      })
      setBookDone(true)
    } catch (err) {
      reachGoal(StaffGoals.leadFail)
      setBookError(err instanceof Error ? err.message : LEAD_FALLBACK_ERROR)
    } finally {
      setBookSubmitting(false)
    }
  }

  const facts: { label: string; value: string }[] = []
  if (hotel.seaDistance && hotel.seaDistance > 0)
    facts.push({ label: 'До моря', value: `${hotel.seaDistance} м` })
  if (desc?.common?.build)
    facts.push({ label: 'Год постройки', value: desc.common.build })
  if (desc?.common?.repair)
    facts.push({ label: 'Обновлён', value: desc.common.repair })
  if (desc?.common?.square)
    facts.push({ label: 'Площадь', value: `${desc.common.square} м²` })

  // Всё, что Tourvisor знает об отеле. Порядок — от «что это вообще за отель»
  // к деталям. Пустые блоки отсеиваются: у разных отелей заполнены разные поля.
  /**
   * Разделы карточки.
   *
   * Всё лежало одним свитком: номера, а следом двенадцать описательных блоков,
   * контакты и карта. Отсюда и ощущение переполненности — не от строк с
   * турами, а от того, что на экране сразу всё.
   *
   * Так же разведено у «Слетать» («Номера · Описание и услуги · На карте ·
   * Отзывы») и у Level.Travel, где описание вынесено на отдельный экран.
   * Берём вариант «Слетать»: переключение внутри карточки, без лишнего
   * перехода — портал служебный, лишние клики тут не нужны.
   *
   * Это разделы, а не шаги мастера: выбор тура нелинеен — человек смотрит
   * цену, уходит к описанию, возвращается, меняет дату. Порядок ему навязывать
   * незачем.
   */
  type ModalTab = 'rooms' | 'about' | 'map'
  const [tab, setTab] = useState<ModalTab>('rooms')

  const rawSections: [title: string, html: string | undefined][] = [
    ['Об отеле',                desc?.common?.description],
    ['Расположение',            desc?.common?.place],
    ['Инфраструктура',          desc?.infrastructure?.territory],
    ['Пляж',                    desc?.infrastructure?.beach],
    ['Питание',                 desc?.meals?.description],
    ['Типы питания',            desc?.meals?.list],
    ['Услуги отеля',            desc?.services?.available],
    ['Бесплатно',               desc?.services?.free],
    ['За дополнительную плату', desc?.services?.servicesPay],
    ['В номере',                desc?.services?.inRoom],
    ['Детям',                   desc?.services?.child],
    ['Анимация и развлечения',  desc?.services?.animation],
  ]

  const descSections = rawSections.flatMap(([title, html]) =>
    html && html.trim() ? [{ title, html }] : [])

  const site = desc?.common?.site
  const contacts: { label: string; value: string; href?: string }[] = []
  if (desc?.common?.address) {
    contacts.push({ label: 'Адрес', value: desc.common.address })
  }
  if (desc?.common?.phone) {
    contacts.push({
      label: 'Телефон',
      value: desc.common.phone,
      href: `tel:${desc.common.phone.replace(/[^\d+]/g, '')}`,
    })
  }
  if (site) {
    contacts.push({
      label: 'Сайт',
      value: site,
      href: site.startsWith('http') ? site : `https://${site}`,
    })
  }

  const hasCoords = Boolean(
    hotel.latitude && hotel.longitude &&
    !(hotel.latitude === 0 && hotel.longitude === 0),
  )

  return (
    <>
      <div
        className={styles.overlay}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <div
          className={styles.modal}
          role="dialog"
          aria-modal="true"
          aria-label={`Отель ${hotel.name}`}
        >
          {/* autoFocus уводит фокус внутрь диалога — иначе после открытия
              Tab продолжал бы гулять по списку отелей за модалкой. */}
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Закрыть"
            autoFocus
          >✕</button>

          {/* ── Галерея ── */}
          {images.length > 0 && (
            <div className={styles.modalGallery}>
              <div className={styles.modalHeroWrap}>
                <img
                  src={images[activeImg]}
                  alt={hotel.name}
                  className={styles.modalHeroImg}
                  onClick={() => openLightbox(images, activeImg)}
                  style={{ cursor: 'zoom-in' }}
                />
                {images.length > 1 && (
                  <>
                    <button
                      className={`${styles.galleryNavBtn} ${styles.galleryPrev}`}
                      onClick={e => { e.stopPropagation(); prevImg() }}
                      aria-label="Предыдущее фото"
                    >‹</button>
                    <button
                      className={`${styles.galleryNavBtn} ${styles.galleryNext}`}
                      onClick={e => { e.stopPropagation(); nextImg() }}
                      aria-label="Следующее фото"
                    >›</button>
                    <div className={styles.galleryCounter}>{activeImg + 1} / {images.length}</div>
                  </>
                )}
              </div>
              {images.length > 1 && (
                <div className={styles.modalThumbs}>
                  {images.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt=""
                      className={`${styles.modalThumb} ${i === activeImg ? styles.modalThumbActive : ''}`}
                      onClick={() => setActiveImg(i)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Прокручиваемый контент ── */}
          <div className={styles.modalScroll}>

            {/* Шапка отеля */}
            <div className={styles.modalHotelHeader}>
              <div className={styles.modalHotelName}>{hotel.name}</div>
              <div className={styles.modalHotelMeta}>
                {hotel.category > 0 && (
                  <span style={{ color: '#f59e0b', marginRight: 6 }}>{stars(hotel.category)}</span>
                )}
                {hotel.rating > 0 && (
                  <span className={styles.ratingBadge} style={{ marginRight: 6 }}>
                    ★ {hotel.rating.toFixed(1)}
                  </span>
                )}
                {hotel.subRegion?.name ?? hotel.region?.name}
              </div>
            </div>

            <button className={styles.ctaScrollBtn} onClick={scrollToRooms}>
              Оставить заявку
            </button>

            {/* Факты */}
            {facts.length > 0 && (
              <div className={styles.factsGrid}>
                {facts.map(f => (
                  <div key={f.label} className={styles.factItem}>
                    <span className={styles.factLabel}>{f.label}</span>
                    <span className={styles.factValue}>{f.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Полоса разделов. Липкая, чтобы вернуться к ценам можно было с
                любого места описания, а не прокруткой обратно. */}
            <div className={styles.modalTabs} role="tablist">
              <button
                type="button" role="tab" aria-selected={tab === 'rooms'}
                className={`${styles.modalTab} ${tab === 'rooms' ? styles.modalTabOn : ''}`}
                onClick={() => setTab('rooms')}
              >
                Номера и цены
              </button>
              {/* Пока описание грузится, разделов ещё нет — но кнопку показываем
                  сразу, иначе полоса дёргалась бы, подставляя вкладку задним
                  числом под уже нацеленный палец. */}
              {(loading || descSections.length > 0 || contacts.length > 0) && (
                <button
                  type="button" role="tab" aria-selected={tab === 'about'}
                  className={`${styles.modalTab} ${tab === 'about' ? styles.modalTabOn : ''}`}
                  onClick={() => setTab('about')}
                >
                  Об отеле
                </button>
              )}
              {hasCoords && (
                <button
                  type="button" role="tab" aria-selected={tab === 'map'}
                  className={`${styles.modalTab} ${tab === 'map' ? styles.modalTabOn : ''}`}
                  onClick={() => setTab('map')}
                >
                  На карте
                </button>
              )}
            </div>

            {/* Номера идут перед описанием отеля.
                Карточку открывают, чтобы выбрать номер и забронировать, а не
                читать про инфраструктуру. Замер до перестановки: блок номеров
                начинался на 1686px при высоте модалки 2381px — 71% прокрутки,
                под десятью секциями описания. Сотрудники до него не долистывали. */}
            {/* ── Номера и туры — сгруппировано ── */}
            <div
              className={styles.modalSection}
              ref={roomsSectionRef}
              hidden={tab !== 'rooms'}
            >
              {/* Было «Номера и туры · 4», где 4 — число туров, а не номеров:
                  подпись читалась как «четыре номера». */}
              <div className={styles.modalSectionTitle}>
                Номера и даты — {toursLabel(hotel.tours.length)}
              </div>
              {roomsLoading ? (
                <BlockSkeleton lines={4} />
              ) : (
                <div className={styles.roomGroups}>
                  {roomGroups.map(group => (
                    <RoomTourGroup
                      key={group.roomId}
                      group={group}
                      bookTourId={bookTourId}
                      onSelectTour={setBookTourId}
                      onOpenLightbox={openLightbox}
                      searchId={searchId}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Описание отеля.
                Раньше здесь вручную повторялись пять почти одинаковых блоков,
                и половина того, что отдаёт Tourvisor, просто не выводилась:
                услуги отеля, что входит в номер, детская инфраструктура,
                платные услуги, анимация, контакты. Именно по ним и понятно,
                что это за отель. */}
            {loading && tab === 'about' && <BlockSkeleton lines={4} />}

            {!loading && tab === 'about' && descSections.map(section => (
              <div key={section.title} className={styles.modalSection}>
                <div className={styles.modalSectionTitle}>{section.title}</div>
                <div
                  className={styles.modalSectionText}
                  dangerouslySetInnerHTML={{ __html: section.html }}
                />
              </div>
            ))}

            {!loading && tab === 'about' && contacts.length > 0 && (
              <div className={styles.modalSection}>
                <div className={styles.modalSectionTitle}>Контакты отеля</div>
                <div className={styles.contactList}>
                  {contacts.map(c => (
                    <div key={c.label} className={styles.contactRow}>
                      <span className={styles.contactLabel}>{c.label}</span>
                      {c.href
                        ? <a className={styles.contactValue} href={c.href} target="_blank" rel="noopener noreferrer">{c.value}</a>
                        : <span className={styles.contactValue}>{c.value}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Мини-карта ── */}
            {hasCoords && tab === 'map' && (
              <div className={styles.modalSection}>
                <HotelMiniMap lat={hotel.latitude} lng={hotel.longitude} />
              </div>
            )}

          </div>

          {/* ── Sticky footer: выбранный тур ── */}
          {bookTourId && selectedTour && (
            <div className={styles.stickyFooter}>
              <div className={styles.stickyFooterInfo}>
                <div className={styles.stickyFooterRoom}>{selectedRoomName}</div>
                <div className={styles.stickyFooterDates}>
                  {formatDateRange(selectedTour.date, selectedTour.nights)}
                  {' · '}{nightsLabel(selectedTour.nights)}
                  {selectedTour.meal?.fullName && ` · ${selectedTour.meal.fullName}`}
                </div>
              </div>
              <div className={styles.stickyFooterRight}>
                <div className={styles.stickyFooterPrice}>{formatPrice(selectedTour.price)}</div>
                <button
                  type="button"
                  className={styles.stickyFooterBtn}
                  onClick={() => {
                    reachGoal(StaffGoals.bookOpen, { hotel: hotel.name })
                    setBookFormOpen(true)
                  }}
                >
                  Оставить заявку
                </button>
              </div>
            </div>
          )}

          {/* ── Оверлей формы заявки ── */}
          {bookFormOpen && (
            <div className={styles.bookingOverlay}>
              {bookDone ? (
                <div className={styles.bookingCard}>
                  <div className={styles.bookingSuccess}>
                    <div className={styles.bookingSuccessIcon}>✓</div>
                    <div className={styles.bookingSuccessTitle}>Заявка отправлена!</div>
                    <div className={styles.bookingSuccessText}>
                      Наш менеджер свяжется с вами в ближайшее время для подтверждения тура.
                    </div>
                    <button
                      className={styles.stickyFooterBtn}
                      onClick={() => { setBookFormOpen(false); setBookDone(false); setBookTourId(null) }}
                    >
                      Закрыть
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.bookingCard}>
                  <button className={styles.bookingBackBtn} onClick={() => setBookFormOpen(false)}>
                    ← Назад к турам
                  </button>
                  <div className={styles.bookingTitle}>Оставить заявку на тур</div>
                  {selectedTour && (
                    <div className={styles.bookingSummary}>
                      <div className={styles.bookingSummaryHotel}>{hotel.name}</div>
                      <div className={styles.bookingSummaryDetails}>
                        {selectedRoomName && `${selectedRoomName} · `}
                        {formatDateRange(selectedTour.date, selectedTour.nights)}
                        {' · '}{nightsLabel(selectedTour.nights)}
                        {selectedTour.meal?.fullName && ` · ${selectedTour.meal.fullName}`}
                      </div>
                      <div className={styles.bookingSummaryPrice}>{formatPrice(selectedTour.price)}</div>
                    </div>
                  )}
                  {/* Поля и кнопка были заданы инлайновыми стилями, дублировавшими
                      .input и .btn-red из globals.css с другими значениями. */}
                  <form onSubmit={handleBook} className={styles.bookingForm}>
                    <div className="field">
                      <label className="field-label" htmlFor="book-name">Ваше имя</label>
                      <input
                        id="book-name"
                        className="input"
                        type="text"
                        placeholder="Как к вам обращаться"
                        required
                        autoComplete="name"
                        value={bookName}
                        onChange={e => setBookName(e.target.value)}
                        aria-invalid={bookError ? true : undefined}
                      />
                    </div>
                    <div className="field">
                      <label className="field-label" htmlFor="book-phone">Телефон</label>
                      <input
                        id="book-phone"
                        className="input"
                        type="tel"
                        inputMode="tel"
                        placeholder="+7 999 123-45-67"
                        required
                        autoComplete="tel"
                        value={bookPhone}
                        onChange={e => setBookPhone(e.target.value)}
                        aria-invalid={bookError ? true : undefined}
                      />
                    </div>
                    {bookError && (
                      <div className={styles.bookingError} role="alert">{bookError}</div>
                    )}
                    <button
                      type="submit"
                      className="btn btn-red btn-block"
                      disabled={bookSubmitting}
                    >
                      {bookSubmitting ? 'Отправка…' : 'Отправить заявку'}
                    </button>
                  </form>
                  <div className={styles.bookingNote}>Мы свяжемся с вами в течение рабочего дня</div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Лайтбокс ── */}
      {lightboxOpen && (
        <div
          className={styles.lightboxOverlay}
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className={styles.lightboxClose}
            onClick={e => { e.stopPropagation(); setLightboxOpen(false) }}
            aria-label="Закрыть"
          >✕</button>
          <div className={styles.lightboxCounter}>{lightboxIdx + 1} / {lightboxImages.length}</div>
          <button
            className={`${styles.lightboxNavBtn} ${styles.lightboxPrev}`}
            onClick={e => { e.stopPropagation(); setLightboxIdx(i => (i - 1 + lightboxImages.length) % lightboxImages.length) }}
            aria-label="Предыдущее"
          >‹</button>
          <button
            className={`${styles.lightboxNavBtn} ${styles.lightboxNext}`}
            onClick={e => { e.stopPropagation(); setLightboxIdx(i => (i + 1) % lightboxImages.length) }}
            aria-label="Следующее"
          >›</button>
          <div className={styles.lightboxImgWrap} onClick={e => e.stopPropagation()}>
            <img src={lightboxImages[lightboxIdx]} alt={hotel.name} className={styles.lightboxImg} />
          </div>
          <div
            ref={lightboxThumbsRef}
            className={styles.lightboxThumbs}
            onClick={e => e.stopPropagation()}
          >
            {lightboxImages.map((img, i) => (
              <img
                key={i}
                src={img}
                alt=""
                className={`${styles.lightboxThumb} ${i === lightboxIdx ? styles.lightboxThumbActive : ''}`}
                onClick={() => setLightboxIdx(i)}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// ─── Основной контент ─────────────────────────────────────────────────────────

function ToursContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Страница больше не под middleware — проверяем сессию здесь (см. middleware.ts).
  const guard = useStaffGuard()
  // Оболочка не должна растягиваться вслед за высотой iframe.
  useAppHeight()

  const countryId   = Number(searchParams.get('countryId') ?? 0)
  const dateFrom    = searchParams.get('dateFrom') ?? ''
  const dateTo      = searchParams.get('dateTo') ?? ''
  const nightsFrom  = Number(searchParams.get('nightsFrom') ?? 7)
  const nightsTo    = Number(searchParams.get('nightsTo') ?? 14)
  const adults      = Number(searchParams.get('adults') ?? 2)
  const childsStr   = searchParams.get('childs') ?? ''
  const regionIds   = searchParams.getAll('regionIds')
  // Строкой — чтобы эффект поиска перезапускался при смене набора курортов.
  const regionKey   = regionIds.join(',')
  const countryName = searchParams.get('countryName') ?? ''

  // ── Поиск ──────────────────────────────────────────────────────────────────

  type Phase = 'starting' | 'searching' | 'expanding' | 'done' | 'error'
  const [phase, setPhase]       = useState<Phase>('starting')
  const [progress, setProgress] = useState(0)
  const [hotels, setHotels]     = useState<HotelSearchResult[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const searchIdRef = useRef<string | null>(null)
  const pollTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Токен запуска: в StrictMode эффект отрабатывает дважды, и без него
  // первый цикл догрузки продолжал бы крутиться параллельно со вторым.
  const runIdRef    = useRef(0)
  // Момент, к которому догрузка гарантированно закончится: от него считаем
  // остаток времени в полосе загрузки.
  const deadlineRef = useRef<number | null>(null)
  const [etaSec, setEtaSec] = useState<number | null>(null)

  // ── Фильтры ────────────────────────────────────────────────────────────────

  // ── Заявка «не нашли подходящее» ───────────────────────────────────────────
  //
  // Выдача Tourvisor — это то, что отдали операторы, а не весь рынок: часть
  // туров собирается только руками. Без этой формы человек, не увидев своего
  // варианта, просто уходил со страницы, и заявка не доходила до отдела.
  const [helpOpen, setHelpOpen]             = useState(false)
  const [helpName, setHelpName]             = useState('')
  const [helpPhone, setHelpPhone]           = useState('')
  const [helpComment, setHelpComment]       = useState('')
  const [helpSubmitting, setHelpSubmitting] = useState(false)
  const [helpDone, setHelpDone]             = useState(false)
  const [helpError, setHelpError]           = useState('')

  const [filters, setFilters]       = useState<FilterState>(DEFAULT_FILTERS)
  const [sortKey, setSortKey]       = useState<SortKey>('popular')
  const [sheetOpen, setSheetOpen]   = useState(false)
  const [showMap, setShowMap]       = useState(false)
  // В режиме карты список превращается в шторку поверх неё: свёрнута (видна
  // одна карточка) или раскрыта. Переключается тапом по ручке и прокруткой
  // самого списка — жестов перетаскивания нет.
  const [listSheetExpanded, setListSheetExpanded] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Мобильный поиск ────────────────────────────────────────────────────────

  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [mobileCountries, setMobileCountries] = useState<Country[]>([])
  const [mobileSubmitting, setMobileSubmitting] = useState(false)

  const initMobileForm = useCallback((): SearchForm => {
    // Ту же дату и гибкость показывает шапка на десктопе — считаем одинаково.
    const { targetDate, dateFlex } = dateRangeToTarget(dateFrom, dateTo)
    return {
      countryId,
      targetDate,
      dateFlex,
      nightsFrom,
      nightsTo,
      adults,
      childAges: childsStr ? childsStr.split(',').map(Number) : [],
      regionIds: regionIds.map(Number),
    }
  }, [countryId, dateFrom, dateTo, nightsFrom, nightsTo, adults, childsStr, regionKey])

  const [mobileForm, setMobileForm] = useState<SearchForm>(initMobileForm)

  // Повторный поиск ведёт на тот же маршрут /tours, только с другими
  // параметрами — страница не перемонтируется, и сбросить состояние некому.
  // Без этого шторка оставалась открытой, а кнопка навсегда залипала в
  // «Переходим…»: поиск под ней уже шёл, но пользователь этого не видел.
  // На десктопной строке поиска такой сброс уже есть (HeaderSearchBar).
  useEffect(() => {
    setMobileSheetOpen(false)
    setMobileSubmitting(false)
  }, [countryId, dateFrom, dateTo, nightsFrom, nightsTo, adults, childsStr])

  useEffect(() => {
    staffFetch('/api/tourvisor/countries')
      .then(r => r.json())
      .then(json => { if (Array.isArray(json.data)) setMobileCountries(json.data) })
      .catch(() => {})
  }, [])

  function handleMobileSearch() {
    if (!mobileForm.countryId || !mobileForm.targetDate) return
    setMobileSubmitting(true)
    reachGoal(StaffGoals.searchSubmit, {
      country_id: mobileForm.countryId,
      country: mobileCountries.find(c => c.id === mobileForm.countryId)?.name || '',
      nights_from: mobileForm.nightsFrom,
      nights_to: mobileForm.nightsTo,
      adults: mobileForm.adults,
      source: 'mobile',
    })
    const country = mobileCountries.find(c => c.id === mobileForm.countryId)
    const qs = new URLSearchParams({
      countryId: String(mobileForm.countryId),
      countryName: country?.name || '',
      // Здесь был свой offsetDate через toISOString — он уводил дату на сутки
      // в часовых поясах восточнее UTC. Берём общий помощник, он же не пускает
      // начало окна в прошлое.
      dateFrom: searchDateFrom(mobileForm.targetDate, mobileForm.dateFlex),
      dateTo: offsetDate(mobileForm.targetDate, mobileForm.dateFlex),
      nightsFrom: String(mobileForm.nightsFrom),
      nightsTo: String(mobileForm.nightsTo),
      adults: String(mobileForm.adults),
    })
    if (mobileForm.childAges.length > 0) qs.set('childs', mobileForm.childAges.join(','))
    for (const id of mobileForm.regionIds) qs.append('regionIds', String(id))
    router.push(`/tours?${qs.toString()}`)
  }

  // ── Карта / модалка ────────────────────────────────────────────────────────

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [modalHotel, setModalHotel] = useState<HotelSearchResult | null>(null)

  // Открытая карточка отеля добавляет запись в историю: без этого «назад»
  // на Android закрывал весь портал вместе с результатами поиска, которые
  // искались 20 секунд.
  const modalPushedRef = useRef(false)

  useEffect(() => {
    if (!modalHotel) return
    window.history.pushState({ staffModal: true }, '')
    modalPushedRef.current = true

    const onPop = () => {
      modalPushedRef.current = false
      setModalHotel(null)
      setSelectedId(null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [modalHotel])

  // ── Шторка списка в режиме карты ───────────────────────────────────────────

  const clearCollapseTimer = () => {
    if (collapseTimer.current) { clearTimeout(collapseTimer.current); collapseTimer.current = null }
  }

  /** Прокрутка списка сама раскрывает шторку и сама возвращает карту. */
  const handleListScroll = useCallback(() => {
    if (!showMap) return
    const el = listRef.current
    if (!el) return
    clearCollapseTimer()

    if (el.scrollTop > 4) { setListSheetExpanded(true); return }

    // Докрутили до самого верха — отдаём карту обратно. Пауза нужна, чтобы
    // шторка не складывалась от мгновенного касания нуля на отбое инерции.
    collapseTimer.current = setTimeout(() => {
      if ((listRef.current?.scrollTop ?? 1) <= 0) setListSheetExpanded(false)
    }, 260)
  }, [showMap])

  const toggleListSheet = useCallback(() => {
    const next = !listSheetExpanded
    clearCollapseTimer()
    // Свернуть прокрученный список нельзя: onScroll тут же раскрыл бы его
    // обратно. Поэтому возвращаем его в начало.
    if (!next && listRef.current) listRef.current.scrollTop = 0
    setListSheetExpanded(next)
  }, [listSheetExpanded])

  // Переключение карты/списка всегда начинает со свёрнутой шторки сверху.
  useEffect(() => {
    clearCollapseTimer()
    setListSheetExpanded(false)
    if (listRef.current) listRef.current.scrollTop = 0
  }, [showMap])

  useEffect(() => clearCollapseTimer, [])

  /**
   * Выделить отель, не открывая карточку.
   *
   * Связь карты и списка работает в обе стороны: тап по пину подсвечивает
   * карточку и подкручивает к ней список, тап по карточке подводит карту к
   * пину (см. эффект по selectedId в MapView). Открывает отель только
   * «Смотреть» — и повторный тап по уже выбранному пину.
   */
  const selectHotel = useCallback((id: number, opts?: { scrollList?: boolean }) => {
    setSelectedId(id)
    if (!opts?.scrollList) return
    // Список — свой контейнер прокрутки, поэтому block: 'nearest':
    // 'center' дёргал бы всю страницу.
    requestAnimationFrame(() => {
      listRef.current
        ?.querySelector(`[data-hotel-id="${id}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }, [])

  const openHotel = useCallback((hotel: HotelSearchResult, source?: 'map') => {
    reachGoal(StaffGoals.hotelOpen, {
      hotel: hotel.name,
      stars: hotel.category ?? 0,
      price: hotel.price ?? 0,
      ...(source ? { source } : {}),
    })
    setSelectedId(hotel.id)
    setModalHotel(hotel)
  }, [])

  const closeModal = useCallback(() => {
    // Крестик и Escape должны вести себя как «назад», иначе лишняя запись
    // остаётся в истории и кнопка «назад» перестаёт работать предсказуемо.
    if (modalPushedRef.current) {
      modalPushedRef.current = false
      window.history.back()
      return
    }
    setModalHotel(null)
    setSelectedId(null)
  }, [])

  // ── FilterOptions из батча ─────────────────────────────────────────────────

  const filterOptions = useMemo(() => computeFilterOptions(hotels), [hotels])

  // ── Отфильтрованный + отсортированный список ───────────────────────────────

  const filtered = useMemo(() => {
    const list = applyFilters(hotels, filters)
    switch (sortKey) {
      case 'popular':      return [...list].sort((a, b) =>
        ((b.rating ?? 0) - (a.rating ?? 0)) || (b.category - a.category) || (a.price - b.price))
      case 'price_asc':    return [...list].sort((a, b) => a.price - b.price)
      case 'price_desc':   return [...list].sort((a, b) => b.price - a.price)
      case 'category_desc': return [...list].sort((a, b) => b.category - a.category)
      default: return list
    }
  }, [hotels, filters, sortKey])

  const activeCnt = countActiveFilters(filters)

  // ── Polling ────────────────────────────────────────────────────────────────

  const stopPoll = useCallback(() => {
    if (pollTimer.current) { clearTimeout(pollTimer.current); pollTimer.current = null }
  }, [])

  /**
   * Курорты, встреченные в этом поиске. Копим их, чтобы по завершении
   * отправить в журнал наблюдений — он задаёт порядок чипсов в форме.
   */
  const seenRegionsRef = useRef<Set<number>>(new Set())

  /** Забирает текущую выдачу и возвращает число отелей в ней. */
  const fetchResults = useCallback(async (searchId: string): Promise<number | null> => {
    const res = await staffFetch(`/api/tourvisor/results/${searchId}?limit=${RESULTS_LIMIT}`)
    if (!res.ok) return null
    const data: HotelSearchResult[] = await res.json()
    for (const hotel of data) {
      if (hotel.region?.id) seenRegionsRef.current.add(hotel.region.id)
    }
    setHotels(data)
    return data.length
  }, [])

  // ── Старт поиска ───────────────────────────────────────────────────────────

  useEffect(() => {
    // Ждём подтверждения сессии: иначе поиск успел бы получить 401
    // и показать ошибку за мгновение до редиректа на форму входа.
    if (guard !== 'ok') return
    if (!countryId || !dateFrom || !dateTo) { router.replace('/'); return }

    const runId = ++runIdRef.current
    const alive = () => runIdRef.current === runId

    // Поиск из шапки — это router.push на тот же /tours, страница не
    // перемонтируется. Без сброса на экране осталась бы прошлая выдача,
    // а фильтры — от прошлой страны, где были другие курорты.
    setHotels([])
    setFilters(DEFAULT_FILTERS)
    setErrorMsg('')
    setProgress(0)
    setPhase('starting')
    deadlineRef.current = null
    // Курорты копим по одному поиску: без сброса в журнал ушли бы вперемешку
    // курорты прошлой страны.
    seenRegionsRef.current = new Set()

    const sleep = (ms: number) => new Promise<void>(resolve => {
      pollTimer.current = setTimeout(resolve, ms)
    })

    /** Поллит статус до конца текущего прохода, попутно доливая отели в список. */
    const waitForPass = async (searchId: string, onProgress: (p: number) => void) => {
      let misses = 0
      while (alive()) {
        const res = await staffFetch(`/api/tourvisor/status/${searchId}`)
        if (!res.ok) {
          // Сразу после старта Tourvisor ещё не знает свой searchId и отвечает
          // 404 «search not found». Это гонка, а не отказ поиска: раньше
          // повторный поиск из-за неё падал в «Поиск не удался».
          if (++misses > STATUS_MISS_LIMIT) throw new Error(`status ${res.status}`)
          await sleep(POLL_INTERVAL_MS)
          continue
        }
        misses = 0
        const status = await res.json()
        onProgress(status.progress ?? 0)

        if (status.status === 'done') return
        // Показываем промежуточную выдачу, не дожидаясь конца прохода.
        if (status.progress > 0) fetchResults(searchId).catch(() => {})
        await sleep(POLL_INTERVAL_MS)
      }
    }

    const run = async (searchId: string) => {
      const startedAt = Date.now()

      // Первый проход — до первых результатов на экране. Пауза перед первым
      // опросом: Tourvisor регистрирует поиск не мгновенно.
      setPhase('searching')
      await sleep(POLL_INTERVAL_MS)
      if (!alive()) return
      await waitForPass(searchId, p => setProgress(Math.round(p * FIRST_PASS_WEIGHT)))
      if (!alive()) return

      let count = (await fetchResults(searchId)) ?? 0
      let rounds = 0
      let stalled = 0
      let misfires = 0

      // Догрузка: каждый continue добавляет новые отели и курорты.
      // Сбой здесь не должен обнулять уже показанную выдачу — гасим ошибку
      // и заканчиваем поиск с тем, что успели загрузить.
      // Отсчёт ставим только сейчас: длительность первого прохода заранее
      // неизвестна, а бюджет догрузки — известный потолок.
      deadlineRef.current = Date.now() + EXPAND_BUDGET_MS
      setPhase('expanding')
      try {
        while (rounds < MAX_EXPAND_ROUNDS && Date.now() - startedAt < EXPAND_BUDGET_MS) {
          if (!alive()) return

          const contRes = await staffFetch(`/api/tourvisor/continue/${searchId}`)
          if (!contRes.ok) {
            // Как правило это «search not finished»: предыдущий проход ещё идёт.
            // Даём ему доработать и пробуем снова, а не обрываем догрузку.
            if (++misfires > 2) break
            await sleep(POLL_INTERVAL_MS)
            await waitForPass(searchId, () => {})
            continue
          }

          misfires = 0
          rounds++

          // Статус переключается на новый проход не мгновенно. Спросив сразу,
          // мы получим done от предыдущего прохода, уйдём на следующий continue
          // раньше времени и словим от него 400.
          await sleep(POLL_INTERVAL_MS)
          await waitForPass(searchId, () => {})
          if (!alive()) return
          // Цикл почти всегда заканчивается по исчерпанию выдачи, а не на
          // сороковом раунде, поэтому доля rounds/MAX дала бы полосу, ползущую
          // до половины и прыгающую оттуда на 100. Кривая с насыщением быстро
          // подходит к концу шкалы и никогда её не достигает, пока идёт работа;
          // сотню ставит только завершение.
          const done = 1 - 1 / (1 + rounds / 6)
          setProgress(Math.round(100 * (FIRST_PASS_WEIGHT + (1 - FIRST_PASS_WEIGHT) * done)))

          const next = (await fetchResults(searchId)) ?? count
          stalled = next > count ? 0 : stalled + 1
          count = next
          if (stalled >= EXPAND_STALL_ROUNDS) break
        }
      } catch {
        // Молча заканчиваем: отели на экране уже есть.
      }

      if (!alive()) return
      setProgress(100)
      setPhase('done')
      // Журнал наполняем только поиском по всей стране. Если человек сам
      // выбрал курорты, выдача сужена его фильтром, и записать её значило бы
      // объявить остальные курорты страны пустыми.
      if (regionIds.length === 0) {
        reportSeenRegions(countryId, dateFrom, [...seenRegionsRef.current])
      }
      reachGoal(StaffGoals.toursResults, {
        country: countryName || '',
        hotels: count,
        rounds,
      })
    }

    const params = new URLSearchParams({
      countryId: String(countryId),
      dateFrom, dateTo,
      nightsFrom: String(nightsFrom),
      nightsTo: String(nightsTo),
      adults: String(adults),
    })
    if (childsStr) params.set('childs', childsStr)
    // Курорты приходят повторяющимися параметрами и такими же уходят дальше.
    for (const id of regionIds) params.append('regionIds', id)

    staffFetch(`/api/tourvisor/search?${params}`)
      .then(r => r.ok ? r.json() : r.json().then((e: unknown) => Promise.reject(e)))
      .then(data => {
        if (!alive()) return
        const id = String(data.searchId)
        searchIdRef.current = id
        return run(id)
      })
      .catch(e => {
        if (!alive()) return
        setErrorMsg(e instanceof Error ? e.message : 'Не удалось запустить поиск')
        setPhase('error')
      })

    return () => { runIdRef.current++; stopPoll() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guard, countryId, dateFrom, dateTo, nightsFrom, nightsTo, adults, childsStr, regionKey])

  // ── Обратный отсчёт в полосе загрузки ──────────────────────────────────────

  useEffect(() => {
    if (phase !== 'expanding' || deadlineRef.current == null) { setEtaSec(null); return }
    const tick = () => setEtaSec(Math.max(0, Math.ceil((deadlineRef.current! - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [phase])

  // ── Метки ──────────────────────────────────────────────────────────────────

  const searching = phase !== 'done' && phase !== 'error'
  // Полоса нужна, только пока листать почти нечего. Дальше догрузка идёт тихо.
  const showProgressBar = searching && hotels.length > 0 && hotels.length < QUIET_AFTER_HOTELS
  // Тихая догрузка: полосы уже нет, но список ещё растёт — говорим об этом
  // одной строкой в подхедере, чтобы растущий счётчик не выглядел скачками.
  const quietLoading = searching && hotels.length >= QUIET_AFTER_HOTELS

  const phaseLabel: Record<Phase, string> = {
    starting:  'Запускаем поиск…',
    searching: 'Ищем туры…',
    // Коротко: в подхедере на мобиле длинная фраза обрезается многоточием.
    // Полная формулировка — в строке над списком.
    expanding: 'Загружаем ещё…',
    done:      `Найдено ${hotelsLabel(hotels.length)}`,
    error:     errorMsg || 'Ошибка',
  }

  // Мобильная строка поиска повторяет формулировку шапки и шторки:
  // дата заезда — дата выезда, ночи, гибкость. Раньше показывала сырое окно
  // dateFrom–dateTo, и одна и та же поездка выглядела в трёх местах по-разному.
  const searchSummary = (() => {
    const { targetDate, dateFlex } = dateRangeToTarget(dateFrom, dateTo)
    const parts = [countryName || 'Направление']
    if (targetDate) {
      parts.push(`${shortDate(targetDate)} – ${shortDate(offsetDate(targetDate, nightsTo))}`)
      parts.push(nightsLabel(nightsTo))
      if (dateFlex > 0) parts.push(flexLabel(dateFlex))
    }
    parts.push(`${adults} взр.`)
    return parts.join(' · ')
  })()

  /**
   * Заявка на подбор: человек не нашёл подходящий вариант.
   *
   * Шлём тем же маршрутом, что и обычную бронь, но с kind='help' и параметрами
   * поиска вместо тура: менеджеру важно знать, что именно человек искал в тот
   * момент, когда решил, что подходящего нет.
   */
  async function handleHelp(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (helpSubmitting) return

    const name = helpName.trim()
    const phone = helpPhone.trim()
    if (name.length < 2) {
      setHelpError('Укажите, как к вам обращаться — хотя бы имя.')
      return
    }
    if (!isPhoneComplete(phone)) {
      setHelpError('Проверьте телефон: нужны 11 цифр, например +7 999 123-45-67.')
      return
    }

    setHelpSubmitting(true)
    setHelpError('')

    try {
      const res = await staffFetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'help',
          name,
          phone,
          comment: helpComment.trim(),
          search: {
            country: countryName || undefined,
            // Та же строка, что человек видел в шапке: менеджеру не придётся
            // гадать, о каком именно окне дат идёт речь.
            dates: searchSummary,
            // Взрослые уже есть в searchSummary, а дети — нет: отдельную строку
            // шлём только ради них, иначе в описании сделки «2 взр.» повторится.
            people: childsStr
              ? `${adults} взр. + ${childsStr.split(',').length} реб.`
              : undefined,
            found: hotels.length,
          },
        }),
      })
      if (!res.ok) throw new Error(await leadErrorMessage(res))
      reachGoal(StaffGoals.leadSuccess, { kind: 'help', country: countryName || '' })
      setHelpDone(true)
    } catch (err) {
      reachGoal(StaffGoals.leadFail)
      setHelpError(err instanceof Error ? err.message : 'Не удалось отправить заявку.')
    } finally {
      setHelpSubmitting(false)
    }
  }

  function closeHelp() {
    setHelpOpen(false)
    setHelpDone(false)
    setHelpError('')
    setHelpComment('')
  }

  // Подхедер: число выводится отдельным <strong>, поэтому здесь — только хвост.
  const subheaderTail = hotels.length !== filtered.length
    ? `из ${hotelsLabel(hotels.length)} подходят фильтрам`
    : `${hotelsWord(filtered.length)} — ${countryName || 'результаты'}`

  return (
    <div className={styles.toursPage}>

      {/* ─── Хедер ───────────────────────────────────────────────────────────
          Только строка поиска, без логотипов.

          Портал живёт во фрейме под шапкой родителя, и каждая наша строка
          отнимает высоту у выдачи дважды: сначала чужая шапка, потом наша.
          Логотипы «Мои путешествия» и «Мосгортур» и так стоят в футере, а
          здесь занимали целый ряд — на телефоне это был ряд без единой
          полезной кнопки. */}
      <header className={pageStyles.siteHeader}>
        <div className="shell">
          <div className={pageStyles.headerInner}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <HeaderSearchBar
                initialCountryId={countryId}
                initialDateFrom={dateFrom}
                initialDateTo={dateTo}
                initialNightsFrom={nightsFrom}
                initialNightsTo={nightsTo}
                initialAdults={adults}
                initialChildAges={childsStr ? childsStr.split(',').map(Number) : []}
              />
            </div>
          </div>
        </div>
      </header>

      {/* ─── Мобильная строка поиска (только mobile) ────────────────────── */}
      {/* Гибкость не сбрасываем: шторка должна открываться с тем же ±, что
          показано в строке и в шапке на десктопе. */}
      <button
        type="button"
        className={styles.mobileSearchBar}
        onClick={() => { setMobileForm(initMobileForm()); setMobileSheetOpen(true) }}
        aria-haspopup="dialog"
        aria-label={`Изменить поиск: ${searchSummary}`}
      >
        <span className={styles.mobileSearchBarText}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <span>{searchSummary}</span>
        </span>
        <span className={styles.mobileSearchBarEdit} aria-hidden="true">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </span>
      </button>

      {/* ─── Прогресс-бар ────────────────────────────────────────────────── */}
      {/* Пока список пуст, экран занимает крупный лоадер — полоса включается
          только когда есть что показывать, иначе индикатора было бы два. */}
      {showProgressBar && (
        <div className={styles.searchProgressBar} role="status" aria-live="polite">
          <div
            className={styles.searchProgressFill}
            style={{ width: `${Math.max(2, progress)}%` }}
            aria-hidden="true"
          />
          {/* Уточнения в .progressWide режутся на узких экранах: там в строку
              влезает либо они, либо счётчик отелей — счётчик важнее. */}
          <span className={styles.searchProgressText}>
            <span>
              {phase === 'expanding' ? 'Загружаем' : 'Ищем'}
              <span className={styles.progressWide}>
                {phase === 'expanding' ? ' ещё предложения' : ' туры'}
              </span>
              {' — '}
              <strong>{hotelsLabel(hotels.length)}</strong>
            </span>
          </span>
          {/* Обратный отсчёт — только на первом проходе: там срок предсказуем.
              В догрузке цикл заканчивается по исчерпанию выдачи, а не по
              таймеру, и отсчёт до лимита показывал бы заведомую неправду. */}
          {etaSec != null && phase !== 'expanding' && (
            <span className={styles.searchProgressEta}>
              {etaSec > 0 ? (
                <>
                  <span className={styles.progressWide}>осталось </span>
                  ~{etaSec}
                  <span className={styles.progressWide}> {secondsWord(etaSec)}</span>
                  <span className={styles.progressNarrow}> с</span>
                </>
              ) : 'почти готово'}
            </span>
          )}
        </div>
      )}

      {/* ─── Подхедер ────────────────────────────────────────────────────── */}
      <div className={`${styles.subheader} ${showProgressBar ? styles.subheaderSearching : ''}`}>
        {/* Что происходит — говорит полоса загрузки. Подхедер отвечает только
            на вопрос «сколько сейчас в списке», в том числе по ходу догрузки. */}
        <div className={styles.subheaderCount}>
          {phase === 'error' ? (
            'Поиск не удался'
          ) : hotels.length > 0 ? (
            <>
              <strong>{filtered.length}</strong> {subheaderTail}
              {quietLoading && (
                <span className={styles.subheaderQuiet}> · загружаем ещё</span>
              )}
            </>
          ) : (
            phaseLabel[phase]
          )}
        </div>

        {/* При ошибке и при пустой выдаче сортировать и фильтровать нечего —
            раньше оба контрола оставались активными и вводили в заблуждение. */}
        {phase !== 'error' && hotels.length > 0 && (
          <>
            <select
              className={styles.sortSelect}
              value={sortKey}
              onChange={e => setSortKey(e.target.value as SortKey)}
              aria-label="Сортировка результатов"
            >
              <option value="popular">Сначала популярные</option>
              <option value="price_asc">Сначала дешевле</option>
              <option value="price_desc">Сначала дороже</option>
              <option value="category_desc">По звёздам</option>
            </select>
          </>
        )}
      </div>

      {/* ─── Тело: сайдбар + список + карта ─────────────────────────────── */}
      <div className={`${styles.body} ${showMap ? styles.bodyMapMode : ''}`}>

        <FiltersSidebar
          filters={filters}
          onChange={setFilters}
          options={filterOptions}
          filteredCount={filtered.length}
        />

        <div
          ref={listRef}
          onScroll={handleListScroll}
          className={[
            styles.listPane,
            showMap ? styles.listSheet : '',
            showMap && listSheetExpanded ? styles.listSheetExpanded : '',
          ].filter(Boolean).join(' ')}
        >

          {/* Ручка шторки: и подпись со счётчиком, и кнопка раскрытия */}
          {showMap && (
            <button
              type="button"
              className={styles.listSheetHandle}
              onClick={toggleListSheet}
              aria-expanded={listSheetExpanded}
            >
              <span className={styles.listSheetGrabber} aria-hidden="true" />
              <span className={styles.listSheetHandleLabel}>
                {listSheetExpanded ? 'Свернуть список' : hotelsLabel(filtered.length)}
              </span>
            </button>
          )}

          {searching && hotels.length === 0 ? (
            <div className={styles.searchProgress}>
              <div className={styles.spinner} />
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
              </div>
              <div className={styles.progressLabel}>{phaseLabel[phase]}</div>
              <div className={styles.progressHint}>Обычно 10–20 секунд</div>
            </div>
          ) : phase === 'error' ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateText}>Поиск не удался</div>
              <div className={styles.emptyStateHint}>
                Сервис подбора туров сейчас не отвечает. Обычно это временно —
                повторите поиск через минуту.
              </div>
              <div className={styles.emptyStateActions}>
                <button className={styles.resetFiltersBtn} onClick={() => window.location.reload()}>
                  Повторить
                </button>
                <button className={styles.emptyStateSecondaryBtn} onClick={() => router.push('/')}>
                  Новый поиск
                </button>
              </div>
            </div>
          ) : filtered.length === 0 && phase === 'done' && hotels.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateText}>
                На эти даты туров нет.
              </div>
              <div className={styles.emptyStateHint}>
                Туроператоры не отдали ни одного варианта по запросу
                {countryName ? ` «${countryName}»` : ''}. Попробуйте сдвинуть даты,
                увеличить разброс «±дней» или выбрать другое направление.
              </div>
              <div className={styles.emptyStateActions}>
                <button className={styles.resetFiltersBtn} onClick={() => router.push('/')}>
                  Изменить параметры поиска
                </button>
                <button className={styles.emptyStateSecondaryBtn} onClick={() => setHelpOpen(true)}>
                  Помогите подобрать
                </button>
              </div>
            </div>
          ) : filtered.length === 0 && phase === 'done' ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateText}>
                Под ваши фильтры не подошёл ни один отель.
              </div>
              <div className={styles.emptyStateHint}>
                Всего найдено {hotelsLabel(hotels.length)}. Ослабьте фильтры, чтобы увидеть варианты.
              </div>
              <div className={styles.emptyStateActions}>
                <button className={styles.resetFiltersBtn} onClick={() => setFilters(DEFAULT_FILTERS)}>
                  Сбросить фильтры
                </button>
                <button className={styles.emptyStateSecondaryBtn} onClick={() => setHelpOpen(true)}>
                  Помогите подобрать
                </button>
              </div>
            </div>
          ) : (
            <>
              {filtered.map(hotel => (
                <HotelCard
                  key={hotel.id}
                  hotel={hotel}
                  selected={selectedId === hotel.id}
                  onSelect={() => selectHotel(hotel.id)}
                  onOpen={() => openHotel(hotel)}
                />
              ))}
              {/* Выдача Tourvisor — это то, что отдали операторы, а не весь
                  рынок. Дойдя до конца списка и не найдя своего, человек
                  раньше просто закрывал вкладку. */}
              {phase === 'done' && <HelpCta onClick={() => setHelpOpen(true)} />}
            </>
          )}
        </div>

        <div className={`${styles.mapPane} ${showMap ? styles.mapPaneVisible : ''}`}>
          {filtered.length > 0 ? (
            <MapView
              hotels={filtered}
              selectedId={selectedId}
              // Первый тап по пину выбирает карточку, повторный по тому же —
              // открывает отель. Так у человека есть шаг осмотра перед
              // погружением, а прежний сценарий никуда не делся.
              onSelect={hotel => {
                if (selectedId === hotel.id) openHotel(hotel, 'map')
                else selectHotel(hotel.id, { scrollList: true })
              }}
            />
          ) : (
            <div className={styles.mapPlaceholder}>
              Карта появится после загрузки отелей
            </div>
          )}
        </div>
      </div>

      {/* Мобильные действия прижаты к низу, под большой палец — как «Фильтры»
          на основном сайте. Обе кнопки живут в одном ряду: раньше каждая
          центрировалась по низу экрана сама и они бы наложились. */}
      {phase !== 'error' && hotels.length > 0 && (
        <div className={styles.mobileActions}>
          <button
            type="button"
            className={styles.filtersFab}
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
          >
            <SlidersGlyph />
            Фильтры
            {activeCnt > 0 && <span className={styles.filtersFabBadge}>{activeCnt}</span>}
          </button>

          <button
            type="button"
            className={styles.mapToggleBtn}
            onClick={() => setShowMap(v => !v)}
          >
            {showMap ? <><ListGlyph /> Список</> : <><MapGlyph /> Карта</>}
          </button>
        </div>
      )}

      <FiltersBottomSheet
        filters={filters}
        onChange={setFilters}
        options={filterOptions}
        filteredCount={filtered.length}
        sheetOpen={sheetOpen}
        onSheetClose={() => setSheetOpen(false)}
        sortKey={sortKey}
        onSortChange={v => setSortKey(v as SortKey)}
      />

      {modalHotel && (
        <HotelModal
          hotel={modalHotel}
          onClose={closeModal}
          searchId={searchIdRef.current ?? ''}
        />
      )}

      {/* Ярлык подбора: доступен на любом шаге, пока форма не открыта. */}
      {!helpOpen && !modalHotel && <HelpTab onClick={() => setHelpOpen(true)} />}

      {/* ── Форма «помогите подобрать» ── */}
      {helpOpen && (
        <div className={styles.helpOverlay} onClick={closeHelp}>
          <div className={styles.helpCard} onClick={e => e.stopPropagation()}>
            {helpDone ? (
              <div className={styles.bookingSuccess}>
                <div className={styles.bookingSuccessIcon}>✓</div>
                <div className={styles.bookingSuccessTitle}>Заявка принята</div>
                <div className={styles.bookingSuccessText}>
                  Менеджер отдела свяжется с вами и подберёт варианты вручную.
                </div>
                <button className={styles.stickyFooterBtn} onClick={closeHelp}>Закрыть</button>
              </div>
            ) : (
              <>
                <button className={styles.bookingBackBtn} onClick={closeHelp}>← Назад к турам</button>
                <div className={styles.bookingTitle}>Поможем подобрать тур</div>
                <div className={styles.helpCardHint}>
                  Опишите, что нужно, — менеджер поищет за пределами онлайн-выдачи
                  и вернётся с вариантами.
                </div>

                {/* Что человек искал — уходит в заявку и без повторного ввода. */}
                <div className={styles.bookingSummary}>
                  <div className={styles.bookingSummaryDetails}>{searchSummary}</div>
                </div>

                <form onSubmit={handleHelp} className={styles.bookingForm}>
                  <div className="field">
                    <label className="field-label" htmlFor="help-name">Ваше имя</label>
                    <input
                      id="help-name" className="input" type="text" required
                      placeholder="Как к вам обращаться" autoComplete="name"
                      value={helpName} onChange={e => setHelpName(e.target.value)}
                      aria-invalid={helpError ? true : undefined}
                    />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="help-phone">Телефон</label>
                    <input
                      id="help-phone" className="input" type="tel" inputMode="tel" required
                      placeholder="+7 999 123-45-67" autoComplete="tel"
                      value={helpPhone} onChange={e => setHelpPhone(e.target.value)}
                      aria-invalid={helpError ? true : undefined}
                    />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="help-comment">Что ищете</label>
                    <textarea
                      id="help-comment" className={`input ${styles.helpTextarea}`} rows={3}
                      placeholder="Например: две недели у моря в сентябре, бюджет до 150 тысяч, нужен номер с балконом"
                      value={helpComment} onChange={e => setHelpComment(e.target.value)}
                    />
                  </div>
                  {helpError && <div className={styles.bookingError} role="alert">{helpError}</div>}
                  <button type="submit" className="btn btn-red btn-block" disabled={helpSubmitting}>
                    {helpSubmitting ? 'Отправка…' : 'Отправить заявку'}
                  </button>
                </form>
                <div className={styles.bookingNote}>Мы свяжемся с вами в течение рабочего дня</div>
              </>
            )}
          </div>
        </div>
      )}

      <MobileSearchSheet
        isOpen={mobileSheetOpen}
        onClose={() => setMobileSheetOpen(false)}
        form={mobileForm}
        countries={mobileCountries}
        popularIds={POPULAR_COUNTRY_IDS}
        onUpdate={patch => setMobileForm(p => ({ ...p, ...patch }))}
        onSubmit={handleMobileSearch}
        submitting={mobileSubmitting}
      />
    </div>
  )
}

// ─── Страница ─────────────────────────────────────────────────────────────────

export default function ToursPage() {
  return (
    <Suspense fallback={null}>
      <ToursContent />
    </Suspense>
  )
}
