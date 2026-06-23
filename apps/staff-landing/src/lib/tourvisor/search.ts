// Поиск туров (раздел 4 ТЗ) + детали тура (раздел 5). Лимит 300 запросов/мин,
// 3000 стартов поиска/сутки включено в тариф (старт + continue + flights).

import { tvFetch } from './client'
import { DEFAULT_DEPARTURE_ID } from './reference'
import type { StartSearchResponse, SearchStatus, HotelSearchResult, TourDetail } from './types'

export interface StartSearchParams {
  countryId: number
  dateFrom: string
  dateTo: string
  nightsFrom: number
  nightsTo: number
  adults: number
  childs?: number[]
  hotelCategory?: number
  hotelRating?: number
  priceFrom?: number
  priceTo?: number
  onlyDirect?: boolean
}

export function startSearch(params: StartSearchParams) {
  return tvFetch<StartSearchResponse>('/tours/search', {
    params: {
      departureId: DEFAULT_DEPARTURE_ID,
      currency: 'RUB',
      onlyCharter: false,
      countryId: params.countryId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      nightsFrom: params.nightsFrom,
      nightsTo: params.nightsTo,
      adults: params.adults,
      childs: params.childs?.length ? params.childs.join(',') : undefined,
      hotelCategory: params.hotelCategory,
      hotelRating: params.hotelRating,
      priceFrom: params.priceFrom,
      priceTo: params.priceTo,
      onlyDirect: params.onlyDirect,
    },
  })
}

export function getSearchStatus(searchId: string) {
  return tvFetch<SearchStatus>(`/tours/search/${searchId}/status`, {
    params: { operatorStatus: false },
  })
}

export function getSearchResults(searchId: string, limit = 25) {
  return tvFetch<HotelSearchResult[]>(`/tours/search/${searchId}`, {
    params: { limit },
  })
}

// Продолжение поиска — расширяет выборку ~+50% (142 → 218 отелей на типовом запросе).
// Вызывать один раз после первого progress=100, затем снова поллить до progress=100.
export function continueSearch(searchId: string) {
  return tvFetch<{ requestCount: number }>(`/tours/search/${searchId}/continue`)
}

export function getTourDetail(tourId: string, currency = 'RUB') {
  return tvFetch<TourDetail>(`/tours/${tourId}`, {
    params: { currency },
  })
}
