'use client'

// Яндекс Карты JS API v3 — загружается динамически (ssr: false из page.tsx).
// Координаты: [longitude, latitude] — порядок Яндекса, не Leaflet.

import { useEffect, useRef, useState } from 'react'
import type { HotelSearchResult } from '@/lib/tourvisor/types'

declare global {
  interface Window { ymaps3: any }
}

interface MapViewProps {
  hotels: HotelSearchResult[]
  selectedId: number | null
  onSelect: (hotel: HotelSearchResult) => void
}

function formatPriceShort(n: number): string {
  if (n >= 1_000_000) return (Math.round(n / 100_000) / 10) + 'М'
  if (n >= 1_000) return Math.round(n / 1_000) + 'К'
  return String(n)
}

function loadYmaps(apiKey: string): Promise<any> {
  if (window.ymaps3) return window.ymaps3.ready.then(() => window.ymaps3)

  const existing = document.getElementById('ymaps3-script')
  if (existing) {
    return new Promise(resolve => {
      const t = setInterval(() => {
        if (window.ymaps3) { clearInterval(t); window.ymaps3.ready.then(() => resolve(window.ymaps3)) }
      }, 50)
    })
  }

  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.id  = 'ymaps3-script'
    s.src = `https://api-maps.yandex.ru/v3/?apikey=${apiKey}&lang=ru_RU`
    s.onload  = () => window.ymaps3.ready.then(() => resolve(window.ymaps3))
    s.onerror = reject
    document.head.appendChild(s)
  })
}

function applyPinState(el: HTMLElement, selected: boolean): void {
  el.style.background = selected ? '#e8272a' : '#0c2461'
  el.style.transform  = selected ? 'scale(1.18)' : 'scale(1)'
  el.style.zIndex     = selected ? '2' : '1'
}

function createPinEl(price: number, onClick: () => void): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = [
    'color:#fff',
    'padding:4px 10px',
    'border-radius:999px',
    'font-size:11px',
    'font-weight:700',
    'white-space:nowrap',
    'box-shadow:0 2px 8px rgba(0,0,0,.28)',
    'border:2px solid #fff',
    'cursor:pointer',
    'user-select:none',
    'transition:transform .15s,background .15s',
    'font-family:-apple-system,sans-serif',
    'line-height:1.2',
  ].join(';')
  el.textContent = formatPriceShort(price)
  el.addEventListener('click', onClick)
  applyPinState(el, false)
  return el
}

export default function MapView({ hotels, selectedId, onSelect }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<any>(null)
  const markersRef   = useRef<Map<number, any>>(new Map())
  const pinElsRef    = useRef<Map<number, HTMLElement>>(new Map())
  const [ymaps3, setYmaps3] = useState<any>(null)

  // Родитель передаёт новую стрелку на каждый рендер — держим её в ref,
  // иначе маркеры пересоздавались бы при любом обновлении страницы.
  const onSelectRef = useRef(onSelect)
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])

  const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? ''

  // ── Инициализация карты (один раз) ──────────────────────────────────────
  useEffect(() => {
    if (!apiKey || !containerRef.current) return
    let cancelled = false

    loadYmaps(apiKey)
      .then(ym => {
        if (cancelled || !containerRef.current) return
        const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer } = ym
        const map = new YMap(
          containerRef.current,
          { location: { center: [37.0, 35.0], zoom: 4 } },
          [new YMapDefaultSchemeLayer(), new YMapDefaultFeaturesLayer()],
        )
        mapRef.current = map
        setYmaps3(ym)
      })
      .catch(console.error)

    return () => {
      cancelled = true
      try { mapRef.current?.destroy?.() } catch {}
      mapRef.current = null
    }
  }, [apiKey])

  // ── Маркеры: пересобираем только при смене набора отелей ─────────────────
  useEffect(() => {
    if (!ymaps3 || !mapRef.current) return
    const { YMapMarker } = ymaps3
    const map = mapRef.current

    const valid = hotels.filter(
      h => h.latitude && h.longitude && !(h.latitude === 0 && h.longitude === 0),
    )

    markersRef.current.forEach(m => { try { map.removeChild(m) } catch {} })
    markersRef.current.clear()
    pinElsRef.current.clear()

    for (const hotel of valid) {
      const el     = createPinEl(hotel.price, () => onSelectRef.current(hotel))
      const marker = new YMapMarker({ coordinates: [hotel.longitude, hotel.latitude] }, el)
      map.addChild(marker)
      markersRef.current.set(hotel.id, marker)
      pinElsRef.current.set(hotel.id, el)
    }
  }, [ymaps3, hotels])

  // ── Подсветка выбранного пина — без пересоздания DOM ─────────────────────
  useEffect(() => {
    pinElsRef.current.forEach((el, id) => applyPinState(el, id === selectedId))
  }, [selectedId, hotels])

  // ── fitBounds: только когда меняется сам набор отелей ────────────────────
  // Раньше это жило в эффекте маркеров и переигрывалось на каждый ререндер
  // (selectedId, новая ссылка onSelect) — карта дёргалась к границам.
  const boundsKey = hotels
    .filter(h => h.latitude && h.longitude && !(h.latitude === 0 && h.longitude === 0))
    .map(h => h.id)
    .join(',')

  useEffect(() => {
    if (!ymaps3 || !mapRef.current || !boundsKey) return
    const valid = hotels.filter(
      h => h.latitude && h.longitude && !(h.latitude === 0 && h.longitude === 0),
    )
    if (valid.length === 0) return

    const lons = valid.map(h => h.longitude)
    const lats = valid.map(h => h.latitude)
    // Небольшой отступ, чтобы пины не липли к краям и не уезжали под панели.
    const padLon = Math.max((Math.max(...lons) - Math.min(...lons)) * 0.12, 0.15)
    const padLat = Math.max((Math.max(...lats) - Math.min(...lats)) * 0.12, 0.15)

    // ВАЖНО: duration должен лежать в animation, а не рядом с bounds внутри location.
    // При {location:{bounds, duration}} Яндекс v3 молча игнорирует всё обновление —
    // из-за этого карта оставалась на стартовых [37,35] zoom 4 (пол-Ближнего Востока
    // в кадре) вместо того, чтобы подстроиться под найденные отели.
    mapRef.current.update({
      location: {
        bounds: [
          [Math.min(...lons) - padLon, Math.min(...lats) - padLat],
          [Math.max(...lons) + padLon, Math.max(...lats) + padLat],
        ],
      },
      animation: { duration: 400 },
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ymaps3, boundsKey])

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
}
