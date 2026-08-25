import { NextResponse } from 'next/server'
import { bitrixCall, notifyChat, setDealObservers, userName } from '@/lib/bitrix'
import { nextAssignee, observersFor } from '@/lib/lead-queue'

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

  // Два вида заявки. 'help' — человек не нашёл подходящий тур в выдаче и
  // просит подобрать руками; тура в ней нет, зато есть параметры поиска.
  const kind = body.kind === 'help' ? 'help' : 'tour'

  const tour = body.tour && typeof body.tour === 'object' ? body.tour as Record<string, unknown> : {}
  const search = body.search && typeof body.search === 'object' ? body.search as Record<string, unknown> : {}

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
  const flightPref = str(tour.flightPreference)
  const isCharter  = tour.isCharter === true
  const price     = num(tour.price)
  const operator  = str(tour.operator)
  const opLink    = str(tour.operatorLink)

  if (kind === 'help') {
    // Что человек искал в момент, когда решил, что подходящего нет.
    const sCountry = str(search.country)
    const sRegions = str(search.regions)
    const sDates   = str(search.dates)
    const sPeople  = str(search.people)
    const sBudget  = str(search.budget)
    const sFound   = num(search.found)

    commentLines.push('ЗАЯВКА НА ПОДБОР — сотрудник не нашёл подходящий вариант в выдаче.')
    // sDates — строка из шапки портала, она уже начинается со страны:
    // «Россия · 12 сен – 20 сен · 8 ночей · ±1 день · 2 взр.». Отдельная
    // строка со страной повторяла бы её дважды, поэтому она на подхвате —
    // на случай, если дат почему-то не пришло.
    if (sDates) commentLines.push(`Искал: ${sDates}`)
    else if (sCountry) commentLines.push(`Искал: ${sCountry}${sRegions ? `, ${sRegions}` : ''}`)
    if (sPeople)  commentLines.push(`Туристы: ${sPeople}`)
    if (sBudget)  commentLines.push(`Бюджет: ${sBudget}`)
    if (sFound != null) commentLines.push(`Показано вариантов: ${sFound}`)
    if (email)    commentLines.push(`Email: ${email}`)
    if (comment)  commentLines.push(`\nПожелания: ${comment}`)
  }

  if (hotel)    commentLines.push(`Отель: ${hotel}${stars ? ` ${'★'.repeat(stars)}` : ''}${rating ? ` · рейтинг ${rating}` : ''}`)
  if (country)  commentLines.push(`Страна: ${country}${region ? `, ${region}` : ''}`)
  if (dateStart) commentLines.push(`Даты: ${dateStart}${dateEnd ? ` — ${dateEnd}` : ''}${nights ? ` (${nights} ночей)` : ''}`)
  if (meal)     commentLines.push(`Питание: ${meal}`)
  if (placement) commentLines.push(`Размещение: ${placement}`)
  if (adults != null) commentLines.push(`Туристы: ${adults} взр.${childs ? ` + ${childs} реб.` : ''}`)
  if (flightProg) commentLines.push(`Перелёт: ${flightProg}${isCharter ? ' (чартер)' : ' (регуляр)'}`)
  if (flightPref) commentLines.push(`Пожелание по рейсу: ${flightPref}`)
  if (price != null) commentLines.push(`Цена: ${price.toLocaleString('ru-RU')} ₽`)
  if (operator) commentLines.push(`Оператор: ${operator}`)
  if (opLink)   commentLines.push(`Ссылка оператора: ${opLink}`)
  // Для заявки на подбор почта и пожелания уже добавлены выше — иначе легли бы
  // в описание дважды.
  if (kind === 'tour' && email)   commentLines.push(`Email: ${email}`)
  if (kind === 'tour' && comment) commentLines.push(`\nКомментарий: ${comment}`)

  const comments = commentLines.join('\n')

  const categoryId = parseInt(process.env.STAFF_DEAL_CATEGORY_ID ?? '0', 10)
  const rawStageId = process.env.STAFF_DEAL_STAGE_ID ?? 'NEW'
  // Для кастомных воронок Битрикс требует формат C{categoryId}:STAGE_NAME
  const stageId = categoryId > 0 && !rawStageId.startsWith('C')
    ? `C${categoryId}:${rawStageId}`
    : rawStageId

  // Ответственный — следующий менеджер по кругу. Раньше здесь было число из
  // настройки, а у самой сделки вдобавок зашита единица, поэтому все заявки
  // доставались одному человеку независимо от настройки.
  const assignedById = await nextAssignee()
  const observerIds = observersFor(assignedById)

  try {
    let contactId = await findContactByPhone(phone)
    if (!contactId) {
      contactId = await bitrixCall<number>('crm.contact.add', {
        fields: {
          NAME: name,
          PHONE: [{ VALUE: phone, VALUE_TYPE: 'WORK' }],
          ...(email ? { EMAIL: [{ VALUE: email, VALUE_TYPE: 'WORK' }] } : {}),
          SOURCE_ID: 'UC_58Z62L',
          ASSIGNED_BY_ID: assignedById,
          OPENED: 'Y',
        },
      })
    }

    const hotelName = hotel ?? 'тур'
    const searchCountry = str(search.country)
    const dealTitle = kind === 'help'
      ? `${name} — подбор тура${searchCountry ? `, ${searchCountry}` : ''}`
      : `${name} — ${hotelName}${stars ? ` ${'★'.repeat(stars)}` : ''}${country ? `, ${country}` : ''}`
    const dealId = await bitrixCall<number>('crm.deal.add', {
      fields: {
        TITLE: dealTitle,
        CATEGORY_ID: categoryId,
        STAGE_ID: stageId,
        CONTACT_ID: contactId,
        TYPE_ID: '1',
        SOURCE_ID: 'UC_58Z62L',
        ASSIGNED_BY_ID: assignedById,
        OPENED: 'Y',
        COMMENTS: comments,
        ...(price != null ? { OPPORTUNITY: price, CURRENCY_ID: 'RUB' } : {}),
        ...(str(tour.dateStartIso) ? { CLOSEDATE: str(tour.dateStartIso) } : {}),
      },
    })

    // Наблюдатели и чат — уже после того, как сделка создана: их сбой не должен
    // превращать принятую заявку в ошибку для сотрудника.
    await setDealObservers(dealId, observerIds)

    const dealUrl = `https://${process.env.BITRIX_DOMAIN}/crm/deal/details/${dealId}/`
    const heading = kind === 'help'
      ? '🔎 Заявка на подбор тура'
      : '🧳 Новая заявка на тур'
    const assigneeName = await userName(assignedById)
    await notifyChat(
      `${heading}\n${dealTitle}\nТелефон: ${phone}\nОтветственный: ${assigneeName}\n${dealUrl}`,
    )

    return NextResponse.json({ ok: true, dealId, contactId })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown'
    const status = message === 'misconfigured' ? 500 : 502

    // Заявка не должна пропадать, если CRM недоступна: пишем её целиком одной
    // строкой в stderr. Оттуда её можно достать из логов pm2 и завести руками.
    console.error('staff-lead: LOST_LEAD ' + JSON.stringify({
      at: new Date().toISOString(),
      reason: message,
      name,
      phone,
      email: email || undefined,
      comments,
    }))

    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
