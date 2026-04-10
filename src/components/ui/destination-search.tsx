'use client';
import { useRef, useState } from 'react';
import { DESTINATION_OPTIONS, DestinationOption } from '@/lib/destinations';
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
};

export function DestinationSearch({ value, onChange, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim().length === 0
    ? DESTINATION_OPTIONS
    : DESTINATION_OPTIONS.filter(d =>
        d.label.toLowerCase().includes(query.toLowerCase()) ||
        d.toCity.toLowerCase().includes(query.toLowerCase())
      );

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
        {Object.keys(grouped).length === 0 && (
          <p className={styles.empty}>Ничего не найдено</p>
        )}
        {(['mass', 'growing', 'premium'] as const).map(cat => {
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
                  onClick={() => handleSelect(d)}
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
