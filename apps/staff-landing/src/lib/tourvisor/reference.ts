// Справочники (раздел 3 ТЗ). Лимит 120 запросов/мин, в суточную поисковую квоту не входят.

import { tvFetch } from './client'
import type { DepartureCity, Country, MealType } from './types'

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
