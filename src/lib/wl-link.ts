/**
 * Сборка ссылок на карточку отеля в White Label.
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

export interface WlSearchContext {
  /** Идентификатор поиска в Level Travel. Без него WL игнорирует остальные параметры. */
  requestId?: string;
  /** `hotel` — только проживание, `package` — тур с перелётом. */
  searchType?: 'hotel' | 'package';
  adults?: number;
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

  const url = `${baseUrl}${offer.link}`;

  // Без request_id остальные параметры WL не применяет — проверено, даты
  // всё равно сбрасываются на дефолтные. Тогда ссылка остаётся как была.
  if (!ctx.requestId) return url;

  const searchType = ctx.searchType ?? 'package';
  const params = new URLSearchParams({
    request_id: ctx.requestId,
    search_type: searchType,
  });

  if (offer.minPrice) params.set('offer_price', String(offer.minPrice));
  if (offer.nights)   params.set('offer_nights', String(offer.nights));

  const date = cheapestDate(offer.dates);
  if (date) params.set('offer_date', date);

  if (ctx.adults) params.set('adults', String(ctx.adults));

  // Города вылета у нас только российские, поэтому суффикс всегда RU.
  // У поиска «только отель» вылета нет — WL ждёт в этом случае `Any`.
  params.set('from', searchType === 'hotel' ? 'Any-RU' : `${ctx.fromCity ?? 'Moscow'}-RU`);

  return `${url}${url.includes('?') ? '&' : '?'}${params}`;
}
