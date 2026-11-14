'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { HotelData } from './hotel-card';
import { buildWlHotelUrl, type WlSearchContext } from '@/lib/wl-link';
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

function priceLabel(price: number | null | undefined): string {
  return price ? `${price.toLocaleString('ru-RU')} ₽` : '—';
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

function HotelPopupContent({ h, wlBaseUrl, wl }: { h: HotelData; wlBaseUrl: string; wl?: WlSearchContext }) {
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
          href={buildWlHotelUrl(
            wlBaseUrl,
            { link: h.hotel.link, minPrice: h.min_price, nights: h.min_price_nights, dates: h.dates },
            wl,
          )}
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
  wl?: WlSearchContext;
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

function Markers({ hotels, hoveredId, wlBaseUrl, wl }: { hotels: HotelData[]; hoveredId?: string | null; wlBaseUrl: string; wl?: WlSearchContext }) {
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
              <HotelPopupContent h={h} wlBaseUrl={wlBaseUrl} wl={wl} />
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

function LeafletHotelMap({ hotels, hoveredId, wlBaseUrl = '', wl }: HotelMapProps) {
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
        {/* Esri Light Gray Canvas: светлая подложка без ключа.
            CARTO, стоявший здесь раньше, с лета требует API-ключ и вместо
            тайлов отдаёт заглушку «API KEY REQUIRED» с кодом 200 — ошибки
            в консоли нет, а карта серая. */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          attribution="&copy; Esri"
        />
        <FitBounds hotels={withCoords} />
        <Markers hotels={withCoords} hoveredId={hoveredId} wlBaseUrl={wlBaseUrl} wl={wl} />
      </MapContainer>
    </div>
  );
}

type Coordinates = [latitude: number, longitude: number];

interface YandexMap {
  getZoom(): number;
  getGlobalPixelCenter(): Coordinates;
  options: { get(name: "projection"): { toGlobalPixels(point: Coordinates, zoom: number): Coordinates } };
  events: { add(name: string, callback: () => void): void; remove(name: string, callback: () => void): void };
  geoObjects: { add(marker: unknown): void; removeAll(): void };
  setCenter(center: Coordinates, zoom: number): void;
  setBounds(bounds: [Coordinates, Coordinates], options: { checkZoomRange: boolean; zoomMargin: number }): void;
  destroy(): void;
}

interface YandexMaps {
  ready(callback: () => void): void;
  Map: new (container: HTMLElement, options: { center: Coordinates; zoom: number; controls: string[] }) => YandexMap;
  templateLayoutFactory: { createClass(template: string): unknown };
  Placemark: new (
    coordinates: Coordinates,
    properties: { iconContent: string; hintContent: string },
    options: { iconLayout: unknown; iconShape: { type: string; coordinates: number[][] }; zIndex: number },
  ) => { events: { add(event: 'click', callback: () => void): void } };
}

let mapsPromise: Promise<YandexMaps> | undefined;

function loadYandexMaps(apiKey: string): Promise<YandexMaps> {
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise<YandexMaps>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`;
    script.referrerPolicy = 'strict-origin-when-cross-origin';
    const timeout = window.setTimeout(fail, 15000);

    function fail() {
      window.clearTimeout(timeout);
      script.remove();
      reject(new Error('Не удалось загрузить Яндекс Карты'));
    }

    script.onerror = fail;
    script.onload = () => {
      const api = (window as Window & { ymaps?: YandexMaps }).ymaps;
      if (!api) return fail();
      api.ready(() => {
        window.clearTimeout(timeout);
        resolve(api);
      });
    };
    document.head.append(script);
  }).catch(error => {
    mapsPromise = undefined;
    throw error;
  });

  return mapsPromise;
}

function YandexHotelMap({ hotels, hoveredId, wlBaseUrl = '', wl, apiKey }: HotelMapProps & { apiKey: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [instance, setInstance] = useState<{ api: YandexMaps; map: YandexMap }>();
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewport, setViewport] = useState(0);
  const selected = hotels.find(hotel => hotel.tour_id === selectedId);

  useEffect(() => {
    let cancelled = false;
    let map: YandexMap | undefined;

    loadYandexMaps(apiKey).then(api => {
      if (cancelled || !container.current) return;
      map = new api.Map(container.current, { center: [36.8, 34.6], zoom: 10, controls: ['zoomControl'] });
      setInstance({ api, map });
    }).catch(() => {
      if (!cancelled) setFailed(true);
    });

    return () => {
      cancelled = true;
      map?.destroy();
    };
  }, [apiKey]);

  const boundsKey = JSON.stringify(hotels.flatMap(({ hotel: { lat, long } }) =>
    Number.isFinite(lat) && Number.isFinite(long) ? [[lat, long]] : [],
  ));

  useEffect(() => {
    if (!instance || !container.current) return;
    const refresh = () => setViewport(value => value + 1);
    const observer = new ResizeObserver(refresh);
    observer.observe(container.current);
    instance.map.events.add('boundschange', refresh);
    return () => {
      observer.disconnect();
      instance.map.events.remove('boundschange', refresh);
    };
  }, [instance]);

  const project = useCallback((point: Coordinates) => {
    if (!instance || !container.current) return null;
    const { map } = instance;
    const [x, y] = map.options.get('projection').toGlobalPixels(point, map.getZoom());
    const [centerX, centerY] = map.getGlobalPixelCenter();
    return [x - centerX + container.current.clientWidth / 2, y - centerY + container.current.clientHeight / 2];
  }, [instance]);

  useEffect(() => {
    if (!instance) return;

    instance.map.geoObjects.removeAll();
    const placed: number[][] = [];
    const sorted = [...hotels].sort((a, b) =>
      Number(b.tour_id === (selectedId ?? hoveredId)) - Number(a.tour_id === (selectedId ?? hoveredId))
      || (a.min_price ?? Infinity) - (b.min_price ?? Infinity),
    );
    for (const hotel of sorted) {
      const { lat, long } = hotel.hotel;
      if (lat == null || long == null || !Number.isFinite(lat) || !Number.isFinite(long)) continue;

      const active = hoveredId === hotel.tour_id || selectedId === hotel.tour_id;
      const pixel = project([lat, long]);
      const width = priceIconWidth(hotel.min_price);
      const [x, y] = pixel ?? [0, 0];
      const box = [x - width / 2 - 4, y - 17, x + width / 2 + 4, y + 17];
      const showLabel = active || !placed.some(([left, top, right, bottom]) =>
        box[0] < right && box[2] > left && box[1] < bottom && box[3] > top,
      );
      if (showLabel) placed.push(box);
      const halfWidth = showLabel ? width / 2 : 9;
      const halfHeight = showLabel ? 15 : 9;
      const marker = new instance.api.Placemark(
        [lat, long],
        { iconContent: priceLabel(hotel.min_price), hintContent: '' },
        {
          iconLayout: instance.api.templateLayoutFactory.createClass(
            `<span class="${styles.yandexPin} ${showLabel ? '' : styles.yandexDot} ${active ? styles.yandexActive : ''}">${showLabel ? '$[properties.iconContent]' : ''}</span>`,
          ),
          iconShape: { type: 'Rectangle', coordinates: [[-halfWidth, -halfHeight], [halfWidth, halfHeight]] },
          zIndex: active ? 1000 : showLabel ? 100 : 0,
        },
      );
      marker.events.add('click', () => setSelectedId(hotel.tour_id));
      instance.map.geoObjects.add(marker);
    }
  }, [instance, hotels, hoveredId, selectedId, project, viewport]);

  useEffect(() => {
    if (!instance) return;
    const coordinates: Coordinates[] = JSON.parse(boundsKey);
    if (coordinates.length === 0) return;
    const latitudes = coordinates.map(([latitude]) => latitude);
    const longitudes = coordinates.map(([, longitude]) => longitude);
    const southwest: Coordinates = [Math.min(...latitudes), Math.min(...longitudes)];
    const northeast: Coordinates = [Math.max(...latitudes), Math.max(...longitudes)];
    if (southwest[0] === northeast[0] && southwest[1] === northeast[1]) {
      instance.map.setCenter(southwest, 13);
    } else {
      instance.map.setBounds([southwest, northeast], { checkZoomRange: true, zoomMargin: 40 });
    }
  }, [instance, boundsKey]);

  const lat = selected?.hotel.lat;
  const long = selected?.hotel.long;
  const anchor = lat != null && long != null ? project([lat, long]) : null;
  const mapWidth = container.current?.clientWidth ?? 0;
  const mapHeight = container.current?.clientHeight ?? 0;

  if (failed) return <LeafletHotelMap {...{ hotels, hoveredId, wlBaseUrl, wl }} />;

  return (
    <div className={`${styles.mapWrap} ${styles.yandexWrap}`}>
      <div ref={container} className={styles.map} />
      {selected && anchor && anchor[0] >= 0 && anchor[0] <= mapWidth && anchor[1] >= 0 && anchor[1] <= mapHeight && (
        <div className={styles.yandexPopup} style={{
          left: Math.max(8, Math.min(anchor[0] - 120, mapWidth - 248)),
          top: anchor[1] >= 260 ? anchor[1] - 18 : Math.min(anchor[1] + 18, Math.max(8, mapHeight - 260)),
          transform: anchor[1] >= 260 ? 'translateY(-100%)' : undefined,
        }}>
          <button type="button" className={styles.closePopup} aria-label="Закрыть карточку отеля" onClick={() => setSelectedId(null)}>×</button>
          <HotelPopupContent h={selected} wlBaseUrl={wlBaseUrl} wl={wl} />
        </div>
      )}
    </div>
  );
}

export function HotelMap(props: HotelMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_KEY;
  return apiKey ? <YandexHotelMap {...props} apiKey={apiKey} /> : <LeafletHotelMap {...props} />;
}
