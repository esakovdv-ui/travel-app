import Link from 'next/link';
import type { PackageFilters } from '@/types/travel';
import styles from './search-filters.module.css';

const CATEGORIES = [
  { value: '', label: 'Все направления', toneClass: '' },
  { value: 'warm', label: 'Жаркие страны', toneClass: styles.tabWarm },
  { value: 'cold', label: 'Холодные страны', toneClass: styles.tabCold },
  { value: 'active', label: 'Активный отдых', toneClass: styles.tabActiveTone }
];

export function SearchFilters({
  destinations,
  filters
}: {
  destinations: string[];
  filters: PackageFilters;
}) {
  return (
    <div className={styles.filters}>
      <form action="/packages" method="GET" className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="sf-query">Поиск</label>
          <input
            id="sf-query"
            className="input"
            defaultValue={filters.query}
            name="query"
            placeholder="Направление, страна или тема..."
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="sf-dest">Направление</label>
          <select id="sf-dest" className="select" defaultValue={filters.destination ?? ''} name="destination">
            <option value="">Все направления</option>
            {destinations.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="sf-min">Цена от</label>
          <input
            id="sf-min"
            className="input"
            defaultValue={filters.minPrice}
            min="0"
            name="minPrice"
            placeholder="0"
            type="number"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="sf-max">Цена до</label>
          <input
            id="sf-max"
            className="input"
            defaultValue={filters.maxPrice}
            min="0"
            name="maxPrice"
            placeholder="∞"
            type="number"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="sf-days">Дней</label>
          <input
            id="sf-days"
            className="input"
            defaultValue={filters.duration}
            min="1"
            max="30"
            name="duration"
            placeholder="Любое"
            type="number"
          />
        </div>

        <button className={`btn btn-primary ${styles.submitButton}`} type="submit">
          Найти
        </button>
      </form>

      {/* Category quick-tabs */}
      <div className={styles.categoryTabs} role="group" aria-label="Тип отдыха">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.value}
            href={cat.value ? `/packages?category=${cat.value}` : '/packages'}
            className={`${styles.tab} ${cat.toneClass} ${filters.category === cat.value || (!filters.category && cat.value === '') ? styles.tabActive : ''}`}
          >
            {cat.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
