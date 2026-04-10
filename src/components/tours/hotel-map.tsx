'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { HotelData } from './hotel-card';
import styles from './hotel-map.module.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;

function makePriceIcon(price: number | null | undefined, active: boolean) {
  const label = price ? `${price.toLocaleString('ru-RU')} ₽` : '—';
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

  const width = Math.max(80, label.length * 8 + 22);

  return L.divIcon({
    className: '',
    html,
    iconSize: [width, 30],
    iconAnchor: [width / 2, 15],
  });
}

function FitBounds({ hotels }: { hotels: HotelData[] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || hotels.length === 0) return;
    const points = hotels
      .filter(h => h.hotel.lat && h.hotel.long)
      .map(h => [h.hotel.lat!, h.hotel.long!] as [number, number]);
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 });
    }
    fitted.current = true;
  }, [hotels, map]);

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
        {withCoords.map(h => (
          <Marker
            key={h.tour_id}
            position={[h.hotel.lat!, h.hotel.long!]}
            icon={makePriceIcon(h.min_price, hoveredId === h.tour_id)}
            zIndexOffset={hoveredId === h.tour_id ? 1000 : 0}
          >
            <Popup
              closeButton={false}
              className={styles.popup}
              offset={[0, -4]}
            >
              <HotelPopupContent h={h} wlBaseUrl={wlBaseUrl} />
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
