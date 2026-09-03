/**
 * Staff.motrip.ru funnel: counter, goals, sheet layout.
 * @see docs/staff-metrika-goals.md
 */

/** Учёт воронки с этой даты (МСK). */
export const STAFF_FUNNEL_START_DEFAULT = '2026-08-12';

export const STAFF_COUNTER = '109401746';

/** Визиты, которые начались на портале. Счётчик общий с motrip.ru. */
export const STAFF_START_URL_FILTER = "ym:s:startURL=@'staff.motrip.ru'";

export function getFunnelStart() {
  const raw = process.env.STAFF_FUNNEL_START?.trim();
  return raw || STAFF_FUNNEL_START_DEFAULT;
}

/** null = неделя целиком до старта → строку в отчёт не включаем */
export function effectiveMetricsRange(week, funnelStart) {
  if (week.to < funnelStart) return null;
  const from = week.from >= funnelStart ? week.from : funnelStart;
  return { from, to: week.to };
}

export function filterReportWeeks(weeks, funnelStart) {
  return weeks.filter((w) => effectiveMetricsRange(w, funnelStart));
}

export function crBetween(curr, prev) {
  if (!prev || !curr) return '';
  return `${((curr / prev) * 100).toFixed(1).replace('.', ',')}%`;
}

/**
 * Цели JS-событий на счётчике 109401746.
 * chain: true — шаг в CR-цепочке (боковые login_fail / lead_fail — нет).
 */
export const STAFF_GOALS = [
  {
    key: 'login_attempt',
    id: 595717534,
    name: 'staff_login_attempt',
    label: 'Нажали «Войти»',
    chain: true,
  },
  {
    key: 'login_success',
    id: 595717535,
    name: 'staff_login_success',
    label: 'Вошли',
    chain: true,
  },
  {
    key: 'login_fail',
    id: 595717536,
    name: 'staff_login_fail',
    label: 'Не пустили',
    chain: false,
  },
  {
    key: 'search_submit',
    id: 595717537,
    name: 'staff_search_submit',
    label: 'Искали туры',
    chain: true,
  },
  {
    key: 'tours_results',
    id: 595717538,
    name: 'staff_tours_results',
    label: 'Увидели выдачу',
    chain: true,
  },
  {
    key: 'hotel_open',
    id: 595717539,
    name: 'staff_hotel_open',
    label: 'Открыли отель',
    chain: true,
  },
  {
    key: 'book_open',
    id: 595717540,
    name: 'staff_book_open',
    label: 'Открыли форму заявки',
    chain: true,
  },
  {
    key: 'lead_success',
    id: 595717541,
    name: 'staff_lead_success',
    label: 'Отправили заявку',
    chain: true,
  },
  {
    key: 'lead_fail',
    id: 595717542,
    name: 'staff_lead_fail',
    label: 'Ошибка отправки',
    chain: false,
  },
];

export const SHEET_TAB_FUNNEL = 'Воронка';
export const SHEET_TAB_WEEKS = 'По неделям';
export const SHEET_TAB_REF = 'Справочник';

export const FUNNEL_COLUMNS = [
  'Этап',
  'Посетители',
  'Сессии',
  'Целевые действия',
  'CR от предыдущего',
  'CR от захода на портал',
];

export const WEEKLY_STAGE_ROWS = [
  { key: 'visit', label: 'Зашли на портал' },
  ...STAFF_GOALS.map((g) => ({ key: g.key, label: g.label })),
  { key: 'bitrix', label: 'Заявки в Битрикс' },
];

export const REFERENCE_ROWS = [
  ['Поле', 'Значение', 'Источник', 'Когда'],
  [STAFF_COUNTER, STAFF_START_URL_FILTER, 'ym:s:users / ym:s:visits', 'Зашли на staff.motrip.ru'],
  ...STAFF_GOALS.map((g) => [
    STAFF_COUNTER,
    String(g.id),
    g.name,
    g.label + (g.chain ? '' : ' (боковая ветка, не в CR-цепочке)'),
  ]),
  [
    'Битрикс',
    'category/22 · SOURCE_ID=UC_58Z62L',
    'crm.deal.list DATE_CREATE',
    'Сделка с портала staff.motrip.ru',
  ],
  ['', '', '', ''],
  [
    'Старт учёта',
    STAFF_FUNNEL_START_DEFAULT,
    'STAFF_FUNNEL_START',
    'Недели до этой даты не выводятся в отчёт',
  ],
  [
    'Лист Воронка',
    'Этапы строками, период = выбранные недели',
    'Посетители / сессии / reaches',
    'Уники за весь период, не сумма недель',
  ],
  [
    'Лист По неделям',
    'Этапы строками, недели колонками',
    'Посетители (goal*users)',
    'Битрикс — число сделок за неделю',
  ],
  [
    'CR-цепочка',
    'заход → Войти → вошли → поиск → выдача → отель → форма → заявка',
    'по посетителям',
    'Не пустили / ошибка отправки не входят в цепочку',
  ],
];
