'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { DESTINATION_OPTIONS, DestinationOption, normalizeDestination } from '@/lib/destinations';
import styles from './destination-search.module.css';

interface Props {
  value: DestinationOption | null;
  onChange: (v: DestinationOption | null) => void;
  onSelect: () => void; // закрыть и перейти к следующему полю
}

const CATEGORY_LABELS = {
  mass: 'Популярные',
  growing: 'Набирают популярность',
  premium: 'Премиум',
  catalog: 'Другие направления',
};

export function DestinationSearch({ value, onChange, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const search = normalizeDestination(query);
  const [directory, setDirectory] = useState<{ query: string; options: DestinationOption[] }>();
  useEffect(() => {
    if (search.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: search });
        const response = await fetch(`/api/destinations?${params}`, { signal: controller.signal });
        const options = response.ok ? await response.json() as DestinationOption[] : [];
        if (!controller.signal.aborted) setDirectory({ query: search, options });
      } catch {
        if (!controller.signal.aborted) setDirectory({ query: search, options: [] });
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  const local = search
    ? DESTINATION_OPTIONS.filter(d =>
        [d.label, d.toCity, ...(d.aliases ?? [])].some(value =>
          normalizeDestination(value).includes(search)
        )
      )
    : DESTINATION_OPTIONS;
  const remote = search.length >= 2 && directory?.query === search ? directory.options : [];
  const filtered = [...local, ...remote.filter(option => !local.some(d =>
    d.toCountry === option.toCountry && normalizeDestination(d.toCity) === normalizeDestination(option.toCity)
  ))];
  const loading = search.length >= 2 && directory?.query !== search;

  // Группируем по категории
  const grouped = filtered.reduce<Record<string, DestinationOption[]>>((acc, d) => {
    (acc[d.category] ??= []).push(d);
    return acc;
  }, {});

  function handleSelect(d: DestinationOption) {
    onChange(d);
    setQuery('');
    onSelect();
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
    setQuery('');
    inputRef.current?.focus();
  }

  return (
    <div className={styles.wrap}>
      <input
        ref={inputRef}
        className={styles.input}
        placeholder={value ? value.label : 'Куда едем?'}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => { if (value) setQuery(''); }}
      />
      {value && !query && (
        <button type="button" className={styles.clearBtn} onClick={handleClear}>×</button>
      )}
      <div className={styles.dropdown}>
        {loading && <p className={styles.empty} role="status">Ищем направления…</p>}
        {!loading && filtered.length === 0 && (
          <div className={styles.empty}>
            <strong>Не нашли это направление</strong>
            <p>Попробуйте ближайший крупный город или начните подбор с дат и бюджета.</p>
            <Link
              className={styles.helpLink}
              href="/podbor.html?utm_source=motrip&utm_medium=site&utm_campaign=destination_no_match"
              onClick={event => event.stopPropagation()}
            >
              Подобрать поездку →
            </Link>
          </div>
        )}
        {(['mass', 'growing', 'premium', 'catalog'] as const).map(cat => {
          const items = grouped[cat];
          if (!items?.length) return null;
          return (
            <div key={cat}>
              <p className={styles.groupLabel}>{CATEGORY_LABELS[cat]}</p>
              {items.map(d => (
                <button
                  key={`${d.toCountry}-${d.toCity}`}
                  type="button"
                  className={`${styles.option} ${value?.toCity === d.toCity ? styles.optionActive : ''}`}
                  onClick={e => {
                    e.stopPropagation();
                    handleSelect(d);
                  }}
                >
                  <span className={styles.optionCity}>{d.labelShort}</span>
                  <span className={styles.optionCountry}>{d.label.split(', ')[1]}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
