'use client';
import { useState, useEffect } from 'react';
import {
  MagnifyingGlassIcon, MapPinIcon, CalendarBlankIcon,
  UsersThreeIcon, AirplaneTakeoffIcon, BuildingsIcon,
} from '@/components/icons';
import { DateRangePicker, DateRangeValue } from './date-range-picker';
import { DestinationSearch } from './destination-search';
import { DestinationOption, DESTINATION_OPTIONS } from '@/lib/destinations';
import styles from './search-bar.module.css';

export type SearchTab = 'stays' | 'experiences';

export interface SearchBarValues {
  toCountry: string;
  toCity?: string;
  startDateFrom: string;
  startDateTill: string;
  endDateFrom: string;
  endDateTill: string;
  adults: number;
  kids: number;
  kidsAges: number[];
  fromCity: string;
  tab: SearchTab;
}

export interface SearchBarSnapshot {
  destinationLabel: string;
  whenLabel: string;
  guestsLabel: string;
}

interface Props {
  initialValues?: Partial<SearchBarValues>;
  onSearch: (v: SearchBarValues) => void;
  loading?: boolean;
  showTabs?: boolean;
  initialTab?: SearchTab;
  tab?: SearchTab;           // controlled from outside
  onTabChange?: (t: SearchTab) => void;
  onValuesChange?: (snap: SearchBarSnapshot) => void;
}

const TABS = [
  { id: 'stays' as SearchTab,       label: 'Отели',  hint: 'Без перелёта',          icon: <BuildingsIcon weight="light" size={16} /> },
  { id: 'experiences' as SearchTab, label: 'Туры',   hint: 'Проживание + перелёт',   icon: <AirplaneTakeoffIcon weight="light" size={16} /> },
];

const FROM_CITIES = [
  { code: 'Moscow',           name: 'Москва' },
  { code: 'Saint Petersburg', name: 'Санкт-Петербург' },
  { code: 'Ekaterinburg',     name: 'Екатеринбург' },
  { code: 'Novosibirsk',      name: 'Новосибирск' },
  { code: 'Kazan',            name: 'Казань' },
  { code: 'Krasnodar',        name: 'Краснодар' },
  { code: 'Samara',           name: 'Самара' },
];

function isoToLT(iso: string, flex: number, sign: 1 | -1): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + sign * flex);
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

function ltToISO(s: string): string {
  if (!s) return '';
  const [dd, mm, yyyy] = s.split('.');
  return `${yyyy}-${mm}-${dd}`;
}

function ageLabel(n: number) {
  if (n === 1) return 'год';
  if (n >= 2 && n <= 4) return 'года';
  return 'лет';
}

function nightsWord(n: number) {
  if (n === 1) return 'ночь';
  if (n >= 2 && n <= 4) return 'ночи';
  return 'ночей';
}

export function SearchBar({
  initialValues, onSearch, loading,
  showTabs = false, initialTab, tab: tabProp, onTabChange, onValuesChange,
}: Props) {
  const [internalTab, setInternalTab] = useState<SearchTab>(
    tabProp ?? initialValues?.tab ?? initialTab ?? 'stays'
  );
  const tab = tabProp ?? internalTab;
  const showFromCity = tab === 'experiences';

  function handleTabChange(t: SearchTab) {
    if (tabProp === undefined) setInternalTab(t);
    onTabChange?.(t);
  }

  const initDest = DESTINATION_OPTIONS.find(
    d => d.toCountry === initialValues?.toCountry &&
      (!initialValues?.toCity || d.toCity === initialValues?.toCity)
  ) ?? null;

  const [destination, setDestination] = useState<DestinationOption | null>(initDest);
  const [fromCity, setFromCity] = useState(initialValues?.fromCity ?? 'Moscow');
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    start: initialValues?.startDateFrom ? ltToISO(initialValues.startDateFrom) : null,
    end:   initialValues?.endDateFrom   ? ltToISO(initialValues.endDateFrom)   : null,
    flex:  0,
  });
  const [adults, setAdults] = useState(initialValues?.adults ?? 2);
  const [kids, setKids] = useState(initialValues?.kids ?? 0);
  const [kidsAges, setKidsAges] = useState<number[]>(initialValues?.kidsAges ?? []);
  const [activeField, setActiveField] = useState<string | null>(null);

  // Labels
  const whenLabel = (() => {
    if (!dateRange.start || !dateRange.end) return null;
    const s = new Date(dateRange.start + 'T00:00:00');
    const e = new Date(dateRange.end + 'T00:00:00');
    const n = Math.round((e.getTime() - s.getTime()) / 86400000);
    const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const fmt = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
    return `${fmt(s)} – ${fmt(e)}, ${n} ${nightsWord(n)}${dateRange.flex > 0 ? ` ±${dateRange.flex}д` : ''}`;
  })();

  const guestsLabel = `${adults} взр.${kids > 0 ? `, ${kids} дет.` : ''}`;
  const fromCityName = FROM_CITIES.find(c => c.code === fromCity)?.name ?? fromCity;

  // Notify parent of current values (for compact pill)
  useEffect(() => {
    onValuesChange?.({
      destinationLabel: destination?.label ?? '',
      whenLabel: whenLabel ?? '',
      guestsLabel,
    });
  }, [destination, whenLabel, guestsLabel, onValuesChange]);

  function toggle(field: string) {
    setActiveField(v => v === field ? null : field);
  }

  function handleKidsChange(n: number) {
    const next = Math.max(0, n);
    setKids(next);
    setKidsAges(prev =>
      prev.length < next
        ? [...prev, ...Array(next - prev.length).fill(5)]
        : prev.slice(0, next)
    );
  }

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!dateRange.start || !dateRange.end) { setActiveField('when'); return; }
    onSearch({
      toCountry:     destination?.toCountry ?? 'TR',
      toCity:        destination?.toCity,
      startDateFrom: isoToLT(dateRange.start, dateRange.flex, -1),
      startDateTill: isoToLT(dateRange.start, dateRange.flex,  1),
      endDateFrom:   isoToLT(dateRange.end,   dateRange.flex, -1),
      endDateTill:   isoToLT(dateRange.end,   dateRange.flex,  1),
      adults, kids, kidsAges, fromCity, tab,
    });
    setActiveField(null);
  }

  return (
    <div className={styles.wrap}>
      {/* Tabs */}
      {showTabs && (
        <div className={styles.tabs} role="tablist">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
              onClick={() => handleTabChange(t.id)}
            >
              <span className={styles.tabIcon}>{t.icon}</span>
              <span className={styles.tabText}>
                <span className={styles.tabLabel}>{t.label}</span>
                <span className={styles.tabHint}>{t.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={`${styles.bar} ${showFromCity ? styles.barTours : ''}`}>

          {/* Откуда — только для туров */}
          {showFromCity && (<>
            <div
              className={`${styles.seg} ${activeField === 'from' ? styles.segActive : ''}`}
              onClick={() => toggle('from')}
              role="button" tabIndex={0}
            >
              <span className={styles.segRow}>
                <AirplaneTakeoffIcon weight="regular" size={14} />
                <span className={styles.segLabel}>Откуда</span>
              </span>
              <span className={styles.segValue}>{fromCityName}</span>
              {activeField === 'from' && (
                <div className={styles.popover} onClick={e => e.stopPropagation()}>
                  {FROM_CITIES.map(c => (
                    <button key={c.code} type="button"
                      className={`${styles.popoverRow} ${fromCity === c.code ? styles.popoverRowActive : ''}`}
                      onClick={() => { setFromCity(c.code); setActiveField(null); }}
                    >{c.name}</button>
                  ))}
                </div>
              )}
            </div>
            <div className={`${styles.div} ${activeField === 'from' || activeField === 'where' ? styles.divHidden : ''}`} />
          </>)}

          {/* Куда */}
          <div
            className={`${styles.seg} ${activeField === 'where' ? styles.segActive : ''}`}
            onClick={() => setActiveField('where')}
            role="button" tabIndex={0}
          >
            <span className={styles.segRow}>
              <MapPinIcon weight="regular" size={14} />
              <span className={styles.segLabel}>Куда</span>
            </span>
            {activeField === 'where' ? (
              <DestinationSearch
                value={destination}
                onChange={setDestination}
                onSelect={() => setActiveField('when')}
              />
            ) : (
              <span className={`${styles.segValue} ${!destination ? styles.segPlaceholder : ''}`}>
                {destination?.label ?? 'Выберите направление'}
              </span>
            )}
          </div>

          <div className={`${styles.div} ${activeField === 'where' || activeField === 'when' ? styles.divHidden : ''}`} />

          {/* Когда */}
          <div
            className={`${styles.seg} ${activeField === 'when' ? styles.segActive : ''}`}
            onClick={() => toggle('when')}
            role="button" tabIndex={0}
          >
            <span className={styles.segRow}>
              <CalendarBlankIcon weight="regular" size={14} />
              <span className={styles.segLabel}>Когда</span>
            </span>
            <span className={`${styles.segValue} ${!whenLabel ? styles.segPlaceholder : ''}`}>
              {whenLabel ?? 'Выберите даты'}
            </span>
            {activeField === 'when' && (
              <div className={`${styles.popover} ${styles.popoverCalendar}`} onClick={e => e.stopPropagation()}>
                <DateRangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  onConfirm={() => setActiveField('who')}
                />
              </div>
            )}
          </div>

          <div className={`${styles.div} ${activeField === 'when' || activeField === 'who' ? styles.divHidden : ''}`} />

          {/* Кто */}
          <div
            className={`${styles.seg} ${styles.segWho} ${activeField === 'who' ? styles.segActive : ''}`}
            onClick={() => toggle('who')}
            role="button" tabIndex={0}
          >
            <div className={styles.segText}>
              <span className={styles.segRow}>
                <UsersThreeIcon weight="regular" size={14} />
                <span className={styles.segLabel}>Кто едет</span>
              </span>
              <span className={styles.segValue}>{guestsLabel}</span>
            </div>
            <button className={styles.submitBtn} type="submit" disabled={loading}>
              <MagnifyingGlassIcon weight="bold" size={15} />
              <span className={styles.submitBtnText}>{loading ? 'Ищем...' : 'Поиск'}</span>
            </button>
            {activeField === 'who' && (
              <div className={`${styles.popover} ${styles.popoverRight}`} onClick={e => e.stopPropagation()}>
                <div className={styles.guestRow}>
                  <div>
                    <p className={styles.guestLabel}>Взрослые</p>
                    <p className={styles.guestHint}>От 13 лет</p>
                  </div>
                  <div className={styles.counter}>
                    <button type="button" className={styles.counterBtn} onClick={() => setAdults(v => Math.max(1, v - 1))}>−</button>
                    <span className={styles.counterVal}>{adults}</span>
                    <button type="button" className={styles.counterBtn} onClick={() => setAdults(v => Math.min(8, v + 1))}>+</button>
                  </div>
                </div>
                <div className={styles.guestRow}>
                  <div>
                    <p className={styles.guestLabel}>Дети</p>
                    <p className={styles.guestHint}>До 12 лет</p>
                  </div>
                  <div className={styles.counter}>
                    <button type="button" className={styles.counterBtn} onClick={() => handleKidsChange(kids - 1)} disabled={kids === 0}>−</button>
                    <span className={styles.counterVal}>{kids}</span>
                    <button type="button" className={styles.counterBtn} onClick={() => handleKidsChange(kids + 1)}>+</button>
                  </div>
                </div>
                {kidsAges.length > 0 && (
                  <div className={styles.kidsAges}>
                    <p className={styles.kidsAgesTitle}>Возраст детей</p>
                    {kidsAges.map((age, i) => (
                      <div key={i} className={styles.kidsAgeRow}>
                        <span className={styles.guestHint}>Ребёнок {i + 1}</span>
                        <select className={styles.ageSelect} value={age}
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
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
