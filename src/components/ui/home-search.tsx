'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './home-search.module.css';

type SearchTab = 'stays' | 'experiences' | 'services';
type SearchField = 'where' | 'when' | 'who';

const SEARCH_TABS: Array<{
  id: SearchTab;
  label: string;
  hint: string;
  badge?: string;
}> = [
  { id: 'stays', label: 'Отели', hint: 'Отели, санатории, апартаменты' },
  { id: 'experiences', label: 'Туры', hint: 'Проживание и перелет'},
  { id: 'services', label: 'Лагеря', hint: 'Лучший детский отдых'}
];

const SEARCH_PILLS = ['Популярно: Япония', 'На майские', 'С детьми', 'До 7 дней'];

const GUEST_GROUPS = [
  { id: 'adults', label: 'Взрослые', hint: 'От 13 лет' },
  { id: 'children', label: 'Дети', hint: 'Возраст от 2 до 12' },
  { id: 'infants', label: 'Младенцы', hint: 'Младше 2' },
  { id: 'pets', label: 'Домашние животные', hint: 'Если путешествуете с питомцем' }
] as const;

type GuestKey = (typeof GUEST_GROUPS)[number]['id'];

const initialGuests: Record<GuestKey, number> = {
  adults: 0,
  children: 0,
  infants: 0,
  pets: 0
};

export function HomeSearch() {
  const rootRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [activeTab, setActiveTab] = useState<SearchTab>('stays');
  const [activeField, setActiveField] = useState<SearchField | null>(null);
  const [where, setWhere] = useState('');
  const [when, setWhen] = useState('');
  const [guests, setGuests] = useState(initialGuests);
  const [isCompact, setIsCompact] = useState(false);

  // Collapse when clicking outside
  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setActiveField(null);
      }
    }
    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, []);

  // Detect when search bar leaves viewport → show compact sticky bar
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsCompact(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-82px 0px 0px 0px' }
    );
    if (formRef.current) observer.observe(formRef.current);
    return () => observer.disconnect();
  }, []);

  const guestsTotal = guests.adults + guests.children + guests.infants + guests.pets;
  const guestsLabel = guestsTotal > 0 ? `${guestsTotal} ${guestsTotal === 1 ? 'гость' : 'гостей'}` : 'Кто едет?';

  function changeGuests(key: GuestKey, delta: number) {
    setGuests((current) => ({
      ...current,
      [key]: Math.max(0, current[key] + delta)
    }));
  }

  function scrollToSearch() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => setActiveField('where'), 400);
  }

  return (
    <div className={styles.wrap} ref={rootRef}>
      {/* Compact sticky bar — appears on scroll */}
      <div className={`${styles.compactBar} ${isCompact ? styles.compactBarVisible : ''}`} onClick={scrollToSearch} role="button" tabIndex={0} aria-label="Открыть поиск">
        <span className={styles.compactSegment}>{where || 'Искать везде'}</span>
        <span className={styles.compactDivider} aria-hidden="true" />
        <span className={styles.compactSegment}>{when || 'Любые даты'}</span>
        <span className={styles.compactDivider} aria-hidden="true" />
        <span className={`${styles.compactSegment} ${styles.compactSegmentMuted}`}>{guestsLabel}</span>
        <span className={styles.compactSearchBtn} aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="8" cy="8" r="5.25" />
            <path d="M12 12l3.5 3.5" strokeLinecap="round" />
          </svg>
        </span>
      </div>

      {/* Tabs */}
      <div className={styles.tabs} role="tablist" aria-label="Тип поиска">
        {SEARCH_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className={styles.tabIcon} aria-hidden="true">
              {tab.id === 'stays' ? '⌂' : tab.id === 'experiences' ? '◌' : '✦'}
            </span>
            <span className={styles.tabText}>
              <span className={styles.tabLabel}>{tab.label}</span>
              <span className={styles.tabHint}>{tab.hint}</span>
            </span>
            {tab.badge ? <span className={styles.tabBadge}>{tab.badge}</span> : null}
          </button>
        ))}
      </div>

      <form action="/packages" className={styles.form} method="GET" role="search" ref={formRef}>
        <input name="category" type="hidden" value={activeTab === 'stays' ? '' : activeTab} />
        <input name="guests" type="hidden" value={guestsTotal} />

        <div className={styles.bar}>
          <label
            className={`${styles.segment} ${activeField === 'where' ? styles.segmentActive : ''}`}
            onClick={() => setActiveField('where')}
          >
            <span className={styles.segmentLabel}>Где</span>
            <input
              className={styles.segmentInput}
              name="query"
              placeholder="Поиск направлений"
              type="search"
              value={where}
              onChange={(event) => setWhere(event.target.value)}
            />
          </label>

          <div
            className={`${styles.divider} ${activeField === 'where' || activeField === 'when' ? styles.dividerHidden : ''}`}
            aria-hidden="true"
          />

          <label
            className={`${styles.segment} ${activeField === 'when' ? styles.segmentActive : ''}`}
            onClick={() => setActiveField('when')}
          >
            <span className={styles.segmentLabel}>Когда</span>
            <input
              className={styles.segmentInput}
              name="dates"
              placeholder="Когда?"
              type="text"
              value={when}
              onChange={(event) => setWhen(event.target.value)}
            />
          </label>

          <div
            className={`${styles.divider} ${activeField === 'when' || activeField === 'who' ? styles.dividerHidden : ''}`}
            aria-hidden="true"
          />

          <div
            className={`${styles.segment} ${styles.segmentWho} ${activeField === 'who' ? styles.segmentActive : ''}`}
            onClick={() => setActiveField('who')}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setActiveField('who');
              }
            }}
          >
            <div className={styles.segmentText}>
              <span className={styles.segmentLabel}>Кто</span>
              <span className={styles.segmentValue}>{guestsLabel}</span>
            </div>

            <button className={styles.searchButton} type="submit" aria-label="Искать">
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="8" cy="8" r="5.25" />
                <path d="M12 12l3.5 3.5" strokeLinecap="round" />
              </svg>
              <span className={styles.searchButtonText}>Поиск</span>
            </button>
          </div>
        </div>

        {activeField === 'who' ? (
          <div className={styles.popover}>
            {GUEST_GROUPS.map((group) => (
              <div className={styles.popoverRow} key={group.id}>
                <div>
                  <p className={styles.popoverLabel}>{group.label}</p>
                  <p className={styles.popoverHint}>{group.hint}</p>
                </div>
                <div className={styles.counter}>
                  <button
                    className={styles.counterButton}
                    type="button"
                    onClick={() => changeGuests(group.id, -1)}
                    disabled={guests[group.id] === 0}
                    aria-label={`Уменьшить: ${group.label}`}
                  >
                    −
                  </button>
                  <span className={styles.counterValue}>{guests[group.id]}</span>
                  <button
                    className={styles.counterButton}
                    type="button"
                    onClick={() => changeGuests(group.id, 1)}
                    aria-label={`Увеличить: ${group.label}`}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </form>

      <div className={styles.pills}>
        {SEARCH_PILLS.map((item) => (
          <span className={styles.pill} key={item}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
