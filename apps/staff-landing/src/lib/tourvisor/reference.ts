// Справочники (раздел 3 ТЗ). Лимит 120 запросов/мин, в суточную поисковую квоту не входят.

import { tvFetch } from './client'
import type { DepartureCity, Country, MealType, Region } from './types'

// Зафиксировано на Day 1: id Москвы в /departures?departureCountryId=1.
// Город вылета скрыт из формы — все сотрудники летят из Москвы.
export const DEFAULT_DEPARTURE_ID = 1

export function getDepartures() {
  return tvFetch<DepartureCity[]>('/departures', {
    params: { departureCountryId: 1 },
    revalidate: 60 * 60 * 24, // 24 часа
  })
}

/**
 * Страны, по которым из Москвы нет ничего.
 *
 * Не сезонная пустота, а полная: поиск не возвращает ни одного отеля, сколько
 * ни двигай даты. Замеры по окнам вылета (+дней от сегодня):
 *
 *   Кипр (15)     — 0 отелей на +21, +45, +75, +140, +200
 *   Италия (24)   — 0 на +21, +45, +75, +140
 *   Хорватия (22) — 0 на +21, +75, +140, +200
 *
 * Мерили мимо фильтра операторов, то есть по всей базе Tourvisor: в портале,
 * где остаются только наши туроператоры, их тем более не будет.
 *
 * Важно, чем это отличается от «пустых курортов», которые мы намеренно НЕ
 * прячем. Поиск по стране возвращает выборку, а не всё: по России он отдаёт
 * Сочи и Крым, а до Санкт-Петербурга не доходит — и тот выглядит пустым, хотя
 * у него 95 отелей на тех же датах. Здесь выборке теряться не в чем: ответ
 * пуст целиком. Поэтому страну скрыть можно, а курорт — нет.
 */
const DEAD_COUNTRY_IDS: readonly number[] = [15, 24, 22]

export async function getCountries(departureId: number = DEFAULT_DEPARTURE_ID) {
  const countries = await tvFetch<Country[]>('/countries', {
    params: { departureId },
    revalidate: 60 * 60, // 1 час
  })
  return countries.filter(c => !DEAD_COUNTRY_IDS.includes(c.id))
}

export function getMeals() {
  return tvFetch<MealType[]>('/meals', {
    revalidate: 60 * 60 * 24,
  })
}

/**
 * Курорты, совпадающие с городом вылета.
 *
 * Тур «из Москвы в Москву» невозможен в принципе: перелёта нет, оператору
 * нечего собирать. Замер по Москве/Подмосковью — ноль отелей в окнах +14,
 * +30, +60, +90 и +120 дней. Это не сезонность, как у остальных пустых
 * курортов, а свойство пары «вылет + направление», поэтому единственный
 * случай, где скрывать курорт безопасно.
 *
 * Ключ — id города вылета, чтобы правило пережило появление вылетов из
 * других городов: там пустым окажется уже свой курорт, а не этот.
 */
const DEPARTURE_HOME_REGIONS: Record<number, readonly number[]> = {
  1: [469], // Москва → Москва/Подмосковье
}

/**
 * Курорты: Аланья, Анталья, Кемер… Нужны для поиска по regionIds.
 * Без countryId Tourvisor отдаёт справочник целиком по всем странам.
 *
 * Курорт города вылета вычищаем здесь, а не в компонентах: через эту функцию
 * идут оба экрана выбора — и шапка на десктопе, и мобильный лист.
 */
export async function getRegions(countryId?: number) {
  const regions = await tvFetch<Region[]>('/regions', {
    params: countryId ? { countryId } : {},
    revalidate: 60 * 60 * 24, // сутки — список курортов не меняется
  })

  const hidden = DEPARTURE_HOME_REGIONS[DEFAULT_DEPARTURE_ID]
  if (!hidden?.length) return regions
  return regions.filter(r => !hidden.includes(r.id))
}
