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

function createPinEl(
  price: number,
  selected: boolean,
  onClick: () => void,
): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = [
    `background:${selected ? '#e8272a' : '#0c2461'}`,
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
    `transform:${selected ? 'scale(1.18)' : 'scale(1)'}`,
    'transition:transform .15s,background .15s',
    'font-family:-apple-system,sans-serif',
    'line-height:1.2',
  ].join(';')
  el.textContent = formatPriceShort(price)
  el.addEventListener('click', onClick)
  return el
}

export default function MapView({ hotels, selectedId, onSelect }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<any>(null)
  const markersRef   = useRef<Map<number, any>>(new Map())
  const [ymaps3, setYmaps3] = useState<any>(null)

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

  // ── Маркеры: обновляем при изменении отелей / выбранного ─────────────────
  useEffect(() => {
    if (!ymaps3 || !mapRef.current) return
    const { YMapMarker } = ymaps3
    const map = mapRef.current

    const valid = hotels.filter(
      h => h.latitude && h.longitude && !(h.latitude === 0 && h.longitude === 0),
    )

    // Удаляем все текущие маркеры
    markersRef.current.forEach(m => { try { map.removeChild(m) } catch {} })
    markersRef.current.clear()

    // Добавляем новые
    for (const hotel of valid) {
      const el     = createPinEl(hotel.price, hotel.id === selectedId, () => onSelect(hotel))
      const marker = new YMapMarker({ coordinates: [hotel.longitude, hotel.latitude] }, el)
      map.addChild(marker)
      markersRef.current.set(hotel.id, marker)
    }

    // fitBounds
    if (valid.length > 0) {
      const lons = valid.map(h => h.longitude)
      const lats = valid.map(h => h.latitude)
      map.update({
        location: {
          bounds: [
            [Math.min(...lons), Math.min(...lats)],
            [Math.max(...lons), Math.max(...lats)],
          ],
          duration: 400,
        },
      })
    }
  }, [ymaps3, hotels, selectedId, onSelect])

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
}
