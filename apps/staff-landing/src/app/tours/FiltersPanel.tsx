'use client'

import { useState } from 'react'
import styles from './FiltersPanel.module.css'
import type { HotelSearchResult } from '@/lib/tourvisor/types'

// ─── Типы фильтров ────────────────────────────────────────────────────────────

export interface FilterState {
  stars: number[]
  ratingMin: number | null
  seaDistMax: number | null
  regions: string[]
  subRegions: string[]
  meals: string[]
  flightType: 'any' | 'charter' | 'regular'
  placements: string[]
  roomTypes: string[]
  priceMax: number
}

export const DEFAULT_FILTERS: FilterState = {
  stars: [],
  ratingMin: null,
  seaDistMax: null,
  regions: [],
  subRegions: [],
  meals: [],
  flightType: 'any',
  placements: [],
  roomTypes: [],
  priceMax: 0,
}

// ─── Применение фильтров ──────────────────────────────────────────────────────

export function applyFilters(
  hotels: HotelSearchResult[],
  f: FilterState,
): HotelSearchResult[] {
  const hasTourFilters =
    f.meals.length > 0 ||
    f.flightType !== 'any' ||
    f.placements.length > 0 ||
    f.roomTypes.length > 0

  return hotels
    .map(hotel => {
      if (!hasTourFilters) return hotel
      const matchingTours = hotel.tours.filter(t => {
        if (f.meals.length && !f.meals.includes(t.meal?.name ?? '')) return false
        if (f.flightType === 'charter' && !t.isCharter) return false
        if (f.flightType === 'regular' && t.isCharter) return false
        if (f.placements.length && !f.placements.includes(t.placement ?? '')) return false
        if (f.roomTypes.length && !f.roomTypes.includes(t.roomType ?? '')) return false
        return true
      })
      return { ...hotel, tours: matchingTours }
    })
    .filter(hotel => {
      if (hasTourFilters && hotel.tours.length === 0) return false
      if (f.stars.length && !f.stars.includes(hotel.category)) return false
      if (f.ratingMin !== null && (hotel.rating ?? 0) < f.ratingMin) return false
      if (f.seaDistMax !== null && hotel.seaDistance != null && hotel.seaDistance > f.seaDistMax) return false
      if (f.regions.length && !f.regions.includes(hotel.region?.name ?? '')) return false
      if (f.subRegions.length) {
        if (!hotel.subRegion || !f.subRegions.includes(hotel.subRegion.name)) return false
      }
      if (f.priceMax > 0 && hotel.price > f.priceMax) return false
      return true
    })
}

export function countActiveFilters(f: FilterState): number {
  return (
    f.stars.length +
    (f.ratingMin != null ? 1 : 0) +
    (f.seaDistMax != null ? 1 : 0) +
    f.regions.length +
    f.subRegions.length +
    f.meals.length +
    (f.flightType !== 'any' ? 1 : 0) +
    f.placements.length +
    f.roomTypes.length +
    (f.priceMax > 0 ? 1 : 0)
  )
}

// ─── Вычисление уникальных значений из батча ──────────────────────────────────

export interface FilterOptions {
  regions: { name: string; count: number }[]
  subRegions: { name: string; count: number }[]
  meals: { name: string; count: number }[]
  placements: { name: string; count: number }[]
  roomTypes: { name: string; count: number }[]
  priceMax: number
}

export function computeFilterOptions(hotels: HotelSearchResult[]): FilterOptions {
  const regionMap = new Map<string, number>()
  const subRegionMap = new Map<string, number>()
  const mealMap = new Map<string, number>()
  const placementMap = new Map<string, number>()
  const roomTypeMap = new Map<string, number>()
  let priceMax = 0

  for (const h of hotels) {
    if (h.region?.name) regionMap.set(h.region.name, (regionMap.get(h.region.name) ?? 0) + 1)
    if (h.subRegion?.name) subRegionMap.set(h.subRegion.name, (subRegionMap.get(h.subRegion.name) ?? 0) + 1)
    if (h.price > priceMax) priceMax = h.price
    for (const t of h.tours) {
      if (t.meal?.name) mealMap.set(t.meal.name, (mealMap.get(t.meal.name) ?? 0) + 1)
      if (t.placement) placementMap.set(t.placement, (placementMap.get(t.placement) ?? 0) + 1)
      if (t.roomType) roomTypeMap.set(t.roomType, (roomTypeMap.get(t.roomType) ?? 0) + 1)
    }
  }

  const toArr = (m: Map<string, number>) =>
    [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)

  return {
    regions: toArr(regionMap),
    subRegions: toArr(subRegionMap),
    meals: toArr(mealMap),
    placements: toArr(placementMap),
    roomTypes: toArr(roomTypeMap),
    priceMax: Math.ceil(priceMax / 10_000) * 10_000,
  }
}

// ─── Внутренние под-компоненты ────────────────────────────────────────────────

interface CheckListProps {
  items: { name: string; count: number }[]
  selected: string[]
  onChange: (v: string[]) => void
  showLimit?: number
}

function CheckList({ items, selected, onChange, showLimit = 6 }: CheckListProps) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? items : items.slice(0, showLimit)
  const hidden = items.length - showLimit

  function toggle(name: string) {
    onChange(selected.includes(name) ? selected.filter(x => x !== name) : [...selected, name])
  }

  return (
    <>
      <div className={styles.checkList}>
        {visible.map(item => (
          <label key={item.name} className={styles.checkItem}>
            <input
              type="checkbox"
              checked={selected.includes(item.name)}
              onChange={() => toggle(item.name)}
            />
            <span className={styles.checkLabel}>{item.name}</span>
            <span className={styles.checkCount}>{item.count}</span>
          </label>
        ))}
      </div>
      {!expanded && hidden > 0 && (
        <button className={styles.showMoreBtn} onClick={() => setExpanded(true)}>
          Показать ещё {hidden} ↓
        </button>
      )}
      {expanded && items.length > showLimit && (
        <button className={styles.showMoreBtn} onClick={() => setExpanded(false)}>
          Свернуть ↑
        </button>
      )}
    </>
  )
}

function GroupBadge({ count }: { count: number }) {
  if (!count) return null
  return <span className={styles.groupBadge}>{count}</span>
}

// ─── Основная панель фильтров ─────────────────────────────────────────────────

interface FiltersPanelProps {
  filters: FilterState
  onChange: (f: FilterState) => void
  options: FilterOptions
  filteredCount: number
  // mobile bottom sheet
  sheetOpen?: boolean
  onSheetClose?: () => void
}

function FilterContent({
  filters,
  onChange,
  options,
}: Omit<FiltersPanelProps, 'filteredCount' | 'sheetOpen' | 'onSheetClose'>) {
  const set = <K extends keyof FilterState>(key: K, val: FilterState[K]) =>
    onChange({ ...filters, [key]: val })

  const priceMax = options.priceMax || 500_000
  const currentPriceMax = filters.priceMax || priceMax

  function toggleArr(key: 'stars' | 'regions' | 'subRegions' | 'meals' | 'placements' | 'roomTypes', val: string | number) {
    const arr = filters[key] as (string | number)[]
    const next = arr.includes(val as never) ? arr.filter(x => x !== val) : [...arr, val]
    set(key, next as FilterState[typeof key])
  }

  const activeCnt = countActiveFilters(filters)

  return (
    <>
      {activeCnt > 0 && (
        <button className={styles.resetBtn} onClick={() => onChange(DEFAULT_FILTERS)}>
          ✕ Сбросить все фильтры ({activeCnt})
        </button>
      )}

      {/* Категория */}
      <div className={styles.group}>
        <div className={styles.groupHeader}>
          <span className={styles.groupTitle}>Категория</span>
          <GroupBadge count={filters.stars.length} />
        </div>
        <div className={styles.chips}>
          {[1, 2, 3, 4, 5].map(s => (
            <button
              key={s}
              className={`${styles.chip} ${filters.stars.includes(s) ? styles.chipActive : ''}`}
              onClick={() => toggleArr('stars', s)}
            >
              {s}★
            </button>
          ))}
        </div>
      </div>

      {/* Рейтинг */}
      <div className={styles.group}>
        <div className={styles.groupHeader}>
          <span className={styles.groupTitle}>Рейтинг</span>
          <GroupBadge count={filters.ratingMin != null ? 1 : 0} />
        </div>
        <div className={styles.chips}>
          {([3, 3.5, 4, 4.5] as const).map(r => (
            <button
              key={r}
              className={`${styles.chip} ${filters.ratingMin === r ? styles.chipActive : ''}`}
              onClick={() => set('ratingMin', filters.ratingMin === r ? null : r)}
            >
              ≥{r}
            </button>
          ))}
        </div>
      </div>

      {/* До моря */}
      <div className={styles.group}>
        <div className={styles.groupHeader}>
          <span className={styles.groupTitle}>До моря</span>
          <GroupBadge count={filters.seaDistMax != null ? 1 : 0} />
        </div>
        <div className={styles.chips}>
          {[100, 300, 500].map(d => (
            <button
              key={d}
              className={`${styles.chip} ${filters.seaDistMax === d ? styles.chipActive : ''}`}
              onClick={() => set('seaDistMax', filters.seaDistMax === d ? null : d)}
            >
              ≤{d}м
            </button>
          ))}
        </div>
      </div>

      {/* Цена */}
      <div className={styles.group}>
        <div className={styles.groupHeader}>
          <span className={styles.groupTitle}>Цена до</span>
          <GroupBadge count={filters.priceMax > 0 ? 1 : 0} />
        </div>
        <div className={styles.priceRow}>
          <span className={styles.priceVal}>{currentPriceMax.toLocaleString('ru-RU')} ₽</span>
          {filters.priceMax > 0 && (
            <button
              style={{ background: 'none', border: 'none', fontSize: '0.72rem', color: 'var(--c-text-muted)', cursor: 'pointer' }}
              onClick={() => set('priceMax', 0)}
            >
              сбросить
            </button>
          )}
        </div>
        <input
          type="range"
          min={0}
          max={priceMax}
          step={5000}
          value={currentPriceMax}
          onChange={e => {
            const v = Number(e.target.value)
            set('priceMax', v >= priceMax ? 0 : v)
          }}
          className={styles.priceRange}
        />
      </div>

      {/* Питание */}
      {options.meals.length > 0 && (
        <div className={styles.group}>
          <div className={styles.groupHeader}>
            <span className={styles.groupTitle}>Питание</span>
            <GroupBadge count={filters.meals.length} />
          </div>
          <CheckList
            items={options.meals}
            selected={filters.meals}
            onChange={v => set('meals', v)}
          />
        </div>
      )}

      {/* Курорт */}
      {options.regions.length > 0 && (
        <div className={styles.group}>
          <div className={styles.groupHeader}>
            <span className={styles.groupTitle}>Курорт</span>
            <GroupBadge count={filters.regions.length} />
          </div>
          <CheckList
            items={options.regions}
            selected={filters.regions}
            onChange={v => set('regions', v)}
          />
        </div>
      )}

      {/* Подрегион — только если данные есть */}
      {options.subRegions.length > 0 && (
        <div className={styles.group}>
          <div className={styles.groupHeader}>
            <span className={styles.groupTitle}>Район</span>
            <GroupBadge count={filters.subRegions.length} />
          </div>
          <CheckList
            items={options.subRegions}
            selected={filters.subRegions}
            onChange={v => set('subRegions', v)}
          />
        </div>
      )}

      {/* Перелёт */}
      <div className={styles.group}>
        <div className={styles.groupHeader}>
          <span className={styles.groupTitle}>Перелёт</span>
          <GroupBadge count={filters.flightType !== 'any' ? 1 : 0} />
        </div>
        <div className={styles.radioGroup}>
          {(['any', 'charter', 'regular'] as const).map(val => (
            <label key={val} className={styles.radioItem}>
              <input
                type="radio"
                name="flightType"
                checked={filters.flightType === val}
                onChange={() => set('flightType', val)}
              />
              <span className={styles.radioLabel}>
                {val === 'any' ? 'Любой' : val === 'charter' ? 'Только чартер' : 'Только регулярный'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Размещение */}
      {options.placements.length > 0 && (
        <div className={styles.group}>
          <div className={styles.groupHeader}>
            <span className={styles.groupTitle}>Размещение</span>
            <GroupBadge count={filters.placements.length} />
          </div>
          <CheckList
            items={options.placements}
            selected={filters.placements}
            onChange={v => set('placements', v)}
            showLimit={5}
          />
        </div>
      )}

      {/* Тип номера */}
      {options.roomTypes.length > 0 && (
        <div className={styles.group}>
          <div className={styles.groupHeader}>
            <span className={styles.groupTitle}>Тип номера</span>
            <GroupBadge count={filters.roomTypes.length} />
          </div>
          <CheckList
            items={options.roomTypes}
            selected={filters.roomTypes}
            onChange={v => set('roomTypes', v)}
          />
        </div>
      )}
    </>
  )
}

// ─── Экспорт: сайдбар (десктоп) ──────────────────────────────────────────────

export function FiltersSidebar({ filters, onChange, options }: FiltersPanelProps) {
  return (
    <aside className={styles.sidebar}>
      <FilterContent filters={filters} onChange={onChange} options={options} />
    </aside>
  )
}

// ─── Экспорт: нижний лист (мобайл) ───────────────────────────────────────────

export function FiltersBottomSheet({
  filters,
  onChange,
  options,
  filteredCount,
  sheetOpen,
  onSheetClose,
}: FiltersPanelProps) {
  if (!sheetOpen) return null

  return (
    <>
      <div className={styles.sheetBackdrop} onClick={onSheetClose} />
      <div className={styles.sheet}>
        <div className={styles.sheetHandle} />
        <div className={styles.sheetHeader}>
          <span className={styles.sheetTitle}>Фильтры</span>
          <button className={styles.sheetCloseBtn} onClick={onSheetClose}>✕</button>
        </div>
        <div className={styles.sheetBody}>
          <FilterContent filters={filters} onChange={onChange} options={options} />
        </div>
        <div className={styles.sheetFooter}>
          <button className={styles.sheetApplyBtn} onClick={onSheetClose}>
            Показать {filteredCount} {filteredCount === 1 ? 'отель' : filteredCount < 5 ? 'отеля' : 'отелей'}
          </button>
        </div>
      </div>
    </>
  )
}
