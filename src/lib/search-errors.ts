/**
 * Ошибки поиска для пользователя.
 *
 * Ответ поставщика (Level Travel) содержит внутренние коды, английский текст
 * и поле `origin` с его доменом. Показывать это на экране нельзя: клиент не
 * должен видеть, через кого мы ищем туры. Поэтому наружу отдаём только
 * человеческие формулировки, а техническую строку пишем в консоль.
 */

const FALLBACK = 'Не удалось загрузить туры. Попробуйте повторить поиск.';

const RULES: ReadonlyArray<{ match: RegExp; message: string }> = [
  {
    match: /invalid date|invalid.*param|parameters invalid/i,
    message: 'Проверьте даты поездки — похоже, они указаны неверно.',
  },
  {
    match: /timeout|timed out|deadline/i,
    message: 'Поиск занял слишком много времени. Попробуйте ещё раз.',
  },
  {
    match: /429|rate limit|too many/i,
    message: 'Сейчас слишком много запросов. Подождите немного и повторите поиск.',
  },
  {
    match: /network|fetch failed|ECONNREFUSED|ENOTFOUND/i,
    message: 'Нет связи с сервисом подбора туров. Проверьте интернет и попробуйте снова.',
  },
];

/**
 * Превращает любую ошибку поиска в безопасное сообщение.
 * Техническую причину логируем — она нужна в консоли браузера при разборе.
 */
export function toUserSearchError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');

  if (process.env.NODE_ENV !== 'production') {
    console.error('[search] request failed:', raw);
  }

  if (!raw) return FALLBACK;
  return RULES.find(r => r.match.test(raw))?.message ?? FALLBACK;
}
