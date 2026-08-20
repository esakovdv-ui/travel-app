'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { HotelData } from './hotel-card';
import styles from './hotel-map.module.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;

/** Маленькая точка вместо плашки — для маркеров, которым не хватило места */
function makeDotIcon(active: boolean) {
  const size = active ? 14 : 10;
  const html = `<div style="
    width:${size}px;height:${size}px;border-radius:50%;
    background:${active ? '#1B4FBF' : '#fff'};
    border:2px solid ${active ? '#fff' : '#1B4FBF'};
    box-shadow:0 1px 4px rgba(0,0,0,0.3);cursor:pointer;
  "></div>`;
  return L.divIcon({
    className: '',
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** Сокращаем до тысяч: «116 782 ₽» → «117 т₽» — плашка вдвое уже */
function priceLabel(price: number | null | undefined): string {
  return price ? `${Math.round(price / 1000).toLocaleString('ru-RU')} т₽` : '—';
}

/** Ширина плашки. Используется и при отрисовке, и при раскладке без наложений. */
function priceIconWidth(price: number | null | undefined): number {
  return Math.max(80, priceLabel(price).length * 8 + 22);
}

function makePriceIcon(price: number | null | undefined, active: boolean) {
  const label = priceLabel(price);
  const bg = active ? '#1B4FBF' : '#fff';
  const color = active ? '#fff' : '#1a1a1a';
  const shadow = active
    ? '0 3px 10px rgba(27,79,191,0.4)'
    : '0 2px 6px rgba(0,0,0,0.2)';
  const fontWeight = active ? '700' : '600';
  const border = active ? '2px solid #1B4FBF' : '2px solid transparent';

  const html = `<div style="
    display:inline-flex;align-items:center;justify-content:center;
    background:${bg};color:${color};border:${border};
    border-radius:20px;padding:5px 11px;font-size:13px;font-weight:${fontWeight};
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    white-space:nowrap;box-shadow:${shadow};cursor:pointer;
  ">${label}</div>`;

  const width = priceIconWidth(price);

  return L.divIcon({
    className: '',
    html,
    iconSize: [width, 30],
    iconAnchor: [width / 2, 15],
  });
}

function FitBounds({ hotels }: { hotels: HotelData[] }) {
  const map = useMap();
  const lastKey = useRef('');

  // Ключ по координатам: пересобираем вид, когда действительно изменился набор
  // точек. Раньше здесь стоял флаг «подогнали один раз» — после смены фильтров
  // карта оставалась на прежнем участке и показывала пустое место вместо отелей.
  const key = hotels
    .filter(h => h.hotel.lat && h.hotel.long)
    .map(h => `${h.hotel.lat},${h.hotel.long}`)
    .join('|');

  useEffect(() => {
    if (!key || key === lastKey.current) return;
    lastKey.current = key;

    const points = key.split('|').map(p => p.split(',').map(Number) as [number, number]);
    if (points.length === 1) {
      map.setView(points[0], 13);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 });
    }
  }, [key, map]);

  return null;
}

function HotelPopupContent({ h, wlBaseUrl }: { h: HotelData; wlBaseUrl: string }) {
  const image = h.hotel.images?.[0]?.x500;
  const price = h.min_price?.toLocaleString('ru-RU');

  return (
    <div style={{ width: 240, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      {image && (
        <img
          src={image}
          alt={h.hotel.name}
          style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }}
        />
      )}
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3, color: '#1a1a1a', lineHeight: 1.3 }}>
          {h.hotel.name}
        </div>
        {h.hotel.stars > 0 && (
          <div style={{ color: '#f5a623', fontSize: 11, marginBottom: 4 }}>
            {'★'.repeat(h.hotel.stars)}
          </div>
        )}
        <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
          {h.hotel.region_name}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: '#888' }}>от</span>
          <span style={{ fontWeight: 700, fontSize: 17, color: '#1a1a1a' }}>{price} ₽</span>
        </div>
        <a
          href={`${wlBaseUrl}${h.hotel.link}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block', background: '#1B4FBF', color: '#fff',
            textAlign: 'center', padding: '8px 12px', borderRadius: 20,
            textDecoration: 'none', fontSize: 13, fontWeight: 600,
          }}
        >
          Смотреть
        </a>
      </div>
    </div>
  );
}

interface HotelMapProps {
  hotels: HotelData[];
  hoveredId: string | null;
  wlBaseUrl?: string;
}

/**
 * Раскладывает маркеры на текущем зуме: жадно расставляет ценовые плашки так,
 * чтобы они не перекрывались, остальным отдаёт точки. Без этого 60+ отелей
 * в одном курорте превращались в нечитаемую кучу наложенных друг на друга цен.
 */
function useLabelLayout(hotels: HotelData[]) {
  const map = useMap();
  const [withLabel, setWithLabel] = useState<Set<string>>(new Set());

  const recompute = useCallback(() => {
    const placed: Array<{ x1: number; x2: number; y1: number; y2: number }> = [];
    const next = new Set<string>();

    // Дешёвые сначала — на карте важнее показать цены подешевле
    const sorted = [...hotels].sort((a, b) => (a.min_price ?? 0) - (b.min_price ?? 0));

    for (const h of sorted) {
      const p = map.latLngToContainerPoint([h.hotel.lat!, h.hotel.long!]);
      // ширину берём по той же формуле, что и сама плашка, плюс воздух между ними
      const w = priceIconWidth(h.min_price) + 8;
      const hh = 38;
      const box = { x1: p.x - w / 2, x2: p.x + w / 2, y1: p.y - hh / 2, y2: p.y + hh / 2 };
      const clash = placed.some(b => !(box.x2 < b.x1 || box.x1 > b.x2 || box.y2 < b.y1 || box.y1 > b.y2));
      if (!clash) {
        placed.push(box);
        next.add(h.tour_id);
      }
    }
    setWithLabel(next);
  }, [hotels, map]);

  useEffect(() => {
    recompute();
    map.on('zoomend moveend', recompute);
    return () => { map.off('zoomend moveend', recompute); };
  }, [map, recompute]);

  return withLabel;
}

function Markers({ hotels, hoveredId, wlBaseUrl }: { hotels: HotelData[]; hoveredId?: string | null; wlBaseUrl: string }) {
  const withLabel = useLabelLayout(hotels);

  return (
    <>
      {hotels.map(h => {
        const active = hoveredId === h.tour_id;
        // Наведённый отель показываем плашкой всегда, чтобы его было видно в списке
        const showLabel = active || withLabel.has(h.tour_id);
        return (
          <Marker
            key={h.tour_id}
            position={[h.hotel.lat!, h.hotel.long!]}
            icon={showLabel ? makePriceIcon(h.min_price, active) : makeDotIcon(active)}
            zIndexOffset={active ? 1000 : showLabel ? 100 : 0}
          >
            <Popup closeButton={false} className={styles.popup} offset={[0, -4]}>
              <HotelPopupContent h={h} wlBaseUrl={wlBaseUrl} />
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

export function HotelMap({ hotels, hoveredId, wlBaseUrl = '' }: HotelMapProps) {
  const withCoords = hotels.filter(h => h.hotel.lat && h.hotel.long);

  const center: [number, number] = withCoords.length > 0
    ? [withCoords[0].hotel.lat!, withCoords[0].hotel.long!]
    : [36.8, 34.6];

  return (
    <div className={styles.mapWrap}>
      <MapContainer
        center={center}
        zoom={10}
        className={styles.map}
        zoomControl={true}
        scrollWheelZoom={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <FitBounds hotels={withCoords} />
        <Markers hotels={withCoords} hoveredId={hoveredId} wlBaseUrl={wlBaseUrl} />
      </MapContainer>
    </div>
  );
}
