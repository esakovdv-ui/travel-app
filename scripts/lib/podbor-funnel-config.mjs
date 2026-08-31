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
    lead: 0,
    lead_order: 0,
    handoff_tours: 0,
    handoff_hotels: 0,
    cr_start_handoff: '',
    utm_users: 0,
    tours_entry: 0,
    tours_search: 0,
    tours_tour_card: 0,
    tours_cart: 0,
    tours_booking: 0,
    tours_purchase: 0,
    hotels_search: 0,
    hotels_package: 0,
    hotels_checkout: 0,
    hotels_payment_block: 0,
    hotels_purchase: 0,
  };
}

export const COUNTERS = {
  mgt: '90662828',
  wizard: '109401746',
  hotels: '97107007',
};

export const UTM_PODBOR = "ym:s:UTMSource=='podbor_wizard'";

/** Первый заход на отели с подбора: UTM или маркер podbor_ref=1 в URL handoff. */
export const PODBOR_HOTELS_ENTRY =
  "(ym:s:UTMSource=='podbor_wizard' OR ym:pv:URL=@'podbor_ref=1')";

/**
 * LT-воронка на счётчике 97107007 (yandex-metrika-mcp).
 * @see ../yandex-metrika-mcp/scripts/funnel-report.mjs
 * @see ../yandex-metrika-mcp/docs/ytm-funnel-setup.md
 */
export const HOTEL_LT_GOALS = {
  /** URL /packages/ без /success */
  packageUrl: 546439188,
  /** JS lt_checkout_start — первый показ формы оформления */
  checkout: 579160037,
  /** JS payment_block_displayed — блок оплаты на экране */
  paymentBlock: 579160036,
  /** JS lt_payment_start — ушёл на оплату */
  paymentStart: 579160039,
  /** JS lt_purchase — основная метрика покупки (transaction в dataLayer) */
  purchase: 579160040,
};

/** Sletat module id from podbor handoff. Hash UTM is invisible to Metrika; this is the historical proxy. */
export const PODBOR_TOUR_MODULE = '68ea30c6';
export const TOURS_FROM_PODBOR = `ym:pv:URL=@'${PODBOR_TOUR_MODULE}'`;

/**
 * С этой даты (МСК) в handoff туров есть podbor_ref=1.
 * Недели целиком после даты — узкая когорта; раньше / на стыке — legacy moduleId.
 */
export const PODBOR_TOURS_REF_START = '2026-08-21';

/** Узкая когорта: UTM или podbor_ref (как отели). */
export const PODBOR_TOURS_ENTRY_REF =
  `(${UTM_PODBOR} OR ym:pv:URL=@'podbor_ref=1')`;

/** До маркера: UTM или moduleId (широкий proxy, иначе выдача ≈ 0). */
export const PODBOR_TOURS_ENTRY_LEGACY =
  `(${UTM_PODBOR} OR ${TOURS_FROM_PODBOR})`;

/** @deprecated use toursFiltersForWeek / PODBOR_TOURS_ENTRY_REF */
export const PODBOR_TOURS_ENTRY = PODBOR_TOURS_ENTRY_REF;

/** true только если вся неделя уже после деплоя podbor_ref. */
export function useToursRefCohort(weekFrom, weekTo = weekFrom) {
  return weekFrom >= PODBOR_TOURS_REF_START;
}

/** Фильтры когорты туров для конкретной недели. */
export function toursFiltersForWeek(weekFrom, weekTo = weekFrom) {
  if (useToursRefCohort(weekFrom, weekTo)) {
    return {
      mode: 'ref',
      entry: PODBOR_TOURS_ENTRY_REF,
      search: PODBOR_TOURS_ENTRY_REF,
      card: `${PODBOR_TOURS_ENTRY_REF} AND ym:pv:URL=@'action=tourCard'`,
      goals: PODBOR_TOURS_ENTRY_REF,
    };
  }
  return {
    mode: 'legacy',
    entry: PODBOR_TOURS_ENTRY_LEGACY,
    search: `${TOURS_FROM_PODBOR} AND ym:pv:URL=@'action=search' AND ym:pv:URL=@'dateFrom='`,
    card: `${TOURS_FROM_PODBOR} AND ym:pv:URL=@'action=tourCard'`,
    goals: TOURS_FROM_PODBOR,
  };
}

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
  { key: 'lead', id: 602593348, name: 'podbor_lead_submit' },
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
  utm_users: {
    key: 'utm_users',
    label: 'UTM: пользователи podbor_wizard',
    counter: COUNTERS.mgt,
    type: 'users',
    filter: UTM_PODBOR,
  },
  tours_search: {
    key: 'tours_search',
    label: 'Туры: выдача',
    counter: COUNTERS.mgt,
    type: 'users',
    journeyEntry: PODBOR_TOURS_ENTRY_REF,
    filter: PODBOR_TOURS_ENTRY_REF,
    journeyNote: `с ${PODBOR_TOURS_REF_START}: podbor_ref/UTM; раньше: moduleId+search`,
  },
  tours_tour_card: {
    key: 'tours_tour_card',
    label: 'Туры: карточка тура',
    counter: COUNTERS.mgt,
    type: 'users',
    journeyEntry: PODBOR_TOURS_ENTRY_REF,
    filter: `${PODBOR_TOURS_ENTRY_REF} AND ym:pv:URL=@'action=tourCard'`,
    journeyNote: 'см. toursFiltersForWeek',
  },
  tours_cart: {
    key: 'tours_cart',
    label: 'Туры: корзина (Слетать click-buyonline)',
    counter: COUNTERS.mgt,
    type: 'goal',
    journeyEntry: PODBOR_TOURS_ENTRY_REF,
    goalId: 326738951,
    filter: PODBOR_TOURS_ENTRY_REF,
    journeyNote: 'см. toursFiltersForWeek',
  },
  tours_booking: {
    key: 'tours_booking',
    label: 'Туры: забронировал (Слетать buying_submit)',
    counter: COUNTERS.mgt,
    type: 'goal',
    journeyEntry: PODBOR_TOURS_ENTRY_REF,
    goalId: 321609998,
    filter: PODBOR_TOURS_ENTRY_REF,
    journeyNote: 'см. toursFiltersForWeek',
  },
  tours_purchase: {
    key: 'tours_purchase',
    label: 'Туры: заявка (цель «Успешная оплата» в Метрике — по факту лид)',
    counter: COUNTERS.mgt,
    type: 'goal',
    journeyEntry: PODBOR_TOURS_ENTRY_REF,
    goalId: 321612203,
    filter: PODBOR_TOURS_ENTRY_REF,
    journeyNote: 'см. toursFiltersForWeek',
  },
  hotels_search: {
    key: 'hotels_search',
    label: 'Отели: выдача /search',
    counter: COUNTERS.hotels,
    type: 'journey',
    journeyEntry: PODBOR_HOTELS_ENTRY,
    filter: "ym:pv:URL=@'russia.mosgortur.ru/search'",
    journeyNote: 'clientID: заход с podbor → /search',
  },
  hotels_package: {
    key: 'hotels_package',
    label: 'Отели: корзина /packages',
    counter: COUNTERS.hotels,
    type: 'journey',
    journeyEntry: PODBOR_HOTELS_ENTRY,
    filter: "ym:pv:URL=@'russia.mosgortur.ru/packages/' AND ym:pv:URL!@'/success'",
    journeyNote: 'clientID: заход с podbor → /packages',
  },
  hotels_checkout: {
    key: 'hotels_checkout',
    label: 'Отели: чекаут (lt_checkout_start)',
    counter: COUNTERS.hotels,
    type: 'journey',
    journeyEntry: PODBOR_HOTELS_ENTRY,
    goalId: HOTEL_LT_GOALS.checkout,
    filter: `ym:s:goal${HOTEL_LT_GOALS.checkout}reaches>0`,
    journeyNote: 'clientID: заход с podbor → lt_checkout_start',
  },
  hotels_payment_block: {
    key: 'hotels_payment_block',
    label: 'Отели: блок оплаты (payment_block_displayed)',
    counter: COUNTERS.hotels,
    type: 'journey',
    journeyEntry: PODBOR_HOTELS_ENTRY,
    goalId: HOTEL_LT_GOALS.paymentBlock,
    filter: `ym:s:goal${HOTEL_LT_GOALS.paymentBlock}reaches>0`,
    journeyNote: 'clientID: заход с podbor → payment_block_displayed',
  },
  hotels_purchase: {
    key: 'hotels_purchase',
    label: 'Отели: оплата (lt_purchase)',
    counter: COUNTERS.hotels,
    type: 'journey',
    journeyEntry: PODBOR_HOTELS_ENTRY,
    goalId: HOTEL_LT_GOALS.purchase,
    filter: `ym:s:goal${HOTEL_LT_GOALS.purchase}reaches>0`,
    journeyNote: 'clientID: заход с podbor → lt_purchase',
  },
};

/** Конверсия curr / prev → «72,8%». Пусто, если нет базы или нулевого числителя. */
export function crBetween(curr, prev) {
  if (!prev || !curr) return '';
  return `${((curr / prev) * 100).toFixed(1).replace('.', ',')}%`;
}

export const SHEET_TAB_FUNNEL = 'Воронка';
export const SHEET_TAB_REF = 'Справочник';
/** Старые отдельные листы — удаляем при sync. */
export const SHEET_TABS_OBSOLETE = ['Визард', 'Туры', 'Отели', 'Лист1'];

/** Блок визарда: недели строками. */
export const WIZARD_SHEET_COLUMNS = [
  'Неделя',
  'С',
  'По',
  'Клик баннер',
  'Клик popup',
  'Старт визарда',
  'CR → кто едет',
  'Шаг: кто едет',
  'CR → бюджет',
  'Шаг: бюджет',
  'CR → формат',
  'Шаг: формат',
  'CR → регион',
  'Шаг: регион',
  'CR → даты',
  'Шаг: даты',
  'CR → итог',
  'Шаг: итог',
  'CR → handoff',
  'Handoff',
  'CR старт→handoff',
  'Handoff: туры',
  'CR туры от handoff',
  'Handoff: отели',
  'CR отели от handoff',
  'Лид (контакт)',
  'CR итог→лид',
  'Заказ (Битrix)',
  'CR лид→заказ',
];

/**
 * Туры / отели: показатели строками, недели колонками.
 * value(m) — число или CR-строка для одной недели.
 */
export const TOURS_METRIC_ROWS = [
  { label: 'Handoff: туры', value: (m) => m.handoff_tours },
  { label: 'Выдача', value: (m) => m.tours_search },
  { label: 'CR handoff→выдача', value: (m) => crBetween(m.tours_search, m.handoff_tours) },
  { label: 'Карточка', value: (m) => m.tours_tour_card },
  { label: 'CR выдача→карточка', value: (m) => crBetween(m.tours_tour_card, m.tours_search) },
  { label: 'Корзина', value: (m) => m.tours_cart },
  { label: 'CR карточка→корзина', value: (m) => crBetween(m.tours_cart, m.tours_tour_card) },
  { label: 'Бронь', value: (m) => m.tours_booking },
  { label: 'CR корзина→бронь', value: (m) => crBetween(m.tours_booking, m.tours_cart) },
  { label: 'Заявка', value: (m) => m.tours_purchase },
  { label: 'CR бронь→заявка', value: (m) => crBetween(m.tours_purchase, m.tours_booking) },
];

export const HOTELS_METRIC_ROWS = [
  { label: 'Handoff: отели', value: (m) => m.handoff_hotels },
  { label: 'Выдача', value: (m) => m.hotels_search },
  { label: 'CR handoff→выдача', value: (m) => crBetween(m.hotels_search, m.handoff_hotels) },
  { label: 'Корзина', value: (m) => m.hotels_package },
  { label: 'CR выдача→корзина', value: (m) => crBetween(m.hotels_package, m.hotels_search) },
  { label: 'Чекаут', value: (m) => m.hotels_checkout },
  { label: 'CR корзина→чекаут', value: (m) => crBetween(m.hotels_checkout, m.hotels_package) },
  { label: 'Блок оплаты', value: (m) => m.hotels_payment_block },
  {
    label: 'CR чекаут→блок оплаты',
    value: (m) => crBetween(m.hotels_payment_block, m.hotels_checkout),
  },
  { label: 'Оплата', value: (m) => m.hotels_purchase },
  {
    label: 'CR блок оплаты→оплата',
    value: (m) => crBetween(m.hotels_purchase, m.hotels_payment_block),
  },
];

/** Собрать матрицу: [ ['Показатель', week1, week2, …], [label, v1, v2, …], … ] */
export function buildMetricWeekMatrix(metricRows, weekMetricsList, weekLabels) {
  const header = ['Показатель', ...weekLabels];
  const body = metricRows.map((row) => [row.label, ...weekMetricsList.map((m) => row.value(m))]);
  return [header, ...body];
}

export const SHEET_COLUMNS = WIZARD_SHEET_COLUMNS;

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
  [COUNTERS.wizard, '602593348', 'podbor_lead_submit', 'Отправили имя и телефон → Битрикс category/12'],
  ['Битrix', 'category/12', 'C12:WON', 'Сделка «Подбор: …» → этап «Успешно сформирована заявка» (DATE_CREATE в неделе)'],
  [COUNTERS.wizard, '595566515 + format=tour', 'podbor_handoff', 'Handoff в туры'],
  [COUNTERS.wizard, '595566515 + format=hotel', 'podbor_handoff', 'Handoff в отели'],
  ['Битрикс', 'category/12', 'C12:NEW', 'POST /api/podbor-lead — сделка «Подбор: …»'],
  [COUNTERS.mgt, '326738951', 'click-buyonline', 'Туры: корзина (journey с podbor)'],
  [COUNTERS.mgt, '321609998', 'sletat:module6:buying_submit', 'Туры: бронь (journey с podbor)'],
  [COUNTERS.mgt, '321612203', 'Успешная оплата (имя в Метрике)', 'Туры: заявка / лид (journey с podbor)'],
  [COUNTERS.hotels, '—', 'russia.mosgortur.ru/search', 'Отели: выдача (journey с podbor)'],
  [COUNTERS.hotels, String(HOTEL_LT_GOALS.packageUrl), '/packages/ URL', 'Отели: корзина (journey с podbor)'],
  [COUNTERS.hotels, String(HOTEL_LT_GOALS.checkout), 'lt_checkout_start', 'Отели: чекаут (journey с podbor)'],
  [COUNTERS.hotels, String(HOTEL_LT_GOALS.paymentBlock), 'payment_block_displayed', 'Отели: блок оплаты (journey с podbor)'],
  [COUNTERS.hotels, String(HOTEL_LT_GOALS.purchase), 'lt_purchase', 'Отели: оплата (реальная покупка)'],
  [COUNTERS.hotels, 'podbor_ref=1', 'URL handoff', 'Маркер подбора, если UTM теряется на внутренних переходах'],
  ['', '', '', ''],
  ['Не использовать', '358300437', 'отправил контактные данные LT', 'Legacy автоцель — не LT-воронка'],
  ['Не использовать', '504749523', 'Начало оформления LT (авто)', 'Legacy — дублирует lt_checkout_start'],
  ['Фильтр UTM', UTM_PODBOR, '', 'Туры и вход на mosgortur.ru'],
  ['Туры с подбора', `с ${PODBOR_TOURS_REF_START}: ${PODBOR_TOURS_ENTRY_REF}`, 'когорта', 'До даты — moduleId (legacy), иначе выдача ≈ 0'],
  ['Отели с подбора', PODBOR_HOTELS_ENTRY, 'clientID journey', 'Заход podbor_ref/UTM → выдача/корзина/чекаут/оплата на 97107007'],
  ['Туры moduleId', `URL содержит ${PODBOR_TOUR_MODULE}`, 'legacy до podbor_ref', `proxy до ${PODBOR_TOURS_REF_START}`],
  ['Handoff UTM', 'utm_source=podbor_wizard + podbor_ref=1', 'utm_campaign={format}_{region}_{n}n', 'public/podbor.html buildHandoffUrl (туры и отели)'],
  ['Старт учёта', PODBOR_FUNNEL_START_DEFAULT, 'PODBOR_FUNNEL_START', 'Недели до этой даты не выводятся в отчёт'],
  [
    'Лист Воронка',
    'Визард: недели строками; Туры/Отели: показатели строками, недели колонками; туры — когорта на 90662828',
    'CR',
    'конверсия от предыдущего шага (туры: одна когорта UTM|moduleId)',
  ],
];
