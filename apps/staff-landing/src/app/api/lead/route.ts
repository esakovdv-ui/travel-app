import { NextResponse } from 'next/server'

function clamp(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '')
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return '+7' + digits.slice(1)
  }
  if (digits.length === 10) {
    return '+7' + digits
  }
  return null
}

async function bitrixCall<T = unknown>(method: string, payload: Record<string, unknown>): Promise<T> {
  const domain = process.env.BITRIX_DOMAIN
  const token = process.env.WEBHOOK_TOKEN
  if (!domain || !token) throw new Error('misconfigured')

  const base = process.env.BITRIX_REST_BASE_URL?.trim().replace(/\/+$/, '')
  const url = base
    ? `${base}/${token}/${method}.json`
    : `https://${domain}/rest/${token}/${method}.json`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data?.error) {
    console.error(`staff-lead: ${method} failed`, data)
    throw new Error('bitrix_error')
  }
  return data.result as T
}

async function findContactByPhone(phone: string): Promise<number | null> {
  try {
    const result = await bitrixCall<{ ID: string }[]>('crm.contact.list', {
      filter: { PHONE: phone },
      select: ['ID'],
    })
    const id = Array.isArray(result) ? Number(result[0]?.ID) : NaN
    return Number.isFinite(id) && id > 0 ? id : null
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 })
  }

  // Honeypot
  if (typeof body.website === 'string' && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true })
  }

  const name = clamp(body.name, 100)
  const rawPhone = clamp(body.phone, 30)
  const email = clamp(body.email, 200)
  const comment = clamp(body.comment, 1000)

  if (!name || !rawPhone) {
    return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 })
  }

  const phone = normalizePhone(rawPhone)
  if (!phone) {
    return NextResponse.json({ ok: false, error: 'invalid_phone' }, { status: 400 })
  }

  const tour = body.tour && typeof body.tour === 'object' ? body.tour as Record<string, unknown> : {}

  const str = (v: unknown) => typeof v === 'string' && v ? v : null
  const num = (v: unknown) => typeof v === 'number' && isFinite(v) ? v : null

  const commentLines: string[] = []
  const hotel   = str(tour.hotel)
  const stars   = num(tour.hotelStars)
  const rating  = num(tour.hotelRating)
  const country = str(tour.country)
  const region  = str(tour.region)
  const dateStart = str(tour.dateStart)
  const dateEnd   = str(tour.dateEnd)
  const nights    = num(tour.nights)
  const meal      = str(tour.meal)
  const placement = str(tour.placement)
  const adults    = num(tour.adults)
  const childs    = num(tour.childs)
  const flightProg = str(tour.flightProgram)
  const isCharter  = tour.isCharter === true
  const price     = num(tour.price)
  const operator  = str(tour.operator)
  const opLink    = str(tour.operatorLink)

  if (hotel)    commentLines.push(`Отель: ${hotel}${stars ? ` ${'★'.repeat(stars)}` : ''}${rating ? ` · рейтинг ${rating}` : ''}`)
  if (country)  commentLines.push(`Страна: ${country}${region ? `, ${region}` : ''}`)
  if (dateStart) commentLines.push(`Даты: ${dateStart}${dateEnd ? ` — ${dateEnd}` : ''}${nights ? ` (${nights} ночей)` : ''}`)
  if (meal)     commentLines.push(`Питание: ${meal}`)
  if (placement) commentLines.push(`Размещение: ${placement}`)
  if (adults != null) commentLines.push(`Туристы: ${adults} взр.${childs ? ` + ${childs} реб.` : ''}`)
  if (flightProg) commentLines.push(`Перелёт: ${flightProg}${isCharter ? ' (чартер)' : ' (регуляр)'}`)
  if (price != null) commentLines.push(`Цена: ${price.toLocaleString('ru-RU')} ₽`)
  if (operator) commentLines.push(`Оператор: ${operator}`)
  if (opLink)   commentLines.push(`Ссылка оператора: ${opLink}`)
  if (email)    commentLines.push(`Email: ${email}`)
  if (comment)  commentLines.push(`\nКомментарий: ${comment}`)

  const comments = commentLines.join('\n')

  const categoryId = parseInt(process.env.STAFF_DEAL_CATEGORY_ID ?? '0', 10)
  const rawStageId = process.env.STAFF_DEAL_STAGE_ID ?? 'NEW'
  // Для кастомных воронок Битрикс требует формат C{categoryId}:STAGE_NAME
  const stageId = categoryId > 0 && !rawStageId.startsWith('C')
    ? `C${categoryId}:${rawStageId}`
    : rawStageId

  try {
    let contactId = await findContactByPhone(phone)
    if (!contactId) {
      contactId = await bitrixCall<number>('crm.contact.add', {
        fields: {
          NAME: name,
          PHONE: [{ VALUE: phone, VALUE_TYPE: 'WORK' }],
          ...(email ? { EMAIL: [{ VALUE: email, VALUE_TYPE: 'WORK' }] } : {}),
          SOURCE_ID: 'UC_58Z62L',
          ASSIGNED_BY_ID: 1,
          OPENED: 'Y',
        },
      })
    }

    const hotelName = hotel ?? 'тур'
    const dealTitle = `${name} — ${hotelName}${stars ? ` ${'★'.repeat(stars)}` : ''}${country ? `, ${country}` : ''}`
    const dealId = await bitrixCall<number>('crm.deal.add', {
      fields: {
        TITLE: dealTitle,
        CATEGORY_ID: categoryId,
        STAGE_ID: stageId,
        CONTACT_ID: contactId,
        TYPE_ID: '1',
        SOURCE_ID: 'UC_58Z62L',
        ASSIGNED_BY_ID: 1,
        OPENED: 'Y',
        COMMENTS: comments,
        ...(price != null ? { OPPORTUNITY: price, CURRENCY_ID: 'RUB' } : {}),
        ...(str(tour.dateStartIso) ? { CLOSEDATE: str(tour.dateStartIso) } : {}),
      },
    })

    return NextResponse.json({ ok: true, dealId, contactId })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown'
    const status = message === 'misconfigured' ? 500 : 502
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
