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
  /** Тап по пину. Страница решает: выделить карточку или открыть отель. */
  onSelect: (hotel: HotelSearchResult) => void
}

/** С этого приближения на пине помещается ещё и название отеля. */
const ZOOM_WITH_NAME = 12

/**
 * Приближение, на котором сетка кластеризации почти всегда разводит отели
 * по отдельным пинам. Нужно, когда человек выбрал отель в списке: показать
 * ему кружок с числом вместо его отеля — это не ответ на вопрос «где он».
 */
const ZOOM_UNCLUSTERED = 16
/**
 * Масштаб, к которому подводим карту по выбору карточки.
 *
 * На 16-м соседние отели курорта ещё слипались: в Текирове на месте выбранного
 * висел кружок «2». Проверено вживую — расходятся на 17-м, там уже видны
 * отдельные здания и понятно, что где.
 */
const ZOOM_ON_SELECT = 17

/** Дальше этого Яндекс всё равно не пускает, а мы не пытаемся. */
const ZOOM_MAX = 19

function formatPriceShort(n: number): string {
  if (n >= 1_000_000) return (Math.round(n / 100_000) / 10) + 'М'
  if (n >= 1_000) return Math.round(n / 1_000) + 'К'
  return String(n)
}

/** «HERITAGE BY CIMEN HOTEL (EX. CIMEN)» → «Heritage by cimen…» */
function shortName(name: string): string {
  const clean = name.replace(/\s*\(.*$/, '').trim()
  const cut = clean.length > 18 ? clean.slice(0, 17).trimEnd() + '…' : clean
  return cut.charAt(0) + cut.slice(1).toLowerCase()
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

/** Подпись пина: на дальнем зуме только цена, на ближнем — ещё и название. */
function pinLabel(hotel: HotelSearchResult, zoom: number): string {
  const price = formatPriceShort(hotel.price)
  return zoom >= ZOOM_WITH_NAME ? `${shortName(hotel.name)} · ${price}` : price
}

function createPinEl(hotel: HotelSearchResult, zoom: number, onClick: () => void): HTMLElement {
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
  el.textContent = pinLabel(hotel, zoom)
  el.addEventListener('click', e => { e.stopPropagation(); onClick() })
  applyPinState(el, false)
  return el
}

/**
 * Пин выбранного отеля.
 *
 * Живёт вне кластеризатора и рисуется поверх всего. Иначе выбранный отель
 * пропадал: сетка кластеризации группирует по пикселям, и два отеля в
 * нескольких метрах друг от друга слипаются на любом масштабе — на месте
 * «AMORE BOUTIQUE» человек видел кружок «2» и никаким приближением не мог
 * его развести.
 *
 * Всегда с названием, независимо от зума: это ответ на вопрос «где мой
 * отель», а не рядовая подпись.
 */
function createSelectedPinEl(hotel: HotelSearchResult): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = [
    'background:#e8272a',
    'color:#fff',
    'padding:5px 11px',
    'border-radius:999px',
    'font-size:11px',
    'font-weight:700',
    'white-space:nowrap',
    'box-shadow:0 3px 12px rgba(0,0,0,.4)',
    'border:2px solid #fff',
    'cursor:pointer',
    'user-select:none',
    'font-family:-apple-system,sans-serif',
    'line-height:1.2',
    // Поверх кластеров и соседних подписей, которые перекрывали выбранный.
    'z-index:1000',
    'position:relative',
  ].join(';')
  el.textContent = `${shortName(hotel.name)} · ${formatPriceShort(hotel.price)}`
  return el
}

/**
 * Кружок кластера. Размер растёт вместе с числом, но не безгранично:
 * иначе в Аланье с её 69 отелями на точке получался бы блин во весь экран.
 */
function createClusterEl(count: number, onClick: () => void): HTMLElement {
  const size = Math.min(58, 34 + Math.round(Math.log2(count + 1) * 5))
  const el = document.createElement('div')
  el.style.cssText = [
    `width:${size}px`,
    `height:${size}px`,
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'border-radius:50%',
    'background:#0c2461',
    'color:#fff',
    `font-size:${count > 99 ? 12 : 13}px`,
    'font-weight:800',
    'border:3px solid #fff',
    'box-shadow:0 3px 12px rgba(0,0,0,.32)',
    'cursor:pointer',
    'user-select:none',
    'font-family:-apple-system,sans-serif',
  ].join(';')
  el.textContent = String(count)
  el.addEventListener('click', e => { e.stopPropagation(); onClick() })
  return el
}

const hasCoords = (h: HotelSearchResult) =>
  !!h.latitude && !!h.longitude && !(h.latitude === 0 && h.longitude === 0)

export default function MapView({ hotels, selectedId, onSelect }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<any>(null)
  const clustererRef = useRef<any>(null)
  /** Маркер выбранного отеля — живёт отдельно от кластеризатора. */
  const selectedMarkerRef = useRef<any>(null)
  const pinElsRef    = useRef<Map<number, HTMLElement>>(new Map())
  const hotelsRef    = useRef<HotelSearchResult[]>(hotels)
  const selectedRef  = useRef<number | null>(selectedId)
  const zoomRef      = useRef(4)
  const [ymaps3, setYmaps3] = useState<any>(null)
  const [clusterKit, setClusterKit] = useState<any>(null)

  // Родитель передаёт новую стрелку на каждый рендер — держим её в ref,
  // иначе маркеры пересоздавались бы при любом обновлении страницы.
  const onSelectRef = useRef(onSelect)
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])
  useEffect(() => { hotelsRef.current = hotels }, [hotels])
  useEffect(() => { selectedRef.current = selectedId }, [selectedId])

  const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? ''

  // ── Инициализация карты и кластеризатора (один раз) ──────────────────────
  useEffect(() => {
    if (!apiKey || !containerRef.current) return
    let cancelled = false

    loadYmaps(apiKey)
      .then(async ym => {
        if (cancelled || !containerRef.current) return
        const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapListener } = ym
        const map = new YMap(
          containerRef.current,
          { location: { center: [37.0, 35.0], zoom: 4 } },
          [new YMapDefaultSchemeLayer(), new YMapDefaultFeaturesLayer()],
        )
        mapRef.current = map

        // Приближение решает, что писать на пине, поэтому следим за ним.
        map.addChild(new YMapListener({
          onUpdate: (e: any) => {
            const z = e?.location?.zoom
            if (typeof z !== 'number') return
            const wasNamed = zoomRef.current >= ZOOM_WITH_NAME
            zoomRef.current = z
            // Перерисовываем подписи только на переходе через порог,
            // а не на каждый пиксель зума.
            if (wasNamed === (z >= ZOOM_WITH_NAME)) return
            for (const [id, el] of pinElsRef.current) {
              const hotel = hotelsRef.current.find(h => h.id === id)
              if (hotel) el.textContent = pinLabel(hotel, z)
            }
          },
        }))

        // Кластеризация — готовый модуль Яндекса, своей сетки не пишем.
        // Модуль подгружается отдельным запросом и может не доехать: тогда
        // показываем обычные пины, а не пустую карту.
        let kit: any = null
        try {
          kit = await ym.import('@yandex/ymaps3-clusterer@0.0.1')
        } catch (e) {
          console.error('ymaps3-clusterer не загрузился, пины без группировки', e)
        }
        if (cancelled) return
        setClusterKit(kit)
        setYmaps3(ym)
      })
      .catch(console.error)

    return () => {
      cancelled = true
      try { mapRef.current?.destroy?.() } catch {}
      mapRef.current = null
      clustererRef.current = null
    }
  }, [apiKey])

  const boundsKey = hotels.filter(hasCoords).map(h => h.id).join(',')

  // ── Пересборка кластеризатора при смене набора отелей ────────────────────
  useEffect(() => {
    if (!ymaps3 || !mapRef.current) return
    const { YMapMarker } = ymaps3
    const map = mapRef.current

    const valid = hotels.filter(hasCoords)
    pinElsRef.current.clear()

    if (clustererRef.current) {
      const prev = clustererRef.current
      if (prev.__plain) {
        for (const m of prev.__plain) { try { map.removeChild(m) } catch {} }
      } else {
        try { map.removeChild(prev) } catch {}
      }
      clustererRef.current = null
    }
    if (valid.length === 0) return

    const byId = new Map(valid.map(h => [h.id, h]))

    // Запасной путь: без модуля кластеризации раскладываем пины по одному,
    // как было раньше. Хуже читается на плотных курортах, но работает.
    if (!clusterKit) {
      const plain: any[] = []
      for (const hotel of valid) {
        const el = createPinEl(hotel, zoomRef.current, () => onSelectRef.current(hotel))
        pinElsRef.current.set(hotel.id, el)
        applyPinState(el, hotel.id === selectedRef.current)
        const marker = new YMapMarker({ coordinates: [hotel.longitude, hotel.latitude] }, el)
        map.addChild(marker)
        plain.push(marker)
      }
      clustererRef.current = {
        // removeChild ниже ожидает один объект — заворачиваем список.
        __plain: plain,
      }
      return
    }

    const { YMapClusterer, clusterByGrid } = clusterKit
    const features = valid.map(h => ({
      type: 'Feature' as const,
      id: String(h.id),
      geometry: { type: 'Point' as const, coordinates: [h.longitude, h.latitude] as [number, number] },
      properties: { hotelId: h.id },
    }))

    const instance = new YMapClusterer({
      method: clusterByGrid({ gridSize: 64 }),
      features,
      marker: (feature: any) => {
        const hotel = byId.get(feature.properties.hotelId)
        if (!hotel) return new YMapMarker({ coordinates: feature.geometry.coordinates }, document.createElement('div'))
        const el = createPinEl(hotel, zoomRef.current, () => onSelectRef.current(hotel))
        pinElsRef.current.set(hotel.id, el)
        applyPinState(el, hotel.id === selectedRef.current)
        return new YMapMarker({ coordinates: feature.geometry.coordinates }, el)
      },
      cluster: (coordinates: [number, number], features_: any[]) =>
        new YMapMarker(
          { coordinates },
          // Тап по кластеру приближает к его границам, а не открывает список:
          // так человек не теряет контекст карты.
          createClusterEl(features_.length, () => {
            const lons = features_.map(f => f.geometry.coordinates[0])
            const lats = features_.map(f => f.geometry.coordinates[1])
            const spanLon = Math.max(...lons) - Math.min(...lons)
            const spanLat = Math.max(...lats) - Math.min(...lats)

            // Отели одного курорта часто стоят почти в одной точке. Тогда
            // границы кластера вырождаются, и подгонка под них не меняет
            // масштаб — кружок оставался кружком, сколько по нему ни жми.
            // В таком случае просто шагаем вглубь.
            if (Math.max(spanLon, spanLat) < 0.004) {
              map.update({
                location: {
                  center: coordinates,
                  zoom: Math.min(Math.max(zoomRef.current + 3, ZOOM_UNCLUSTERED), ZOOM_MAX),
                },
                animation: { duration: 350 },
              })
              return
            }

            const pad = Math.max(spanLon, spanLat) * 0.15
            map.update({
              location: {
                bounds: [
                  [Math.min(...lons) - pad, Math.min(...lats) - pad],
                  [Math.max(...lons) + pad, Math.max(...lats) + pad],
                ],
              },
              animation: { duration: 350 },
            })
          }),
        ),
    })

    map.addChild(instance)
    clustererRef.current = instance
  // selectedId намеренно не в зависимостях: подсветка живёт отдельным
  // эффектом, иначе кластеры пересобирались бы на каждый выбор карточки.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ymaps3, clusterKit, boundsKey])

  // ── Подсветка выбранного пина — без пересоздания DOM ─────────────────────
  useEffect(() => {
    pinElsRef.current.forEach((el, id) => applyPinState(el, id === selectedId))
  }, [selectedId, hotels])

  // ── Отдельный маркер выбранного отеля, поверх кластеров ──────────────────
  //
  // Подсветки выше недостаточно: если отель попал в кластер, его пина в DOM
  // просто нет — подсвечивать нечего. Поэтому рисуем его сами, вне
  // кластеризатора, и он виден всегда.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ymaps3) return

    if (selectedMarkerRef.current) {
      try { map.removeChild(selectedMarkerRef.current) } catch {}
      selectedMarkerRef.current = null
    }

    if (selectedId == null) return
    const hotel = hotels.find(h => h.id === selectedId)
    if (!hotel || !hasCoords(hotel)) return

    const { YMapMarker } = ymaps3
    const el = createSelectedPinEl(hotel)
    el.addEventListener('click', e => { e.stopPropagation(); onSelectRef.current(hotel) })
    const marker = new YMapMarker({ coordinates: [hotel.longitude, hotel.latitude] }, el)
    map.addChild(marker)
    selectedMarkerRef.current = marker

    return () => {
      if (!selectedMarkerRef.current) return
      try { map.removeChild(selectedMarkerRef.current) } catch {}
      selectedMarkerRef.current = null
    }
  }, [selectedId, hotels, ymaps3])

  // ── Обратная связь: тап по карточке подводит карту к её пину ─────────────
  useEffect(() => {
    if (!mapRef.current || selectedId == null) return
    const hotel = hotels.find(h => h.id === selectedId)
    if (!hotel || !hasCoords(hotel)) return
    // Приближаем ощутимо: на замере вживую именно на этом масштабе соседние
    // отели расходятся и становится видно, что где. Меньше — подписи налезают
    // друг на друга и выбранный теряется среди соседей.
    //
    // Отдельный маркер выше страхует случай, когда не помогает и это: два
    // отеля в нескольких метрах слипаются на любом зуме.
    mapRef.current.update({
      location: {
        center: [hotel.longitude, hotel.latitude],
        zoom: Math.min(Math.max(zoomRef.current, ZOOM_ON_SELECT), ZOOM_MAX),
      },
      animation: { duration: 400 },
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // ── fitBounds: только когда меняется сам набор отелей ────────────────────
  // Раньше это жило в эффекте маркеров и переигрывалось на каждый ререндер
  // (selectedId, новая ссылка onSelect) — карта дёргалась к границам.
  useEffect(() => {
    if (!ymaps3 || !mapRef.current || !boundsKey) return
    const valid = hotels.filter(hasCoords)
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
