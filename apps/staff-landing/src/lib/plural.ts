// Русское склонение числительных.
// forms: [1 отель, 2 отеля, 5 отелей]

export function plural(n: number, forms: readonly [string, string, string]): string {
  const abs = Math.abs(Math.trunc(n))
  const mod100 = abs % 100
  if (mod100 >= 11 && mod100 <= 14) return forms[2]
  const mod10 = abs % 10
  if (mod10 === 1) return forms[0]
  if (mod10 >= 2 && mod10 <= 4) return forms[1]
  return forms[2]
}

export const hotelsWord   = (n: number) => plural(n, ['отель', 'отеля', 'отелей'])
export const nightsWord   = (n: number) => plural(n, ['ночь', 'ночи', 'ночей'])
export const toursWord    = (n: number) => plural(n, ['тур', 'тура', 'туров'])
export const variantsWord = (n: number) => plural(n, ['вариант', 'варианта', 'вариантов'])
export const secondsWord  = (n: number) => plural(n, ['секунда', 'секунды', 'секунд'])
export const yearsWord    = (n: number) => plural(n, ['год', 'года', 'лет'])

export const hotelsLabel  = (n: number) => `${n} ${hotelsWord(n)}`
export const nightsLabel  = (n: number) => `${n} ${nightsWord(n)}`
export const toursLabel   = (n: number) => `${n} ${toursWord(n)}`
/** Возраст ребёнка: 0 лет, 1 год, 2 года, 5 лет. */
export const yearsLabel   = (n: number) => `${n} ${yearsWord(n)}`
