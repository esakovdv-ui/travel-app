'use client';
import { useState, useEffect, Suspense, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { HotelCard, HotelData } from '@/components/tours/hotel-card';
import { FiltersPanel, FiltersData, ActiveFilters, EMPTY_FILTERS } from '@/components/tours/filters-panel';
import { Preloader } from '@/components/ui/preloader';
import styles from '../tours/tours.module.css';

const HotelMap = dynamic(
  () => import('@/components/tours/hotel-map').then(m => m.HotelMap),
  { ssr: false }
);

function applyFilters(hotels: HotelData[], f: ActiveFilters): HotelData[] {
  return hotels.filter(h => {
    if (f.priceMin !== null && h.min_price < f.priceMin) return false;
    if (f.priceMax !== null && h.min_price > f.priceMax) return false;
    if (f.stars.length > 0 && !f.stars.includes(h.hotel.stars)) return false;
    if (f.ratingMin !== null && h.hotel.rating < f.ratingMin) return false;
    if (f.meals.length > 0) {
      const hotelMeals = Object.keys(h.pansion_prices ?? {});
      if (!f.meals.some(m => hotelMeals.includes(m))) return false;
    }
    if (f.regions.length > 0 && !f.regions.includes(h.hotel.region_name)) return false;
    if (f.line.length > 0 && !f.line.includes(h.hotel.features?.line ?? 0)) return false;
    if (f.beachType.length > 0 && !f.beachType.includes(h.hotel.features?.beach_type ?? '')) return false;
    if (f.instantConfirm && !h.extras?.instant_confirm) return false;
    return true;
  });
}

function HotelsPageInner() {
  const searchParams = useSearchParams();
  const [hotels, setHotels]   = useState<HotelData[]>([]);
  const [filters, setFilters] = useState<FiltersData>({});
  const [active, setActive]   = useState<ActiveFilters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);


  const wlBaseUrl = process.env.NEXT_PUBLIC_WL_BASE_URL ?? '';

  useEffect(() => {
    const startDateFrom = searchParams.get('startDateFrom') ?? searchParams.get('startDate');
    if (!startDateFrom) return;

    setLoading(true);
    setError(null);
    setHotels([]);
    setFilters({});
    setActive(EMPTY_FILTERS);
    setSearched(true);

    const params = new URLSearchParams({
      toCountry:     searchParams.get('toCountry')     ?? 'TR',
      startDateFrom,
      startDateTill: searchParams.get('startDateTill') ?? startDateFrom,
      endDateFrom:   searchParams.get('endDateFrom')   ?? '',
      endDateTill:   searchParams.get('endDateTill')   ?? '',
      adults:        searchParams.get('adults')        ?? '2',
      fromCity:      searchParams.get('fromCity')      ?? 'Moscow',
      searchType:    'auto',
      ...(searchParams.get('toCity') ? { toCity: searchParams.get('toCity')! } : {}),
      ...(Number(searchParams.get('kids') ?? 0) > 0 ? {
        kids:     searchParams.get('kids')!,
        kidsAges: searchParams.get('kidsAges') ?? '',
      } : {}),
    });

    fetch(`/api/search?${params}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) throw new Error(data.error);
        setHotels(data.hotels ?? []);
        setFilters(data.filters ?? {});
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Неизвестная ошибка'))
      .finally(() => setLoading(false));
  }, [searchParams]);

  const filtered = useMemo(() => applyFilters(hotels, active), [hotels, active]);
  const hasMap   = useMemo(() => filtered.some(h => h.hotel.lat && h.hotel.long), [filtered]);

  return (
    <div className={styles.page}>
      <Preloader show={loading} />

      {error && <div className={styles.error}>Ошибка: {error}</div>}

      {!loading && hotels.length > 0 && (
        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <FiltersPanel
              data={filters}
              active={active}
              onChange={setActive}
              totalCount={hotels.length}
              filteredCount={filtered.length}
            />
          </aside>

          <div className={styles.results}>
            <div className={styles.resultsHeader}>
              <p className={styles.resultsCount}>
                {filtered.length !== hotels.length
                  ? `${filtered.length} из ${hotels.length} отелей`
                  : `${hotels.length} отелей`}
              </p>
            </div>

            {filtered.length > 0 ? (
              <div className={styles.grid}>
                {filtered.map(h => (
                  <HotelCard
                    key={h.tour_id}
                    hotel={h}
                    wlBaseUrl={wlBaseUrl}
                    variant="row"
                    onMouseEnter={() => setHoveredId(h.tour_id)}
                    onMouseLeave={() => setHoveredId(null)}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                Ни один отель не соответствует фильтрам —{' '}
                <button className={styles.resetLink} onClick={() => setActive(EMPTY_FILTERS)}>
                  сбросить фильтры
                </button>
              </div>
            )}
          </div>

          {hasMap && (
            <div className={styles.mapPanel}>
              <HotelMap hotels={filtered} hoveredId={hoveredId} wlBaseUrl={wlBaseUrl} />
            </div>
          )}
        </div>
      )}

      {!loading && !error && hotels.length === 0 && (
        <div className={styles.empty}>
          {searched
            ? 'По вашему запросу ничего не найдено — попробуйте другую дату или страну'
            : 'Выберите направление и даты, затем нажмите «Поиск»'}
        </div>
      )}
    </div>
  );
}

export default function HotelsPage() {
  return (
    <Suspense>
      <HotelsPageInner />
    </Suspense>
  );
}
