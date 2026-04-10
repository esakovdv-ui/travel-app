'use client';
import { useState } from 'react';
import styles from './filters-panel.module.css';

// ── Типы ─────────────────────────────────────────────────────────────────
export interface FilterOption {
  id: string | number | boolean;
  name?: string;
  hotel_count: number;
  min_price?: number;
  disabled?: boolean;
  selected?: boolean;
}

export interface PricesData {
  min: number;
  max: number;
}

export interface FiltersData {
  meals?:          FilterOption[];
  regions?:        FilterOption[];
  stars?:          FilterOption[];
  rating?:         FilterOption[];
  prices?:         PricesData;
  line?:           FilterOption[];
  beach_type?:     FilterOption[];
  beach_surface?:  FilterOption[];
  instant_confirm?: FilterOption[];
}

export interface ActiveFilters {
  priceMin:       number | null;
  priceMax:       number | null;
  stars:          number[];
  ratingMin:      number | null;
  meals:          string[];
  regions:        string[];
  line:           number[];
  beachType:      string[];
  instantConfirm: boolean;
}

export const EMPTY_FILTERS: ActiveFilters = {
  priceMin: null, priceMax: null,
  stars: [], ratingMin: null,
  meals: [], regions: [], line: [],
  beachType: [], instantConfirm: false,
};

const MEAL_NAMES: Record<string, string> = {
  UAI: 'Ультра всё включено',
  AI:  'Всё включено',
  HB:  'Завтрак + ужин',
  BB:  'Завтрак',
  FB:  'Полный пансион',
  RO:  'Без питания',
};

const BEACH_TYPE_NAMES: Record<string, string> = {
  DESIGNATED: 'Собственный пляж',
  PUBLIC:     'Городской пляж',
};

function activeCount(f: ActiveFilters): number {
  return (
    (f.priceMin !== null || f.priceMax !== null ? 1 : 0) +
    f.stars.length + (f.ratingMin ? 1 : 0) +
    f.meals.length + f.regions.length +
    f.line.length + f.beachType.length +
    (f.instantConfirm ? 1 : 0)
  );
}

// ── Секция ────────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={styles.section}>
      <button className={styles.sectionHeader} onClick={() => setOpen(o => !o)}>
        <span className={styles.sectionTitle}>{title}</span>
        <span className={styles.sectionChevron}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </div>
  );
}

// ── Чекбокс-строка ────────────────────────────────────────────────────────
function CheckRow({
  label, count, checked, disabled, onChange,
}: {
  label: string; count: number; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className={`${styles.checkRow} ${disabled ? styles.checkRowDisabled : ''}`}>
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
      />
      <span className={styles.checkLabel}>{label}</span>
      <span className={styles.checkCount}>{count}</span>
    </label>
  );
}

// ── Панель фильтров ───────────────────────────────────────────────────────
interface Props {
  data:     FiltersData;
  active:   ActiveFilters;
  onChange: (f: ActiveFilters) => void;
  totalCount:    number;
  filteredCount: number;
}

export function FiltersPanel({ data, active, onChange, totalCount, filteredCount }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const cnt = activeCount(active);

  function toggle<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  }

  const panel = (
    <div className={styles.panel}>
      {/* Заголовок */}
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>Фильтры {cnt > 0 && <span className={styles.panelBadge}>{cnt}</span>}</span>
        {cnt > 0 && (
          <button className={styles.clearAll} onClick={() => onChange(EMPTY_FILTERS)}>
            Сбросить
          </button>
        )}
      </div>

      {/* Цена */}
      {data.prices && (
        <Section title="Цена">
          <div className={styles.priceRow}>
            <div className={styles.priceInput}>
              <span className={styles.priceInputLabel}>от</span>
              <input
                type="number"
                className={styles.priceField}
                placeholder={data.prices.min.toLocaleString('ru-RU')}
                value={active.priceMin ?? ''}
                min={data.prices.min}
                max={active.priceMax ?? data.prices.max}
                onChange={e => onChange({ ...active, priceMin: e.target.value ? Number(e.target.value) : null })}
              />
              <span className={styles.priceCurrency}>₽</span>
            </div>
            <span className={styles.priceDash}>—</span>
            <div className={styles.priceInput}>
              <span className={styles.priceInputLabel}>до</span>
              <input
                type="number"
                className={styles.priceField}
                placeholder={data.prices.max.toLocaleString('ru-RU')}
                value={active.priceMax ?? ''}
                min={active.priceMin ?? data.prices.min}
                max={data.prices.max}
                onChange={e => onChange({ ...active, priceMax: e.target.value ? Number(e.target.value) : null })}
              />
              <span className={styles.priceCurrency}>₽</span>
            </div>
          </div>
        </Section>
      )}

      {/* Моментальное подтверждение */}
      {(data.instant_confirm?.length ?? 0) > 0 && (() => {
        const opt = data.instant_confirm!.find(x => x.id === true);
        if (!opt) return null;
        return (
          <div className={styles.section}>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={active.instantConfirm}
                onChange={e => onChange({ ...active, instantConfirm: e.target.checked })}
              />
              <span className={styles.checkLabel}>⚡ Моментальное подтверждение</span>
              <span className={styles.checkCount}>{opt.hotel_count}</span>
            </label>
          </div>
        );
      })()}

      {/* Звёзды */}
      {(data.stars?.length ?? 0) > 0 && (
        <Section title="Звёзды">
          {[5, 4, 3, 2].map(s => {
            const opt = data.stars!.find(x => x.id === s);
            if (!opt) return null;
            return (
              <CheckRow
                key={s}
                label={'★'.repeat(s)}
                count={opt.hotel_count}
                checked={active.stars.includes(s)}
                disabled={opt.disabled}
                onChange={() => onChange({ ...active, stars: toggle(active.stars, s) })}
              />
            );
          })}
        </Section>
      )}

      {/* Рейтинг */}
      {(data.rating?.length ?? 0) > 0 && (
        <Section title="Рейтинг">
          <div className={styles.ratingPills}>
            {[6, 7, 8, 9].map(r => {
              const opt = data.rating!.find(x => x.id === r);
              if (!opt) return null;
              const active_ = active.ratingMin === r;
              return (
                <button
                  key={r}
                  className={`${styles.ratingPill} ${active_ ? styles.ratingPillActive : ''}`}
                  disabled={opt.disabled}
                  onClick={() => onChange({ ...active, ratingMin: active_ ? null : r })}
                >
                  {r}+ <span className={styles.ratingPillCount}>{opt.hotel_count}</span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* Питание */}
      {(data.meals?.length ?? 0) > 0 && (
        <Section title="Питание">
          {data.meals!.map(m => (
            <CheckRow
              key={String(m.id)}
              label={MEAL_NAMES[String(m.id)] ?? String(m.id)}
              count={m.hotel_count}
              checked={active.meals.includes(String(m.id))}
              disabled={m.disabled}
              onChange={() => onChange({ ...active, meals: toggle(active.meals, String(m.id)) })}
            />
          ))}
        </Section>
      )}

      {/* Регион */}
      {(data.regions?.length ?? 0) > 0 && (
        <Section title="Регион">
          {data.regions!.map(r => (
            <CheckRow
              key={String(r.id)}
              label={String(r.name ?? r.id)}
              count={r.hotel_count}
              checked={active.regions.includes(String(r.name ?? r.id))}
              disabled={r.disabled}
              onChange={() => onChange({ ...active, regions: toggle(active.regions, String(r.name ?? r.id)) })}
            />
          ))}
        </Section>
      )}

      {/* Линия */}
      {(data.line?.length ?? 0) > 0 && (
        <Section title="Линия от моря">
          {data.line!.map(l => (
            <CheckRow
              key={String(l.id)}
              label={`${l.id} линия`}
              count={l.hotel_count}
              checked={active.line.includes(Number(l.id))}
              disabled={l.disabled}
              onChange={() => onChange({ ...active, line: toggle(active.line, Number(l.id)) })}
            />
          ))}
        </Section>
      )}

      {/* Пляж */}
      {(data.beach_type?.length ?? 0) > 0 && (
        <Section title="Пляж">
          {data.beach_type!.map(b => (
            <CheckRow
              key={String(b.id)}
              label={BEACH_TYPE_NAMES[String(b.id)] ?? String(b.id)}
              count={b.hotel_count}
              checked={active.beachType.includes(String(b.id))}
              disabled={b.disabled}
              onChange={() => onChange({ ...active, beachType: toggle(active.beachType, String(b.id)) })}
            />
          ))}
        </Section>
      )}
    </div>
  );

  return (
    <>
      {/* Мобильная кнопка */}
      <div className={styles.mobileBar}>
        <button className={styles.mobileBtn} onClick={() => setMobileOpen(true)}>
          Фильтры {cnt > 0 && <span className={styles.mobileBadge}>{cnt}</span>}
        </button>
        <span className={styles.mobileCount}>
          {filteredCount !== totalCount
            ? `${filteredCount} из ${totalCount}`
            : `${totalCount} туров`}
        </span>
      </div>

      {/* Мобильный оверлей */}
      {mobileOpen && (
        <>
          <div className={styles.overlay} onClick={() => setMobileOpen(false)} />
          <div className={styles.drawer}>
            <div className={styles.drawerHeader}>
              <span className={styles.panelTitle}>Фильтры</span>
              <button className={styles.drawerClose} onClick={() => setMobileOpen(false)}>✕</button>
            </div>
            {panel}
            <div className={styles.drawerFooter}>
              <button className={styles.applyBtn} onClick={() => setMobileOpen(false)}>
                Показать {filteredCount} {filteredCount === 1 ? 'тур' : filteredCount < 5 ? 'тура' : 'туров'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Десктопная панель */}
      <div className={styles.desktopPanel}>{panel}</div>
    </>
  );
}
