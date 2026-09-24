/**
 * Клиент Битрикс24 поверх входящего вебхука.
 *
 * Вынесен из маршрута заявки: теперь в CRM ходят и заявка на тур, и просьба
 * подобрать, и уведомление в чат — общий клиент держит таймауты и повторы в
 * одном месте.
 *
 * Права вебхука узкие: доступны только scope `crm` и `im`. Справочник
 * сотрудников (`user.get`, `department.get`) закрыт, поэтому id людей заданы
 * настройками, а не вычисляются на лету.
 */

const TIMEOUT_MS = 10_000
const RETRIES = 2

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function bitrixCall<T = unknown>(
  method: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const domain = process.env.BITRIX_DOMAIN
  const token = process.env.WEBHOOK_TOKEN
  if (!domain || !token) throw new Error('misconfigured')

  const url = `https://${domain}/rest/${token}/${method}.json`
  let lastReason = 'unknown'

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) await sleep(400 * attempt) // 400 мс, затем 800 мс

    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        // Без таймаута зависший Битрикс держал бы запрос сотрудника до победного.
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (e) {
      lastReason = e instanceof Error ? `${e.name}: ${e.message}` : 'network_error'
      continue
    }

    const data = await res.json().catch(() => ({} as Record<string, unknown>))

    if (res.ok && !data?.error) return data.result as T

    lastReason = JSON.stringify(data).slice(0, 300)
    // 4xx от Битрикса (кривые поля, протухший вебхук) повтором не лечатся.
    if (res.status < 500 && res.status !== 429) break
  }

  console.error(`staff-bitrix: ${method} failed after ${RETRIES + 1} attempts — ${lastReason}`)
  throw new Error('bitrix_error')
}

/** Разобрать список id из настройки вида "10,8,51". */
export function parseUserIds(raw: string | undefined): number[] {
  if (!raw) return []
  return raw
    .split(',')
    .map(part => parseInt(part.trim(), 10))
    .filter(id => Number.isInteger(id) && id > 0)
}

/**
 * Проставить наблюдателей сделке.
 *
 * Отдельным вызовом после создания: у `crm.deal.add` поля наблюдателей нет,
 * оно живёт только в новом API (`crm.item`, entityTypeId 2, поле observers).
 * Переписывать на crm.item весь работающий путь создания сделки рискованно
 * ради одного поля, поэтому дописываем его следом.
 *
 * Ошибку глотаем сознательно: сделка уже создана, и терять заявку из-за
 * неназначенного наблюдателя нельзя.
 */
export async function setDealObservers(dealId: number, observerIds: number[]): Promise<void> {
  if (!observerIds.length) return
  try {
    await bitrixCall('crm.item.update', {
      entityTypeId: 2, // сделка
      id: dealId,
      fields: { observers: observerIds },
    })
  } catch {
    console.error(`staff-bitrix: не удалось назначить наблюдателей сделке ${dealId}`)
  }
}

/**
 * Имена сотрудников по id — чтобы чат писал «взяла Юлия Веркеенко», а не «10».
 *
 * Справочник (`user.get`) вебхуку закрыт, но `im.user.get` под scope `im`
 * доступен. Имена не меняются, поэтому держим их в памяти процесса.
 */
const nameCache = new Map<number, string>()

export async function userName(userId: number): Promise<string> {
  const known = nameCache.get(userId)
  if (known) return known

  try {
    const user = await bitrixCall<{ name?: string }>('im.user.get', { ID: userId })
    const name = user?.name?.trim()
    if (name) {
      nameCache.set(userId, name)
      return name
    }
  } catch {
    // Имя — украшение уведомления, а не условие его отправки.
  }
  return `сотрудник #${userId}`
}

/**
 * Сообщение в рабочий чат.
 *
 * Вебхук видит только те чаты, где состоит его владелец, поэтому id чата —
 * настройка: подставить чужой чат «вслепую» не выйдет.
 *
 * Ошибку глотаем: заявка уже в CRM, и молчание чата не повод отдать сотруднику
 * ошибку отправки.
 */
export async function notifyChat(text: string): Promise<void> {
  const dialogId = process.env.STAFF_LEAD_CHAT_ID?.trim()
  if (!dialogId) return
  try {
    await bitrixCall('im.message.add', { DIALOG_ID: dialogId, MESSAGE: text })
  } catch {
    console.error('staff-bitrix: не удалось отправить уведомление в чат')
  }
}
