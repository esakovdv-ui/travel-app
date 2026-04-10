'use client';
import styles from './hotel-card.module.css';

export interface HotelData {
  tour_id: string;
  min_price: number;
  min_price_nights: number;
  pansion_prices?: Record<string, number>;
  extras?: {
    instant_confirm?: boolean;
    cheap?: boolean;
    previous_price?: number | null;
  };
  labels?: Array<{ id: number; title: string }>;
  hotel: {
    name: string;
    stars: number;
    city: string;
    region_name: string;
    rating: number;
    link: string;
    lat?: number | null;
    long?: number | null;
    images?: Array<{ x500: string; webp_x620?: string }>;
    features?: {
      beach_distance?: number | null;
      beach_type?: string | null;
      beach_surface?: string | null;
      line?: number | null;
    };
  };
}

// ── Словари ──────────────────────────────────────────────────────────────
const MEAL_NAMES: Record<string, string> = {
  UAI: 'Ультра всё включено',
  AI:  'Всё включено',
  HB:  'Завтрак + ужин',
  BB:  'Завтрак',
  FB:  'Полный пансион',
  RO:  'Без питания',
};

const BEACH_SURFACE: Record<string, string> = {
  SAND:        'Песок',
  PEBBLE:      'Галька',
  'SAND+PEBBLE': 'Песок/галька',
  PLATFORM:    'Платформа',
};

function ratingClass(r: number) {
  if (r >= 8) return styles.ratingHigh;
  if (r >= 7) return styles.ratingMid;
  return styles.ratingLow;
}

function bestMeal(pansion_prices?: Record<string, number>) {
  if (!pansion_prices) return null;
  // Приоритет: UAI > AI > HB > FB > BB > RO
  const order = ['UAI', 'AI', 'HB', 'FB', 'BB', 'RO'];
  for (const key of order) {
    if (pansion_prices[key]) return { code: key, name: MEAL_NAMES[key] ?? key, price: pansion_prices[key] };
  }
  return null;
}

// ── Компонент ─────────────────────────────────────────────────────────────
export function HotelCard({
  hotel: h,
  wlBaseUrl,
  variant = 'card',
  onMouseEnter,
  onMouseLeave,
}: {
  hotel: HotelData;
  wlBaseUrl: string;
  variant?: 'card' | 'row';
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const price    = h.min_price?.toLocaleString('ru-RU');
  const prevPrice = h.extras?.previous_price
    ? h.extras.previous_price.toLocaleString('ru-RU') : null;
  const meal     = bestMeal(h.pansion_prices);
  const f        = h.hotel.features;
  const instant  = h.extras?.instant_confirm;
  const cheap    = h.extras?.cheap;

  const specs: string[] = [];
  if (f?.line)             specs.push(`${f.line} линия`);
  if (f?.beach_distance)   specs.push(`${f.beach_distance} м до пляжа`);
  if (f?.beach_surface && BEACH_SURFACE[f.beach_surface])
                           specs.push(BEACH_SURFACE[f.beach_surface]);
  if (f?.beach_type === 'DESIGNATED') specs.push('Свой пляж');

  return (
    <div
      className={`${styles.card} ${variant === 'row' ? styles.cardRow : ''}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* ── Фото ── */}
      <div className={styles.imageWrap}>
        {h.hotel.images?.[0]?.x500
          ? <img
              src={h.hotel.images[0].x500}
              alt={h.hotel.name}
              className={styles.image}
              loading="lazy"
            />
          : <div className={styles.imagePlaceholder}>🏨</div>
        }

        {/* Верх: бейджи + звёзды */}
        <div className={styles.imageTop}>
          <div className={styles.labels}>
            {instant && (
              <span className={`${styles.label} ${styles.labelInstant}`}>
                ⚡ Моментально
              </span>
            )}
            {cheap && (
              <span className={`${styles.label} ${styles.labelCheap}`}>
                🔥 Горящий
              </span>
            )}
          </div>
          {h.hotel.stars > 0 && (
            <div className={styles.stars}>
              {Array.from({ length: h.hotel.stars }).map((_, i) => (
                <span key={i} className={styles.star}>★</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Тело ── */}
      <div className={styles.body}>
        {/* Название + рейтинг */}
        <div className={styles.titleRow}>
          <h3 className={styles.name}>{h.hotel.name}</h3>
          {h.hotel.rating > 0 && (
            <span className={`${styles.rating} ${ratingClass(h.hotel.rating)}`}>
              {h.hotel.rating.toFixed(1)}
            </span>
          )}
        </div>

        {/* Локация */}
        <p className={styles.location}>
          <span className={styles.locationIcon}>📍</span>
          {h.hotel.region_name}
          {h.hotel.city !== h.hotel.region_name && ` · ${h.hotel.city}`}
        </p>

        {/* Характеристики */}
        {specs.length > 0 && (
          <div className={styles.specs}>
            {specs.map(s => <span key={s} className={styles.spec}>{s}</span>)}
          </div>
        )}

        <div className={styles.divider} />

        {/* Питание */}
        {meal && (
          <div className={styles.mealRow}>
            <span className={styles.mealBadge}>{meal.name}</span>
          </div>
        )}

        {/* Цена + кнопка */}
        <div className={styles.footer}>
          <div className={styles.priceBlock}>
            <div className={styles.priceFrom}>от</div>
            <div>
              <span className={styles.price}>{price} ₽</span>
              {prevPrice && (
                <span className={styles.pricePrev}>{prevPrice} ₽</span>
              )}
            </div>
            <div className={styles.nights}>{h.min_price_nights} {nights(h.min_price_nights)}</div>
          </div>
          <button
            className={styles.bookBtn}
            onClick={() => window.open(`${wlBaseUrl}${h.hotel.link}`, '_blank')}
          >
            Смотреть
          </button>
        </div>
      </div>
    </div>
  );
}

function nights(n: number) {
  if (n === 1) return 'ночь';
  if (n >= 2 && n <= 4) return 'ночи';
  return 'ночей';
}
