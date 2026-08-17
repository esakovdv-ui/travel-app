/**
 * Podbor wizard funnel: counters, goals, filters.
 * @see docs/podbor-wizard-landing.md
 */

/** Учёт воронки с этой даты (МСK). Данные до неё — нули (тестовые прохождения). */
export const PODBOR_FUNNEL_START_DEFAULT = '2026-08-13';

export function getFunnelStart() {
  const raw = process.env.PODBOR_FUNNEL_START?.trim();
  return raw || PODBOR_FUNNEL_START_DEFAULT;
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

export function emptyFunnelMetrics() {
  return {
    banner: 0,
    popup: 0,
    start: 0,
    people: 0,
    budget: 0,
    format: 0,
    region: 0,
    dates: 0,
    summary: 0,
    handoff: 0,
    handoff_tours: 0,
    handoff_hotels: 0,
    cr_start_handoff: '',
    utm_visits: 0,
    tours_search: 0,
    tours_tour_card: 0,
    tours_cart: 0,
    tours_booking: 0,
    tours_purchase: 0,
    hotels_search: 0,
    hotels_package: 0,
    hotels_checkout: 0,
    hotels_purchase: 0,
  };
}

export const COUNTERS = {
  mgt: '90662828',
  wizard: '109401746',
  hotels: '97107007',
};

export const UTM_PODBOR = "ym:s:UTMSource=='podbor_wizard'";

/** Sletat module id from podbor handoff. Hash UTM is invisible to Metrika; this is the historical proxy. */
export const PODBOR_TOUR_MODULE = '68ea30c6';
export const TOURS_FROM_PODBOR = `ym:pv:URL=@'${PODBOR_TOUR_MODULE}'`;

/** Entry clicks on online.mosgortur.ru */
export const ENTRY_GOALS = {
  banner_click: { id: 595574818, name: 'podbor_banner_click', counter: COUNTERS.mgt },
  popup_click: { id: 595574819, name: 'podbor_popup_click', counter: COUNTERS.mgt },
};

/** Wizard steps on motrip.ru/podbor */
export const WIZARD_GOALS = [
  { key: 'start', id: 595566508, name: 'podbor_start' },
  { key: 'people', id: 595566509, name: 'podbor_step_people' },
  { key: 'budget', id: 595566510, name: 'podbor_step_budget' },
  { key: 'format', id: 595566511, name: 'podbor_step_format' },
  { key: 'region', id: 595566512, name: 'podbor_step_region' },
  { key: 'dates', id: 595566513, name: 'podbor_step_dates' },
  { key: 'summary', id: 595566514, name: 'podbor_step_summary' },
  { key: 'handoff', id: 595566515, name: 'podbor_handoff' },
];

/**
 * After handoff — proxy funnel with utm_source=podbor_wizard.
 * Tours: Sletat module on 90662828. Hotels: Level Travel on 97107007.
 */
export const POST_HANDOFF = {
  handoff_tours: {
    key: 'handoff_tours',
    label: 'Handoff в туры',
    counter: COUNTERS.wizard,
    type: 'goal',
    goalId: 595566515,
    filter: `ym:s:paramsLevel2=='tour'`,
  },
  handoff_hotels: {
    key: 'handoff_hotels',
    label: 'Handoff в отели',
    counter: COUNTERS.wizard,
    type: 'goal',
    goalId: 595566515,
    filter: `ym:s:paramsLevel2=='hotel'`,
  },
  utm_visits: {
    key: 'utm_visits',
    label: 'Визиты utm podbor_wizard',
    counter: COUNTERS.mgt,
    type: 'users_visits',
    filter: UTM_PODBOR,
  },
  tours_search: {
    key: 'tours_search',
    label: 'Туры: выдача module6 search',
    counter: COUNTERS.mgt,
    type: 'users',
    filter: `${TOURS_FROM_PODBOR} AND ym:pv:URL=@'action=search' AND ym:pv:URL=@'dateFrom='`,
  },
  tours_tour_card: {
    key: 'tours_tour_card',
    label: 'Туры: карточка тура',
    counter: COUNTERS.mgt,
    type: 'users',
    filter: `${TOURS_FROM_PODBOR} AND ym:pv:URL=@'action=tourCard'`,
  },
  tours_cart: {
    key: 'tours_cart',
    label: 'Туры: корзина (Слетать)',
    counter: COUNTERS.mgt,
    type: 'goal',
    goalId: 328431134,
    filter: UTM_PODBOR,
  },
  tours_booking: {
    key: 'tours_booking',
    label: 'Туры: забронировал (Слетать)',
    counter: COUNTERS.mgt,
    type: 'goal',
    goalId: 328431171,
    filter: UTM_PODBOR,
  },
  tours_purchase: {
    key: 'tours_purchase',
    label: 'Туры: успешная оплата',
    counter: COUNTERS.mgt,
    type: 'goal',
    goalId: 321612203,
    filter: TOURS_FROM_PODBOR,
  },
  hotels_search: {
    key: 'hotels_search',
    label: 'Отели: выдача /search',
    counter: COUNTERS.hotels,
    type: 'users_visits',
    filter: `${UTM_PODBOR} AND ym:pv:URL=@'russia.mosgortur.ru/search'`,
  },
  hotels_package: {
    key: 'hotels_package',
    label: 'Отели: корзина /packages',
    counter: COUNTERS.hotels,
    type: 'users_visits',
    filter: `${UTM_PODBOR} AND ym:pv:URL=@'russia.mosgortur.ru/packages/' AND ym:pv:URL!@'/success'`,
  },
  hotels_checkout: {
    key: 'hotels_checkout',
    label: 'Отели: начало чекаута',
    counter: COUNTERS.hotels,
    type: 'goal',
    goalId: 579160037,
    filter: `${UTM_PODBOR} AND ym:pv:URL=@'russia.mosgortur.ru'`,
  },
  hotels_purchase: {
    key: 'hotels_purchase',
    label: 'Отели: покупка lt_purchase',
    counter: COUNTERS.hotels,
    type: 'goal',
    goalId: 579160040,
    filter: `${UTM_PODBOR} AND ym:pv:URL=@'russia.mosgortur.ru'`,
  },
};

/** Sheet column headers (Russian labels). */
export const SHEET_COLUMNS = [
  'Неделя',
  'С',
  'По',
  'Клик баннер',
  'Клик popup',
  'Старт визарда',
  'Шаг: кто едет',
  'Шаг: бюджет',
  'Шаг: формат',
  'Шаг: регион',
  'Шаг: даты',
  'Шаг: итог',
  'Handoff',
  'Handoff: туры',
  'Handoff: отели',
  'CR старт→handoff',
  'UTM визиты',
  'Туры: выдача',
  'Туры: карточка',
  'Туры: корзина',
  'Туры: бронь',
  'Туры: оплата',
  'Отели: выдача',
  'Отели: корзина',
  'Отели: чекаут',
  'Отели: покупка',
  'Обновлено',
];

export const REFERENCE_ROWS = [
  ['Счётчик', 'ID', 'reachGoal / метрика', 'Когда'],
  [COUNTERS.mgt, '595574818', 'podbor_banner_click', 'Клик по баннеру на online.mosgortur.ru'],
  [COUNTERS.mgt, '595574819', 'podbor_popup_click', 'Клик по popup на главной'],
  [COUNTERS.wizard, '595566508', 'podbor_start', 'Открыли motrip.ru/podbor'],
  [COUNTERS.wizard, '595566509', 'podbor_step_people', 'Шаг «кто едет»'],
  [COUNTERS.wizard, '595566510', 'podbor_step_budget', 'Шаг бюджета'],
  [COUNTERS.wizard, '595566511', 'podbor_step_format', 'Шаг тур/отель'],
  [COUNTERS.wizard, '595566512', 'podbor_step_region', 'Шаг направления'],
  [COUNTERS.wizard, '595566513', 'podbor_step_dates', 'Шаг дат'],
  [COUNTERS.wizard, '595566514', 'podbor_step_summary', 'Итог'],
  [COUNTERS.wizard, '595566515', 'podbor_handoff', '«Показать туры/отели»'],
  [COUNTERS.wizard, '595566515 + format=tour', 'podbor_handoff', 'Handoff в туры'],
  [COUNTERS.wizard, '595566515 + format=hotel', 'podbor_handoff', 'Handoff в отели'],
  [COUNTERS.mgt, '328431134', 'Перешел в корзину (Спец)', 'Туры после handoff + UTM'],
  [COUNTERS.mgt, '328431171', 'Забронировал тур (Спец)', 'Туры после handoff + UTM'],
  [COUNTERS.mgt, '321612203', 'Успешная оплата', 'Туры: оплата по moduleId визарда (допущение)'],
  [COUNTERS.hotels, '—', 'russia.mosgortur.ru/search', 'Отели: выдача + UTM'],
  [COUNTERS.hotels, '546439188', '/packages/ URL', 'Отели: корзина + UTM'],
  [COUNTERS.hotels, '579160037', 'lt_checkout_start', 'Отели: чекаут + UTM'],
  [COUNTERS.hotels, '579160040', 'lt_purchase', 'Отели: покупка + UTM'],
  ['', '', '', ''],
  ['Фильтр UTM', UTM_PODBOR, '', 'Нижняя часть воронки — прокси, без join между счётчиками'],
  ['Туры без UTM', `URL содержит ${PODBOR_TOUR_MODULE} + dateFrom`, 'hash trackHash', 'Выдача/карточка/оплата туров, пока UTM был в hash'],
  ['Handoff UTM', 'utm_source=podbor_wizard', 'utm_campaign={format}_{region}_{n}n', 'public/podbor.html buildHandoffUrl'],
  ['Старт учёта', PODBOR_FUNNEL_START_DEFAULT, 'PODBOR_FUNNEL_START', 'Недели до этой даты не выводятся в отчёт'],
];
