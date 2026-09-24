import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import { parseUserIds } from './bitrix'

/**
 * Очередь ответственных за заявки.
 *
 * Раньше ответственный был зашит числом, и все заявки падали на одного
 * человека. Теперь они раздаются по кругу между менеджерами из настройки
 * STAFF_DEAL_QUEUE_IDS.
 *
 * Позиция круга лежит в data/ рядом с журналом входов: каталог переживает
 * выкат (rsync исключает его явно), поэтому очередь не сбрасывается на первого
 * менеджера при каждой выкатке.
 */

const DIR = process.env.STAFF_ACCESS_LOG_DIR ?? path.join(process.cwd(), 'data')
const FILE = path.join(DIR, 'lead-queue.json')

/** Кому уходит заявка, если очередь не настроена. */
const FALLBACK_ASSIGNEE = 1

export function queueIds(): number[] {
  return parseUserIds(process.env.STAFF_DEAL_QUEUE_IDS)
}

/**
 * Следующий ответственный.
 *
 * Позицию храним как счётчик выданных заявок, а не как индекс: список
 * менеджеров может измениться, и счётчик по модулю длины сам разложится по
 * новому составу, не упёршись в исчезнувшего человека.
 *
 * Сбой чтения или записи не должен ронять заявку: в худшем случае двое подряд
 * получат её от одного менеджера очереди.
 */
export async function nextAssignee(): Promise<number> {
  const queue = queueIds()
  if (queue.length === 0) return FALLBACK_ASSIGNEE
  if (queue.length === 1) return queue[0]

  let issued = 0
  try {
    const parsed = JSON.parse(await readFile(FILE, 'utf8'))
    if (typeof parsed?.issued === 'number' && Number.isFinite(parsed.issued)) {
      issued = parsed.issued
    }
  } catch {
    // Файла ещё нет или он побился — начинаем круг заново.
  }

  const assignee = queue[issued % queue.length]

  try {
    await mkdir(DIR, { recursive: true })
    await writeFile(FILE, JSON.stringify({ issued: issued + 1 }), 'utf8')
  } catch {
    console.error('staff-lead: не удалось сохранить позицию очереди')
  }

  return assignee
}

/**
 * Наблюдатели сделки.
 *
 * Ответственного из списка убираем: он и так видит свою сделку, а Битрикс на
 * человеке в двух ролях сразу спотыкается.
 */
export function observersFor(assigneeId: number): number[] {
  return parseUserIds(process.env.STAFF_DEAL_OBSERVER_IDS).filter(id => id !== assigneeId)
}
