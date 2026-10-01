/**
 * Сборка ссылок на карточку отеля в White Label.
 *
 * Параметры те же, в которые WL переписывает собственный адрес, если открыть
 * карточку без них: start_date, nights, adults, kids, search_type, from.
 * Раньше мы слали request_id + offer_date/offer_nights/offer_price — это
 * работало, пока их поиск отвечал быстро, но 01.10 страница стала открываться
 * пустой с «Hotel searcher: невозможно получить номера»: WL ждал наш поиск,
 * а тот у них подвисал. Формат ниже ни от какого поиска не зависит.
 *
 * Level Travel отдаёт в выдаче только относительный путь вида
 * `/hotels/9161535-Mirazh_Gostevoj_Dom`. Если открыть его как есть, WL ничего
 * не знает о нашем поиске и подставляет свои дефолты: ближайшие даты и тур
 * с перелётом. Человек видит в карточке «от 5 942 ₽ за 6 ночей», кликает —
 * и попадает на «от 44 399 ₽ с перелётом» на других датах.
 *
 * Поэтому доносим контекст поиска через query. Набор параметров и их формат
 * сняты с самого WL — так он линкует карточки в собственной выдаче.
 */

/**
 * Адрес White Label по умолчанию.
 *
 * NEXT_PUBLIC_* вшивается в бандл при сборке, и если на сервере переменной
 * не оказалось, `process.env.NEXT_PUBLIC_WL_BASE_URL ?? ''` давал пустую
 * строку — ссылки становились относительными и вели на наш же /hotels
 * вместо WL. Так и случилось на проде. Поэтому база задаётся здесь,
 * а переменная окружения лишь переопределяет её.
 */
const DEFAULT_WL_BASE_URL = 'https://mytrip.mosgortur.ru';

export function wlBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_WL_BASE_URL?.trim();
  return fromEnv || DEFAULT_WL_BASE_URL;
}

export interface WlSearchContext {
  /** `hotel` — только проживание, `package` — тур с перелётом. */
  searchType?: 'hotel' | 'package';
  adults?: number;
  /** Количество детей. WL ждёт этот параметр даже пустым. */
  kids?: number;
  /** Код города вылета Level Travel, напр. `Moscow`. */
  fromCity?: string;
}

export interface WlOffer {
  /** Относительный путь из ответа API. */
  link: string;
  minPrice?: number;
  nights?: number;
  /** Карта «дата → цена» из выдачи: по ней находим дату самого дешёвого оффера. */
  dates?: Record<string, number>;
}

/** Дата самого дешёвого оффера (YYYY-MM-DD) — именно её показывает карточка. */
function cheapestDate(dates?: Record<string, number>): string | undefined {
  const entries = Object.entries(dates ?? {});
  if (entries.length === 0) return undefined;
  return entries.reduce((best, cur) => (cur[1] < best[1] ? cur : best))[0];
}

export function buildWlHotelUrl(
  baseUrl: string,
  offer: WlOffer,
  ctx: WlSearchContext = {},
): string {
  if (!offer.link) return baseUrl;

  // Пустая база дала бы относительный путь на наш же домен.
  const base = baseUrl?.trim() || DEFAULT_WL_BASE_URL;
  const url = `${base}${offer.link}`;

  const date = cheapestDate(offer.dates);
  if (!date || !offer.nights) return url;

  const searchType = ctx.searchType ?? 'package';
  const params = new URLSearchParams({
    start_date: date,
    nights: String(offer.nights),
    adults: String(ctx.adults ?? 2),
    kids: ctx.kids ? String(ctx.kids) : '',
    search_type: searchType,
    // Города вылета у нас только российские, поэтому суффикс всегда RU.
    // У поиска «только отель» вылета нет — WL ждёт в этом случае `Any`.
    from: searchType === 'hotel' ? 'Any-RU' : `${ctx.fromCity ?? 'Moscow'}-RU`,
  });

  return `${url}${url.includes('?') ? '&' : '?'}${params}`;
}
