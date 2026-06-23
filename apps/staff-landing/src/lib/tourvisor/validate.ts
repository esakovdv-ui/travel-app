// Серверная валидация параметров поиска (раздел 4.1 ТЗ) — до отправки в Tourvisor.

import type { StartSearchParams } from './search'

export interface ValidationError {
  field: string
  message: string
}

export type SearchValidationResult =
  | { ok: true; value: StartSearchParams }
  | { ok: false; errors: ValidationError[] }

interface RawSearchParams {
  countryId?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  nightsFrom?: string | null
  nightsTo?: string | null
  adults?: string | null
  childs?: string | null
  hotelCategory?: string | null
  hotelRating?: string | null
  priceFrom?: string | null
  priceTo?: string | null
  onlyDirect?: string | null
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const VALID_RATINGS = [0, 2, 3, 4, 5]

function parseDate(s: string): Date | null {
  if (!DATE_RE.test(s)) return null
  const d = new Date(`${s}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function validateSearchParams(raw: RawSearchParams): SearchValidationResult {
  const errors: ValidationError[] = []

  const countryId = Number(raw.countryId)
  if (!raw.countryId || !Number.isInteger(countryId) || countryId <= 0) {
    errors.push({ field: 'countryId', message: 'countryId обязателен и должен быть положительным числом' })
  }

  let dateFromObj: Date | null = null
  let dateToObj: Date | null = null
  if (!raw.dateFrom || !(dateFromObj = parseDate(raw.dateFrom))) {
    errors.push({ field: 'dateFrom', message: 'dateFrom обязателен, формат YYYY-MM-DD' })
  }
  if (!raw.dateTo || !(dateToObj = parseDate(raw.dateTo))) {
    errors.push({ field: 'dateTo', message: 'dateTo обязателен, формат YYYY-MM-DD' })
  }
  if (dateFromObj && dateToObj) {
    if (dateToObj < dateFromObj) {
      errors.push({ field: 'dateTo', message: 'dateTo не может быть раньше dateFrom' })
    } else {
      const diffDays = (dateToObj.getTime() - dateFromObj.getTime()) / (1000 * 60 * 60 * 24)
      if (diffDays > 21) {
        errors.push({ field: 'dateTo', message: 'диапазон dateFrom–dateTo не может превышать 21 день' })
      }
    }
  }

  const nightsFrom = Number(raw.nightsFrom)
  if (!raw.nightsFrom || !Number.isInteger(nightsFrom) || nightsFrom < 1 || nightsFrom > 28) {
    errors.push({ field: 'nightsFrom', message: 'nightsFrom обязателен, диапазон 1..28' })
  }

  const nightsTo = Number(raw.nightsTo)
  if (!raw.nightsTo || !Number.isInteger(nightsTo) || nightsTo < 1 || nightsTo > 28) {
    errors.push({ field: 'nightsTo', message: 'nightsTo обязателен, диапазон 1..28' })
  } else if (Number.isInteger(nightsFrom)) {
    if (nightsTo < nightsFrom) {
      errors.push({ field: 'nightsTo', message: 'nightsTo не может быть меньше nightsFrom' })
    } else if (nightsTo - nightsFrom > 10) {
      errors.push({ field: 'nightsTo', message: 'диапазон nightsFrom–nightsTo не может превышать 10' })
    }
  }

  const adults = Number(raw.adults)
  if (!raw.adults || !Number.isInteger(adults) || adults < 1 || adults > 6) {
    errors.push({ field: 'adults', message: 'adults обязателен, диапазон 1..6' })
  }

  let childs: number[] | undefined
  if (raw.childs) {
    const ages = raw.childs.split(',').map(s => Number(s.trim()))
    if (ages.length > 3 || ages.some(a => !Number.isInteger(a) || a < 0 || a > 17)) {
      errors.push({ field: 'childs', message: 'childs — до 3 возрастов через запятую, каждый 0..17' })
    } else {
      childs = ages
    }
  }

  let hotelCategory: number | undefined
  if (raw.hotelCategory) {
    hotelCategory = Number(raw.hotelCategory)
    if (!Number.isInteger(hotelCategory) || hotelCategory < 1 || hotelCategory > 5) {
      errors.push({ field: 'hotelCategory', message: 'hotelCategory должен быть числом 1..5' })
    }
  }

  let hotelRating: number | undefined
  if (raw.hotelRating !== undefined && raw.hotelRating !== null && raw.hotelRating !== '') {
    hotelRating = Number(raw.hotelRating)
    if (!VALID_RATINGS.includes(hotelRating)) {
      errors.push({ field: 'hotelRating', message: 'hotelRating должен быть одним из 0/2/3/4/5' })
    }
  }

  let priceFrom: number | undefined
  let priceTo: number | undefined
  if (raw.priceFrom) {
    priceFrom = Number(raw.priceFrom)
    if (!Number.isFinite(priceFrom) || priceFrom < 0) {
      errors.push({ field: 'priceFrom', message: 'priceFrom должен быть неотрицательным числом' })
    }
  }
  if (raw.priceTo) {
    priceTo = Number(raw.priceTo)
    if (!Number.isFinite(priceTo) || priceTo < 0) {
      errors.push({ field: 'priceTo', message: 'priceTo должен быть неотрицательным числом' })
    }
  }
  if (priceFrom !== undefined && priceTo !== undefined && priceTo < priceFrom) {
    errors.push({ field: 'priceTo', message: 'priceTo не может быть меньше priceFrom' })
  }

  let onlyDirect: boolean | undefined
  if (raw.onlyDirect !== undefined && raw.onlyDirect !== null && raw.onlyDirect !== '') {
    if (raw.onlyDirect !== 'true' && raw.onlyDirect !== 'false') {
      errors.push({ field: 'onlyDirect', message: 'onlyDirect должен быть true или false' })
    } else {
      onlyDirect = raw.onlyDirect === 'true'
    }
  }

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    value: {
      countryId,
      dateFrom: raw.dateFrom as string,
      dateTo: raw.dateTo as string,
      nightsFrom,
      nightsTo,
      adults,
      childs,
      hotelCategory,
      hotelRating,
      priceFrom,
      priceTo,
      onlyDirect,
    },
  }
}
