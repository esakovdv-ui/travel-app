'use client'

import { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { BrandLogo, MgtBadge } from '../components/Brand'
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
import type { HotelSearchResult, HotelDescription, HotelRoom, TourSummary, TourDetail } from '@/lib/tourvisor/types'

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

type SortKey = 'price_asc' | 'price_desc' | 'rating_desc' | 'category_desc'

const POLL_INTERVAL_MS = 1500
const RESULTS_LIMIT = 500

function nightsLabel(n: number) {
  if (n === 1) return '1 ночь'
  if (n < 5) return `${n} ночи`
  return `${n} ночей`
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

type FlightEntry =
  | { st: 'loading' }
  | { st: 'error' }
  | { st: 'ok'; detail: TourDetail }

function fmtFlightDate(ds: string): string {
  if (!ds) return ''
  if (ds.includes('.')) { const [d, m] = ds.split('.').map(Number); return `${d} ${RU_MONTHS_SHORT[m - 1]}` }
  if (ds.includes('-')) { const [, m, d] = ds.split('-').map(Number); return `${d} ${RU_MONTHS_SHORT[m - 1]}` }
  return ds
}

// ─── Карточка отеля ───────────────────────────────────────────────────────────

function HotelCard({
  hotel,
  selected,
  onClick,
}: {
  hotel: HotelSearchResult
  selected: boolean
  onClick: () => void
}) {
  const bestTour = hotel.tours[0]

  const ratingClass = hotel.rating >= 4
    ? styles.hotelCardRatingHigh
    : hotel.rating >= 3
      ? styles.hotelCardRatingMid
      : styles.hotelCardRatingLow

  const specs: string[] = []
  if (hotel.seaDistance && hotel.seaDistance > 0)
    specs.push(`${hotel.seaDistance} м до пляжа`)

  return (
    <div
      className={`${styles.hotelCard} ${selected ? styles.hotelCardSelected : ''}`}
      onClick={onClick}
    >
      <div className={styles.hotelThumbWrap}>
        {hotel.picturelink ? (
          <img src={hotel.picturelink} alt={hotel.name} className={styles.hotelThumb} loading="lazy" />
        ) : (
          <div className={styles.hotelThumbPlaceholder}>🏨</div>
        )}
        {hotel.category > 0 && (
          <div className={styles.hotelStarsOverlay}>{stars(hotel.category)}</div>
        )}
      </div>

      <div className={styles.hotelCardBody}>
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
            <span>📍</span>
            <span>{hotel.subRegion?.name ?? hotel.region?.name}</span>
          </div>
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
              <div className={styles.hotelCardNights}>{nightsLabel(bestTour.nights)}</div>
            )}
          </div>
          <button
            className={styles.hotelCardBookBtn}
            onClick={e => { e.stopPropagation(); onClick() }}
          >
            Смотреть
          </button>
        </div>
      </div>
    </div>
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

function TourFlightSummary({ detail }: { detail: TourDetail }) {
  const cls = detail.flightPlace === 2 ? 'бизнес' : 'эконом'
  return (
    <div className={styles.flightRow}>
      <div className={styles.flightRowBody}>
        <div className={styles.flightRowTop}>
          <span className={styles.flightRoute}>
            {detail.departure.name} → {detail.hotel.country.name}
          </span>
          {detail.date && (
            <span className={styles.flightDate}>{fmtFlightDate(detail.date)}</span>
          )}
        </div>
        <div className={styles.flightRowMeta}>
          {detail.name && <span className={styles.flightTag}>{detail.name}</span>}
          <span className={styles.flightTag}>{detail.isCharter ? 'чартер' : 'регулярный'}</span>
          {detail.flightPlace > 0 && <span className={styles.flightTag}>{cls}</span>}
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
  const shown = listExpanded ? tours : tours.slice(0, 5)

  // Fetch flight details when a tour row is expanded
  useEffect(() => {
    if (!expandedTourId || !searchId) return
    if (!group.tours.some(t => t.id === expandedTourId)) return
    if (fetchedRef.current.has(expandedTourId)) return
    fetchedRef.current.add(expandedTourId)
    setFlightCache(c => ({ ...c, [expandedTourId]: { st: 'loading' } }))
    fetch(`/api/tourvisor/tours/${expandedTourId}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((detail: TourDetail) => {
        setFlightCache(c => ({ ...c, [expandedTourId]: { st: 'ok', detail } }))
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
            <div className={styles.roomBlockThumbPlaceholder}>🛏</div>
          )}
        </div>
        <div className={styles.roomBlockInfo}>
          <div className={styles.roomBlockName}>{name}</div>
          {room && (
            <div className={styles.roomBlockMeta}>
              {room.area != null && <span>{room.area} м²</span>}
              {room.bedroomCount != null && room.bedroomCount > 0 && (
                <span>{room.bedroomCount} спал.</span>
              )}
              {room.hasBalcony && <span>Балкон</span>}
              {room.hasKitchen && <span>Кухня</span>}
            </div>
          )}
          <div className={styles.roomBlockMinPrice}>от {formatPrice(tours[0].price)}</div>
        </div>
      </div>

      {/* Описание номера (HTML из Tourvisor) */}
      {room && (room.sleepingPlaces || room.description || room.comment) && (
        <div className={styles.roomDesc}>
          {room.sleepingPlaces && (
            <div dangerouslySetInnerHTML={{ __html: room.sleepingPlaces }} />
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
          const perPerson = tour.adults > 0 ? Math.round(tour.price / tour.adults) : null
          const flight = flightCache[tour.id]
          return (
            <Fragment key={tour.id}>
              <div
                className={`${styles.roomTourRow} ${selected ? styles.roomTourRowSelected : ''} ${isExpanded ? styles.roomTourRowExpanded : ''}`}
                onClick={() => setExpandedTourId(prev => prev === tour.id ? null : tour.id)}
              >
                <div className={styles.roomTourLeft}>
                  <span className={styles.tourDate}>{formatDateRange(tour.date, tour.nights)}</span>
                  <span className={styles.tourNights}>{nightsLabel(tour.nights)}</span>
                  {(tour.meal?.fullName || tour.meal?.name) && (
                    <span className={styles.tourMealBadge}>
                      {tour.meal.fullName || tour.meal.name}
                    </span>
                  )}
                  {tour.name && (
                    <span className={styles.tourIncludedBadge} title={tour.name}>
                      ✈ {tour.name}
                    </span>
                  )}
                  {tour.placement && (
                    <span className={styles.tourRoomTag}>{tour.placement}</span>
                  )}
                </div>
                <div className={styles.roomTourRight}>
                  <div className={styles.tourPrice}>{formatPrice(tour.price)}</div>
                  {perPerson && (
                    <div className={styles.tourPricePerPerson}>
                      {perPerson.toLocaleString('ru-RU')} ₽/чел
                    </div>
                  )}
                  <button
                    className={`${styles.tourSelectBtn} ${selected ? styles.tourSelectBtnActive : ''}`}
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
                    <TourFlightSummary detail={flight.detail} />
                  )}
                </div>
              )}
            </Fragment>
          )
        })}
        {tours.length > 5 && (
          <button
            className={styles.showMoreToursBtn}
            onClick={() => setListExpanded(v => !v)}
          >
            {listExpanded ? 'Свернуть ↑' : `Ещё ${tours.length - 5} вариантов ↓`}
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
    fetch(`/api/tourvisor/hotels/${hotel.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setDesc(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [hotel.id])

  // Загрузка номеров
  useEffect(() => {
    const ids = [...new Set(hotel.tours.map(t => t.roomId).filter((id): id is number => id != null && id > 0))].slice(0, 30)
    if (ids.length === 0) return
    setRoomsLoading(true)
    fetch(`/api/tourvisor/rooms?ids=${ids.join(',')}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: HotelRoom[]) => { setRooms(Array.isArray(data) ? data : []); setRoomsLoading(false) })
      .catch(() => setRoomsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotel.id])

  // Ссылка оператора при выборе тура
  useEffect(() => {
    if (!bookTourId) { setOperatorLink(null); return }
    fetch(`/api/tourvisor/tours/${bookTourId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setOperatorLink(data?.operatorLink ?? null))
      .catch(() => null)
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
    setBookSubmitting(true)
    setBookError('')
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tourId: bookTourId,
          name: bookName,
          phone: bookPhone,
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
              operatorLink,
            }
          })(),
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      setBookDone(true)
    } catch (err) {
      setBookError(err instanceof Error ? err.message : 'Ошибка, попробуйте ещё раз')
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
    facts.push({ label: 'Площадь', value: desc.common.square })

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
        <div className={styles.modal}>
          <button className={styles.modalClose} onClick={onClose} aria-label="Закрыть">✕</button>

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

            {/* Описание */}
            {loading && (
              <div className={styles.modalSpinner}><div className={styles.spinner} /></div>
            )}

            {!loading && desc?.common?.description && (
              <div className={styles.modalSection}>
                <div className={styles.modalSectionTitle}>Об отеле</div>
                <div
                  className={styles.modalSectionText}
                  dangerouslySetInnerHTML={{ __html: desc.common.description }}
                />
              </div>
            )}

            {!loading && desc?.common?.place && (
              <div className={styles.modalSection}>
                <div className={styles.modalSectionTitle}>Расположение</div>
                <div
                  className={styles.modalSectionText}
                  dangerouslySetInnerHTML={{ __html: desc.common.place }}
                />
              </div>
            )}

            {!loading && desc?.infrastructure?.territory && (
              <div className={styles.modalSection}>
                <div className={styles.modalSectionTitle}>Инфраструктура</div>
                <div
                  className={styles.modalSectionText}
                  dangerouslySetInnerHTML={{ __html: desc.infrastructure.territory }}
                />
              </div>
            )}

            {!loading && desc?.infrastructure?.beach && (
              <div className={styles.modalSection}>
                <div className={styles.modalSectionTitle}>Пляж</div>
                <div
                  className={styles.modalSectionText}
                  dangerouslySetInnerHTML={{ __html: desc.infrastructure.beach }}
                />
              </div>
            )}

            {!loading && desc?.meals?.description && (
              <div className={styles.modalSection}>
                <div className={styles.modalSectionTitle}>Питание</div>
                <div
                  className={styles.modalSectionText}
                  dangerouslySetInnerHTML={{ __html: desc.meals.description }}
                />
              </div>
            )}

            {/* ── Номера и туры — сгруппировано ── */}
            <div className={styles.modalSection} ref={roomsSectionRef}>
              <div className={styles.modalSectionTitle}>
                Номера и туры · {hotel.tours.length}
              </div>
              {roomsLoading ? (
                <div className={styles.modalSpinner}><div className={styles.spinner} /></div>
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

            {/* ── Мини-карта ── */}
            {hasCoords && (
              <div className={styles.modalSection}>
                <div className={styles.modalSectionTitle}>На карте</div>
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
                  className={styles.stickyFooterBtn}
                  onClick={() => setBookFormOpen(true)}
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
                  <form onSubmit={handleBook} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Ваше имя"
                      required
                      value={bookName}
                      onChange={e => setBookName(e.target.value)}
                      style={{ padding: '9px 14px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--c-border)', fontSize: '0.88rem', outline: 'none' }}
                    />
                    <input
                      type="tel"
                      placeholder="Телефон (+7...)"
                      required
                      value={bookPhone}
                      onChange={e => setBookPhone(e.target.value)}
                      style={{ padding: '9px 14px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--c-border)', fontSize: '0.88rem', outline: 'none' }}
                    />
                    {bookError && <div className={styles.bookingError}>{bookError}</div>}
                    <button
                      type="submit"
                      disabled={bookSubmitting}
                      style={{
                        padding: '10px',
                        borderRadius: 'var(--radius-pill)',
                        background: 'var(--c-red)',
                        color: '#fff',
                        border: 0,
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        cursor: bookSubmitting ? 'not-allowed' : 'pointer',
                        opacity: bookSubmitting ? 0.7 : 1,
                      }}
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

  const countryId   = Number(searchParams.get('countryId') ?? 0)
  const dateFrom    = searchParams.get('dateFrom') ?? ''
  const dateTo      = searchParams.get('dateTo') ?? ''
  const nightsFrom  = Number(searchParams.get('nightsFrom') ?? 7)
  const nightsTo    = Number(searchParams.get('nightsTo') ?? 14)
  const adults      = Number(searchParams.get('adults') ?? 2)
  const childsStr   = searchParams.get('childs') ?? ''
  const countryName = searchParams.get('countryName') ?? ''

  // ── Поиск ──────────────────────────────────────────────────────────────────

  type Phase = 'starting' | 'phase1' | 'continuing' | 'phase2' | 'done' | 'error'
  const [phase, setPhase]       = useState<Phase>('starting')
  const [progress, setProgress] = useState(0)
  const [hotels, setHotels]     = useState<HotelSearchResult[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const searchIdRef = useRef<string | null>(null)
  const pollTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Фильтры ────────────────────────────────────────────────────────────────

  const [filters, setFilters]       = useState<FilterState>(DEFAULT_FILTERS)
  const [sortKey, setSortKey]       = useState<SortKey>('price_asc')
  const [sheetOpen, setSheetOpen]   = useState(false)
  const [showMap, setShowMap]       = useState(false)

  // ── Мобильный поиск ────────────────────────────────────────────────────────

  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [mobileCountries, setMobileCountries] = useState<Country[]>([])
  const [mobileSubmitting, setMobileSubmitting] = useState(false)

  const initMobileForm = useCallback((): SearchForm => {
    return {
      countryId,
      targetDate: dateFrom || '',
      dateFlex: 0,
      nightsFrom,
      nightsTo,
      adults,
      childAges: childsStr ? childsStr.split(',').map(Number) : [],
    }
  }, [countryId, dateFrom, nightsFrom, nightsTo, adults, childsStr])

  const [mobileForm, setMobileForm] = useState<SearchForm>(initMobileForm)

  useEffect(() => {
    fetch('/api/tourvisor/countries')
      .then(r => r.json())
      .then(json => { if (Array.isArray(json.data)) setMobileCountries(json.data) })
      .catch(() => {})
  }, [])

  function handleMobileSearch() {
    if (!mobileForm.countryId || !mobileForm.targetDate) return
    setMobileSubmitting(true)
    const offsetDate = (s: string, d: number) => { const dt = new Date(s); dt.setDate(dt.getDate() + d); return dt.toISOString().split('T')[0] }
    const country = mobileCountries.find(c => c.id === mobileForm.countryId)
    const qs = new URLSearchParams({
      countryId: String(mobileForm.countryId),
      countryName: country?.name || '',
      dateFrom: offsetDate(mobileForm.targetDate, -mobileForm.dateFlex),
      dateTo: offsetDate(mobileForm.targetDate, mobileForm.dateFlex),
      nightsFrom: String(mobileForm.nightsFrom),
      nightsTo: String(mobileForm.nightsTo),
      adults: String(mobileForm.adults),
    })
    if (mobileForm.childAges.length > 0) qs.set('childs', mobileForm.childAges.join(','))
    router.push(`/tours?${qs.toString()}`)
  }

  // ── Карта / модалка ────────────────────────────────────────────────────────

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [modalHotel, setModalHotel] = useState<HotelSearchResult | null>(null)

  // ── FilterOptions из батча ─────────────────────────────────────────────────

  const filterOptions = useMemo(() => computeFilterOptions(hotels), [hotels])

  // ── Отфильтрованный + отсортированный список ───────────────────────────────

  const filtered = useMemo(() => {
    const list = applyFilters(hotels, filters)
    switch (sortKey) {
      case 'price_asc':    return [...list].sort((a, b) => a.price - b.price)
      case 'price_desc':   return [...list].sort((a, b) => b.price - a.price)
      case 'rating_desc':  return [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      case 'category_desc': return [...list].sort((a, b) => b.category - a.category)
      default: return list
    }
  }, [hotels, filters, sortKey])

  const activeCnt = countActiveFilters(filters)

  // ── Polling ────────────────────────────────────────────────────────────────

  const stopPoll = useCallback(() => {
    if (pollTimer.current) { clearTimeout(pollTimer.current); pollTimer.current = null }
  }, [])

  const fetchResults = useCallback(async (searchId: string) => {
    const res = await fetch(`/api/tourvisor/results/${searchId}?limit=${RESULTS_LIMIT}`)
    if (!res.ok) return
    const data: HotelSearchResult[] = await res.json()
    setHotels(data)
  }, [])

  const pollStatus = useCallback(async (searchId: string, isPhase2: boolean) => {
    try {
      const res = await fetch(`/api/tourvisor/status/${searchId}`)
      if (!res.ok) throw new Error(`status ${res.status}`)
      const status = await res.json()

      const displayProgress = isPhase2
        ? 50 + Math.round(status.progress / 2)
        : Math.round(status.progress / 2)
      setProgress(displayProgress)

      if (status.progress > 0 && status.status !== 'done') {
        fetchResults(searchId).catch(() => {})
      }

      if (status.status === 'done') {
        if (!isPhase2) {
          setPhase('continuing')
          const contRes = await fetch(`/api/tourvisor/continue/${searchId}`)
          if (!contRes.ok) {
            await fetchResults(searchId)
            setPhase('done')
            return
          }
          setPhase('phase2')
          pollTimer.current = setTimeout(() => pollStatus(searchId, true), POLL_INTERVAL_MS)
        } else {
          await fetchResults(searchId)
          setProgress(100)
          setPhase('done')
        }
      } else {
        pollTimer.current = setTimeout(() => pollStatus(searchId, isPhase2), POLL_INTERVAL_MS)
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Ошибка поиска')
      setPhase('error')
    }
  }, [fetchResults])

  // ── Старт поиска ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!countryId || !dateFrom || !dateTo) { router.replace('/'); return }

    const params = new URLSearchParams({
      countryId: String(countryId),
      dateFrom, dateTo,
      nightsFrom: String(nightsFrom),
      nightsTo: String(nightsTo),
      adults: String(adults),
    })
    if (childsStr) params.set('childs', childsStr)

    fetch(`/api/tourvisor/search?${params}`)
      .then(r => r.ok ? r.json() : r.json().then((e: unknown) => Promise.reject(e)))
      .then(data => {
        const id = String(data.searchId)
        searchIdRef.current = id
        setPhase('phase1')
        pollTimer.current = setTimeout(() => pollStatus(id, false), POLL_INTERVAL_MS)
      })
      .catch(() => { setErrorMsg('Не удалось запустить поиск'); setPhase('error') })

    return () => stopPoll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Метки ──────────────────────────────────────────────────────────────────

  const searching = phase !== 'done' && phase !== 'error'

  const phaseLabel: Record<Phase, string> = {
    starting:   'Запускаем поиск…',
    phase1:     'Ищем туры (1/2)…',
    continuing: 'Расширяем выборку…',
    phase2:     'Ищем туры (2/2)…',
    done:       `Найдено ${hotels.length} отелей`,
    error:      errorMsg || 'Ошибка',
  }

  const subheaderText = searching
    ? phaseLabel[phase]
    : hotels.length !== filtered.length
      ? `Показано ${filtered.length} из ${hotels.length} отелей`
      : `${hotels.length} отелей — ${countryName || 'результаты'}`

  return (
    <div className={styles.toursPage}>

      {/* ─── Хедер ───────────────────────────────────────────────────────── */}
      <header className={pageStyles.siteHeader}>
        <div className="shell">
          <div className={pageStyles.headerInner}>
            <BrandLogo />
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
              <p className={styles.mobileHeaderTitle}>Мои путешествия</p>
            </div>
            <MgtBadge />
          </div>
        </div>
      </header>

      {/* ─── Мобильная строка поиска (только mobile) ────────────────────── */}
      <div className={styles.mobileSearchBar} onClick={() => { setMobileForm(f => ({ ...f, dateFlex: 0 })); setMobileSheetOpen(true) }}>
        <div className={styles.mobileSearchBarText}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <span>
            {countryName || 'Направление'}
            {dateFrom ? ` · ${formatDateShort(parseTourDate(dateFrom)!)}` : ''}
            {dateTo && dateTo !== dateFrom ? `–${formatDateShort(parseTourDate(dateTo)!)}` : ''}
            {` · ${nightsFrom}–${nightsTo} н · ${adults} взр.`}
          </span>
        </div>
        <div className={styles.mobileSearchBarEdit}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </div>
      </div>

      {/* ─── Прогресс-бар ────────────────────────────────────────────────── */}
      {searching && (
        <div className={styles.searchProgressBar}>
          <div
            className={styles.searchProgressFill}
            style={{ width: `${Math.max(4, progress)}%` }}
          />
        </div>
      )}

      {/* ─── Подхедер ────────────────────────────────────────────────────── */}
      <div className={styles.subheader}>
        <div className={styles.subheaderCount}>
          {searching ? (
            phaseLabel[phase]
          ) : (
            <><strong>{filtered.length}</strong> {subheaderText}</>
          )}
        </div>

        <select
          className={styles.sortSelect}
          value={sortKey}
          onChange={e => setSortKey(e.target.value as SortKey)}
        >
          <option value="price_asc">Сначала дешевле</option>
          <option value="price_desc">Сначала дороже</option>
          <option value="rating_desc">По рейтингу</option>
          <option value="category_desc">По звёздам</option>
        </select>

        <button
          className={styles.mobileFilterBtn}
          onClick={() => setSheetOpen(true)}
        >
          Фильтры
          {activeCnt > 0 && <span className={styles.mobileFilterBadge}>{activeCnt}</span>}
        </button>
      </div>

      {/* ─── Тело: сайдбар + список + карта ─────────────────────────────── */}
      <div className={styles.body}>

        <FiltersSidebar
          filters={filters}
          onChange={setFilters}
          options={filterOptions}
          filteredCount={filtered.length}
        />

        <div className={styles.listPane}>
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
              <div className={styles.emptyStateText}>{errorMsg || 'Ошибка. Попробуйте ещё раз.'}</div>
              <button className={styles.resetFiltersBtn} onClick={() => router.push('/')}>
                Новый поиск
              </button>
            </div>
          ) : filtered.length === 0 && phase === 'done' ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateText}>
                Ничего не найдено по активным фильтрам.
              </div>
              <button className={styles.resetFiltersBtn} onClick={() => setFilters(DEFAULT_FILTERS)}>
                Сбросить фильтры
              </button>
            </div>
          ) : (
            <>
              {searching && hotels.length > 0 && (
                <div className={styles.inlineProgress}>
                  <span className={styles.inlineProgressLabel}>
                    {phaseLabel[phase]} — показано {filtered.length} из ~{hotels.length}
                  </span>
                </div>
              )}
              {filtered.map(hotel => (
                <HotelCard
                  key={hotel.id}
                  hotel={hotel}
                  selected={selectedId === hotel.id}
                  onClick={() => { setSelectedId(hotel.id); setModalHotel(hotel) }}
                />
              ))}
            </>
          )}
        </div>

        <div className={`${styles.mapPane} ${showMap ? styles.mapPaneVisible : ''}`}>
          {filtered.length > 0 ? (
            <MapView
              hotels={filtered}
              selectedId={selectedId}
              onSelect={hotel => { setSelectedId(hotel.id); setModalHotel(hotel) }}
            />
          ) : (
            <div className={styles.mapPlaceholder}>
              Карта появится после загрузки отелей
            </div>
          )}
        </div>
      </div>

      <button
        className={styles.mapToggleBtn}
        onClick={() => setShowMap(v => !v)}
      >
        {showMap ? '📋 Список' : '🗺 Карта'}
      </button>

      <FiltersBottomSheet
        filters={filters}
        onChange={setFilters}
        options={filterOptions}
        filteredCount={filtered.length}
        sheetOpen={sheetOpen}
        onSheetClose={() => setSheetOpen(false)}
      />

      {modalHotel && (
        <HotelModal
          hotel={modalHotel}
          onClose={() => { setModalHotel(null); setSelectedId(null) }}
          searchId={searchIdRef.current ?? ''}
        />
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
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!sessionStorage.getItem('staff_access')) { router.replace('/'); return }
    setReady(true)
  }, [router])

  if (!ready) return null

  return (
    <Suspense fallback={null}>
      <ToursContent />
    </Suspense>
  )
}
