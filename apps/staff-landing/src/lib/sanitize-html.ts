// Очистка HTML, который приходит от Tourvisor (описания отелей и номеров).
//
// Эти строки попадают в dangerouslySetInnerHTML на странице, где сотрудник
// вводит имя и телефон. Доверять разметке третьей стороны там нельзя, а тянуть
// ради этого зависимость не хочется: набор тегов у Tourvisor крошечный.
//
// Работает на сервере, до отдачи наружу (см. lib/tourvisor/hotel.ts).

/** Теги, которые реально встречаются в описаниях и не несут поведения. */
const ALLOWED_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 'br', 'p', 'ul', 'ol', 'li', 'span', 'div',
])

/** Опасные элементы вырезаем вместе с содержимым, а не только теги. */
const STRIP_WITH_CONTENT = /<(script|style|iframe|object|embed|svg|math)\b[\s\S]*?<\/\1\s*>/gi

const SELF_CLOSING_DANGEROUS = /<(script|style|iframe|object|embed|link|meta|base|form|input|button)\b[^>]*\/?>/gi

const COMMENTS = /<!--[\s\S]*?-->/g

/** Декодирует числовые и именованные сущности: в ответах Tourvisor «м&#178;». */
export function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&laquo;/gi, '«')
    .replace(/&raquo;/gi, '»')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&deg;/gi, '°')
    .replace(/&amp;/gi, '&')
}

export function sanitizeHtml(input: unknown): string {
  if (typeof input !== 'string' || !input) return ''

  let html = input
    .replace(COMMENTS, '')
    .replace(STRIP_WITH_CONTENT, '')
    .replace(SELF_CLOSING_DANGEROUS, '')

  // Оставшиеся теги: разрешённые — без единого атрибута (это убирает
  // onclick/onerror/style/href разом), остальные — выбрасываем, текст сохраняем.
  html = html.replace(/<\/?([a-z0-9-]+)\b[^>]*>/gi, (match, rawTag: string) => {
    const tag = rawTag.toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) return ''
    return match.startsWith('</') ? `</${tag}>` : `<${tag}>`
  })

  return decodeEntities(html).trim()
}
