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

export function getCountries(departureId: number = DEFAULT_DEPARTURE_ID) {
  return tvFetch<Country[]>('/countries', {
    params: { departureId },
    revalidate: 60 * 60, // 1 час
  })
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
