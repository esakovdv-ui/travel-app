// Работа с датами поиска. Формат обмена — «YYYY-MM-DD» в локальном времени.
//
// Важно: раньше в компонентах использовались `toISOString().split('T')[0]`
// и `new Date('YYYY-MM-DD')`. Первое переводит дату в UTC, второе разбирает
// строку как UTC-полночь — в московском UTC+3 это давало сдвиг на день
// в ранние часы. Здесь всё считается по локальному календарю.

export const RU_MONTHS_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
] as const

export const RU_MONTHS_FULL = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
] as const

/** Понедельник первым — как в русском календаре. */
export const RU_WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const

export function isoDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/** Разбирает «YYYY-MM-DD» как локальную дату, без ухода в UTC. */
export function parseIsoDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

export function offsetDate(value: string, days: number): string {
  const d = parseIsoDate(value)
  if (!d) return value
  d.setDate(d.getDate() + days)
  return isoDate(d)
}

export function todayIso(): string {
  return isoDate(new Date())
}

/**
 * Начало окна поиска: выбранная дата минус гибкость, но не раньше сегодня.
 *
 * Tourvisor отвергает dateFrom в прошлом — отвечает 400 «invalid dateFrom
 * parameter». Календарь прошлые дни не даёт выбрать, но гибкость ±дней
 * уводила туда сама: дата на завтра с ±2 давала dateFrom на вчера,
 * и поиск падал ещё до старта.
 */
export function searchDateFrom(target: string, flex: number): string {
  const from = offsetDate(target, -flex)
  const today = todayIso()
  // Обе строки в «YYYY-MM-DD», поэтому сравнение строк = сравнение дат.
  return from < today ? today : from
}

/** «26 авг» */
export function shortDate(value: string): string {
  const d = parseIsoDate(value)
  if (!d) return value
  return `${d.getDate()} ${RU_MONTHS_SHORT[d.getMonth()]}`
}

/** Ночей между заездом и выездом; минимум одна. */
export function nightsBetween(from: string, to: string): number {
  const a = parseIsoDate(from)
  const b = parseIsoDate(to)
  if (!a || !b) return 1
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000))
}

/** «±1 день» / «±2 дня» — подпись гибкости вылета. */
export function flexLabel(flex: number): string {
  if (flex <= 0) return 'Точно'
  return `±${flex} ${flex === 1 ? 'день' : 'дня'}`
}

/**
 * Обратное преобразование: из диапазона dateFrom–dateTo в URL получаем
 * целевую дату вылета и гибкость. Нужно и шапке, и мобильной шторке —
 * раньше каждая считала по-своему, и для одной ссылки они показывали
 * разные даты («26 авг ±2 дня» против «24 авг»).
 */
export function dateRangeToTarget(
  dateFrom: string,
  dateTo: string,
): { targetDate: string; dateFlex: 0 | 1 | 2 } {
  if (!dateFrom) return { targetDate: '', dateFlex: 2 }
  if (!dateTo || dateFrom === dateTo) return { targetDate: dateFrom, dateFlex: 0 }

  const a = parseIsoDate(dateFrom)
  const b = parseIsoDate(dateTo)
  if (!a || !b) return { targetDate: dateFrom, dateFlex: 0 }

  const diffDays = Math.round((b.getTime() - a.getTime()) / 86_400_000)
  const flex = Math.min(2, Math.max(0, Math.round(diffDays / 2))) as 0 | 1 | 2
  return { targetDate: offsetDate(dateFrom, flex), dateFlex: flex }
}
