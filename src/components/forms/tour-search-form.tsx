'use client';
import { useState } from 'react';
import { DateRangePicker, DateRangeValue } from '@/components/ui/date-range-picker';
import { DestinationSearch } from '@/components/ui/destination-search';
import { DESTINATION_OPTIONS, DestinationOption } from '@/lib/destinations';
import styles from './tour-search-form.module.css';

export interface TourSearchValues {
  toCountry: string;
  toCity?: string;
  startDateFrom: string; // DD.MM.YYYY
  startDateTill: string;
  endDateFrom: string;
  endDateTill: string;
  adults: number;
  kids: number;
  kidsAges: number[];
  fromCity: string;
}

interface Props {
  initialValues?: Partial<TourSearchValues>;
  onSearch: (v: TourSearchValues) => void;
  loading: boolean;
  showFromCity?: boolean; // false для /hotels
  submitLabel?: string;
}

const FROM_CITIES = [
  { code: 'Moscow',           name: 'Москва' },
  { code: 'Saint Petersburg', name: 'Санкт-Петербург' },
  { code: 'Ekaterinburg',     name: 'Екатеринбург' },
  { code: 'Novosibirsk',      name: 'Новосибирск' },
  { code: 'Kazan',            name: 'Казань' },
  { code: 'Krasnodar',        name: 'Краснодар' },
  { code: 'Samara',           name: 'Самара' },
];

function isoToLT(iso: string, flexDays: number, sign: 1 | -1): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + sign * flexDays);
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

function ltToISO(ddmmyyyy: string): string {
  if (!ddmmyyyy) return '';
  const [dd, mm, yyyy] = ddmmyyyy.split('.');
  return `${yyyy}-${mm}-${dd}`;
}

function ageLabel(n: number) {
  if (n === 1) return 'год';
  if (n >= 2 && n <= 4) return 'года';
  return 'лет';
}

export function TourSearchForm({ initialValues, onSearch, loading, showFromCity = true, submitLabel = 'Найти туры' }: Props) {
  const initDestination = DESTINATION_OPTIONS.find(
    d => d.toCountry === initialValues?.toCountry && (!initialValues?.toCity || d.toCity === initialValues?.toCity)
  ) ?? null;

  const [destination, setDestination] = useState<DestinationOption | null>(initDestination);
  const [fromCity, setFromCity] = useState(initialValues?.fromCity ?? 'Moscow');
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    start: initialValues?.startDateFrom ? ltToISO(initialValues.startDateFrom) : null,
    end: initialValues?.endDateFrom ? ltToISO(initialValues.endDateFrom) : null,
    flex: 0,
  });
  const [adults, setAdults] = useState(initialValues?.adults ?? 2);
  const [kids, setKids] = useState(initialValues?.kids ?? 0);
  const [kidsAges, setKidsAges] = useState<number[]>(initialValues?.kidsAges ?? []);
  const [calendarOpen, setCalendarOpen] = useState(false);

  function handleKidsChange(n: number) {
    const next = Math.max(0, n);
    setKids(next);
    setKidsAges(prev => {
      if (prev.length < next) return [...prev, ...Array(next - prev.length).fill(5)];
      return prev.slice(0, next);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dateRange.start || !dateRange.end) { setCalendarOpen(true); return; }
    onSearch({
      toCountry: destination?.toCountry ?? 'TR',
      toCity: destination?.toCity,
      startDateFrom: isoToLT(dateRange.start, dateRange.flex, -1),
      startDateTill: isoToLT(dateRange.start, dateRange.flex, 1),
      endDateFrom: isoToLT(dateRange.end, dateRange.flex, -1),
      endDateTill: isoToLT(dateRange.end, dateRange.flex, 1),
      adults,
      kids,
      kidsAges,
      fromCity,
    });
  }

  const whenLabel = dateRange.start && dateRange.end
    ? (() => {
        const s = new Date(dateRange.start + 'T00:00:00');
        const e = new Date(dateRange.end + 'T00:00:00');
        const nights = Math.round((e.getTime() - s.getTime()) / 86400000);
        const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
        const flexStr = dateRange.flex > 0 ? ` (±${dateRange.flex} д.)` : '';
        return `${fmt(s)} – ${fmt(e)}, ${nights} н.${flexStr}`;
      })()
    : null;

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.grid}>

        {/* Куда */}
        <div className={styles.field}>
          <label className={styles.label}>Куда</label>
          <div className={styles.destWrap}>
            <DestinationSearch
              value={destination}
              onChange={setDestination}
              onSelect={() => setCalendarOpen(true)}
            />
          </div>
        </div>

        {/* Откуда (только туры) */}
        {showFromCity && (
          <div className={styles.field}>
            <label className={styles.label}>Откуда</label>
            <select className={styles.select} value={fromCity} onChange={e => setFromCity(e.target.value)}>
              {FROM_CITIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
        )}

        {/* Когда */}
        <div className={styles.fieldWide}>
          <label className={styles.label}>Даты</label>
          <button
            type="button"
            className={`${styles.select} ${styles.dateBtn}`}
            onClick={() => setCalendarOpen(v => !v)}
          >
            {whenLabel ?? 'Выберите даты'}
          </button>
          {calendarOpen && (
            <div className={styles.calendarWrap}>
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
                onConfirm={() => setCalendarOpen(false)}
              />
            </div>
          )}
        </div>

        {/* Взрослых */}
        <div className={styles.field}>
          <label className={styles.label}>Взрослых</label>
          <select className={styles.select} value={adults} onChange={e => setAdults(+e.target.value)}>
            {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {/* Детей */}
        <div className={styles.field}>
          <label className={styles.label}>Детей</label>
          <select className={styles.select} value={kids} onChange={e => handleKidsChange(+e.target.value)}>
            {[0,1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* Возраст детей */}
      {kidsAges.length > 0 && (
        <div className={styles.kidsAges}>
          {kidsAges.map((age, i) => (
            <div key={i} className={styles.kidsAgeField}>
              <label className={styles.label}>Ребёнок {i + 1}</label>
              <select className={styles.select} value={age}
                onChange={e => { const next = [...kidsAges]; next[i] = +e.target.value; setKidsAges(next); }}
              >
                {Array.from({ length: 18 }, (_, n) => (
                  <option key={n} value={n}>{n === 0 ? 'До 1 года' : `${n} ${ageLabel(n)}`}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      <button type="submit" className={styles.submitBtn} disabled={loading}>
        {loading ? 'Ищем...' : submitLabel}
      </button>
    </form>
  );
}
