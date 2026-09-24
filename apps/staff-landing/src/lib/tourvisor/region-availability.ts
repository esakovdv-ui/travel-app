import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

/**
 * Журнал наблюдений: какие курорты реально возвращались в выдаче.
 *
 * ВАЖНО: этот журнал никого не прячет. Он только поднимает наверх курорты,
 * по которым предложения точно были. Отсутствие курорта здесь не означает,
 * что он пуст, — и вот почему.
 *
 * Замеры по России, окно +21 день, один и тот же запрос в один и тот же день:
 *   прогон А — 25 раундов догрузки: 388 отелей, 12 курортов (в т.ч. СПб)
 *   прогон Б — 70 раундов, выдача исчерпана: 466 отелей, 9 курортов (без СПб)
 * Более полный прогон нашёл БОЛЬШЕ отелей и МЕНЬШЕ курортов. Значит, состав
 * ответивших операторов меняется от прогона к прогону, и даже исчерпывающий
 * поиск не перечисляет все курорты. Плюс сама пустота зависит от дат:
 * Санкт-Петербург в одном окне отдаёт 97 отелей, в соседнем — ноль.
 *
 * Отсюда два вывода. Первый: заранее опросить «где по нулям» нельзя — набор
 * курортов стоял на 9 двадцать четыре раунда подряд и прыгнул на двадцать
 * пятом, так что «не рос K раундов» не значит «больше ничего нет». Второй:
 * скрывать курорт по факту его отсутствия в выдаче тоже нельзя — мы бы
 * спрятали живое направление. Единственное честное применение этих данных —
 * порядок показа.
 *
 * Пишем только то, что видели своими глазами: результат настоящего поиска.
 * Ключ — страна и месяц заезда, потому что сезонность и есть причина пустоты.
 *
 * Данные лежат рядом с журналом входов, в data/ — каталог переживает выкат
 * (rsync исключает его явно).
 */

/** Наблюдение по одной паре «страна + месяц заезда». */
export interface MonthObservation {
  /** id курортов, которые хоть раз приходили в выдаче за этот месяц. */
  seen: number[]
  /** Сколько поисков сюда сложилось. Одного мало, чтобы кого-то прятать. */
  scans: number
  /** Последний поиск по этой паре. */
  updatedAt: string
}

type Ledger = Record<string, Record<string, MonthObservation>>

const DIR = process.env.STAFF_ACCESS_LOG_DIR ?? path.join(process.cwd(), 'data')
const FILE = path.join(DIR, 'region-availability.json')

/**
 * Сколько поисков нужно, чтобы менять порядок курортов.
 *
 * По одному поиску сортировать рано: состав операторов пляшет от прогона к
 * прогону, и первый же поиск месяца дал бы случайный порядок. Два независимых
 * поиска дают объединение, на которое уже можно опереться.
 */
export const MIN_SCANS_TO_RANK = 2

/** Наблюдения стареют: расписание операторов на тот же месяц через год другое. */
const MAX_AGE_DAYS = 45

function monthKey(dateFrom: string): string {
  return dateFrom.slice(0, 7) // YYYY-MM
}

async function read(): Promise<Ledger> {
  try {
    const parsed = JSON.parse(await readFile(FILE, 'utf8'))
    return parsed && typeof parsed === 'object' ? (parsed as Ledger) : {}
  } catch {
    return {}
  }
}

async function write(ledger: Ledger): Promise<void> {
  await mkdir(DIR, { recursive: true })
  await writeFile(FILE, JSON.stringify(ledger), 'utf8')
}

function isFresh(observation: MonthObservation): boolean {
  const age = Date.now() - Date.parse(observation.updatedAt)
  return Number.isFinite(age) && age < MAX_AGE_DAYS * 24 * 60 * 60 * 1000
}

/**
 * Что известно про курорты страны на месяц заезда.
 *
 * Пока наблюдений меньше порога — отдаём null: «не знаем». Клиент в этом
 * случае показывает курорты в их обычном порядке.
 */
export async function getObservation(
  countryId: number,
  dateFrom: string,
): Promise<MonthObservation | null> {
  const ledger = await read()
  const observation = ledger[String(countryId)]?.[monthKey(dateFrom)]
  if (!observation || !isFresh(observation)) return null
  return observation
}

/**
 * Записать курорты, которые вернул завершившийся поиск.
 *
 * Объединяем с прошлыми наблюдениями и никогда не вычитаем: раз курорт хоть
 * раз отдал отели на этот месяц, он живой, даже если следующий поиск его не
 * увидит. Так журнал устойчив к пляшущему составу операторов.
 */
export async function recordObservation(
  countryId: number,
  dateFrom: string,
  regionIds: number[],
): Promise<void> {
  const ledger = await read()
  const country = String(countryId)
  const month = monthKey(dateFrom)

  const previous = ledger[country]?.[month]
  const merged = previous && isFresh(previous)
    ? { seen: [...new Set([...previous.seen, ...regionIds])], scans: previous.scans + 1 }
    : { seen: [...new Set(regionIds)], scans: 1 }

  ledger[country] ??= {}
  ledger[country][month] = {
    seen: merged.seen.sort((a, b) => a - b),
    scans: merged.scans,
    updatedAt: new Date().toISOString(),
  }

  await write(ledger)
}
