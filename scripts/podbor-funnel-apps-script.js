/**
 * Google Apps Script для таблицы podbor funnel.
 * Вставить: Extensions → Apps Script → вставить этот файл → Run setupAndSync
 *
 * Script Properties (Project settings → Script properties):
 *   YANDEX_METRIKA_TOKEN — OAuth-токен Яндекс.Метрики
 *
 * Триггер: setupHourlyTrigger — раз в час (предпочтительнее GitHub Actions).
 */

const SHEET_FUNNEL = 'Воронка';
const SHEET_REF = 'Справочник';

const COUNTERS = { mgt: '90662828', wizard: '109401746', hotels: '97107007' };
const UTM_PODBOR = "ym:s:UTMSource=='podbor_wizard'";
const PODBOR_HOTELS_ENTRY = "(ym:s:UTMSource=='podbor_wizard' OR ym:pv:URL=@'podbor_ref=1')";
/** LT-воронка (yandex-metrika-mcp): lt_checkout_start, payment_block_displayed, lt_purchase */
const HOTEL_LT_GOALS = {
  checkout: 579160037,
  paymentBlock: 579160036,
  purchase: 579160040,
};
/** Учёт с этой даты (МСK). Тестовые прохождения до неё — нули. */
const PODBOR_FUNNEL_START = '2026-08-13';

const COLUMNS = [
  'Неделя', 'С', 'По', 'Клик баннер', 'Клик popup', 'Старт визарда',
  'Шаг: кто едет', 'Шаг: бюджет', 'Шаг: формат', 'Шаг: регион', 'Шаг: даты', 'Шаг: итог',
  'Handoff', 'Handoff: туры', 'Handoff: отели', 'CR старт→handoff', 'UTM: пользователи', 'Туры: выдача', 'Туры: карточка',
  'Туры: корзина', 'Туры: бронь', 'Туры: заявка', 'Отели: выдача', 'Отели: корзина',
  'Отели: чекаут', 'Отели: блок оплаты', 'Отели: оплата', 'Обновлено',
];

const WIZARD_GOALS = [
  { key: 'start', id: 595566508 }, { key: 'people', id: 595566509 },
  { key: 'budget', id: 595566510 }, { key: 'format', id: 595566511 },
  { key: 'region', id: 595566512 }, { key: 'dates', id: 595566513 },
  { key: 'summary', id: 595566514 }, { key: 'handoff', id: 595566515 },
];

function metrikaGet_(path) {
  const token = PropertiesService.getScriptProperties().getProperty('YANDEX_METRIKA_TOKEN');
  if (!token) throw new Error('Задайте YANDEX_METRIKA_TOKEN в Script Properties');
  const url = 'https://api-metrika.yandex.net' + path;
  const resp = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'OAuth ' + token },
    muteHttpExceptions: true,
  });
  const code = resp.getResponseCode();
  const text = resp.getContentText();
  if (code !== 200) throw new Error('Metrika ' + code + ': ' + text.slice(0, 300));
  return JSON.parse(text);
}

function goalUsers_(counter, goalId, d1, d2, filter) {
  let path = '/stat/v1/data?id=' + counter + '&date1=' + d1 + '&date2=' + d2 +
    '&metrics=ym:s:goal' + goalId + 'users';
  if (filter) path += '&filters=' + encodeURIComponent(filter);
  return metrikaGet_(path).totals[0] || 0;
}

function usersCount_(counter, d1, d2, filter) {
  let path = '/stat/v1/data?id=' + counter + '&date1=' + d1 + '&date2=' + d2 +
    '&metrics=ym:s:users';
  if (filter) path += '&filters=' + encodeURIComponent(filter);
  return metrikaGet_(path).totals[0] || 0;
}

function hotelEntryClients_(entryFrom, entryTo) {
  var path = '/stat/v1/data?id=' + COUNTERS.hotels + '&date1=' + entryFrom + '&date2=' + entryTo +
    '&metrics=ym:s:visits&dimensions=ym:s:clientID&limit=10000' +
    '&filters=' + encodeURIComponent(PODBOR_HOTELS_ENTRY);
  var rows = metrikaGet_(path).data || [];
  var clients = {};
  rows.forEach(function (row) {
    if (row.dimensions[0] && row.dimensions[0].name) clients[row.dimensions[0].name] = true;
  });
  return Object.keys(clients);
}

/** clientID journey: заход с подбора → действие на отелях в отчётной неделе. */
function hotelJourneyCount_(reportFrom, reportTo, downstreamFilter) {
  var entryFrom = PODBOR_FUNNEL_START > reportFrom ? PODBOR_FUNNEL_START : reportFrom;
  var ids = hotelEntryClients_(entryFrom, reportTo);
  if (!ids.length) return 0;

  var matched = {};
  for (var i = 0; i < ids.length; i += 10) {
    var chunk = ids.slice(i, i + 10);
    var orFilter = chunk.map(function (cid) { return "ym:s:clientID=='" + cid + "'"; }).join(' OR ');
    var path = '/stat/v1/data?id=' + COUNTERS.hotels + '&date1=' + reportFrom + '&date2=' + reportTo +
      '&metrics=ym:s:visits&dimensions=ym:s:clientID&limit=10000' +
      '&filters=' + encodeURIComponent('(' + orFilter + ') AND ' + downstreamFilter);
    (metrikaGet_(path).data || []).forEach(function (row) {
      if (row.dimensions[0] && row.dimensions[0].name) matched[row.dimensions[0].name] = true;
    });
  }
  return Object.keys(matched).length;
}

function weekStartMonday_(dayKey) {
  const d = new Date(dayKey + 'T12:00:00+03:00');
  const dow = d.getUTCDay();
  const toMon = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + toMon);
  return Utilities.formatDate(d, 'Europe/Moscow', 'yyyy-MM-dd');
}

function addDays_(dayKey, n) {
  const d = new Date(dayKey + 'T12:00:00+03:00');
  d.setUTCDate(d.getUTCDate() + n);
  return Utilities.formatDate(d, 'Europe/Moscow', 'yyyy-MM-dd');
}

function fmtWeek_(from, to) {
  return from.slice(8, 10) + '.' + from.slice(5, 7) + ' — ' +
    to.slice(8, 10) + '.' + to.slice(5, 7) + '.' + to.slice(0, 4);
}

function buildWeeks_(count) {
  const today = Utilities.formatDate(new Date(), 'Europe/Moscow', 'yyyy-MM-dd');
  const weeks = [];
  let cursor = today;
  for (let i = 0; i < count; i++) {
    const from = weekStartMonday_(cursor);
    const sunday = addDays_(from, 6);
    const to = sunday > today ? today : sunday;
    weeks.unshift({ from: from, to: to, label: fmtWeek_(from, to) });
    cursor = addDays_(from, -1);
  }
  return weeks;
}

function pct_(a, b) {
  if (!b || !a) return '';
  return (Math.round((a / b) * 1000) / 10).toFixed(1).replace('.', ',') + '%';
}

function effectiveMetricsRange_(week) {
  if (week.to < PODBOR_FUNNEL_START) return null;
  const from = week.from >= PODBOR_FUNNEL_START ? week.from : PODBOR_FUNNEL_START;
  return { from: from, to: week.to };
}

function fetchWeek_(week) {
  const m = {};
  m.banner = goalUsers_(COUNTERS.mgt, 595574818, week.from, week.to);
  m.popup = goalUsers_(COUNTERS.mgt, 595574819, week.from, week.to);
  WIZARD_GOALS.forEach(function (g) {
    m[g.key] = goalUsers_(COUNTERS.wizard, g.id, week.from, week.to);
  });
  m.handoff_tours = goalUsers_(COUNTERS.wizard, 595566515, week.from, week.to, "ym:s:paramsLevel2=='tour'");
  m.handoff_hotels = goalUsers_(COUNTERS.wizard, 595566515, week.from, week.to, "ym:s:paramsLevel2=='hotel'");
  m.cr = pct_(m.handoff, m.start);
  m.utm = usersCount_(COUNTERS.mgt, week.from, week.to, UTM_PODBOR);
  m.t_search = usersCount_(COUNTERS.mgt, week.from, week.to,
    "ym:pv:URL=@'68ea30c6' AND ym:pv:URL=@'action=search' AND ym:pv:URL=@'dateFrom='");
  m.t_card = usersCount_(COUNTERS.mgt, week.from, week.to,
    "ym:pv:URL=@'68ea30c6' AND ym:pv:URL=@'action=tourCard'");
  m.t_cart = goalUsers_(COUNTERS.mgt, 326738951, week.from, week.to, "ym:pv:URL=@'68ea30c6'");
  m.t_book = goalUsers_(COUNTERS.mgt, 321609998, week.from, week.to, "ym:pv:URL=@'68ea30c6'");
  m.t_pay = goalUsers_(COUNTERS.mgt, 321612203, week.from, week.to, "ym:pv:URL=@'68ea30c6'");
  m.h_search = hotelJourneyCount_(week.from, week.to, "ym:pv:URL=@'russia.mosgortur.ru/search'");
  m.h_cart = hotelJourneyCount_(week.from, week.to,
    "ym:pv:URL=@'russia.mosgortur.ru/packages/' AND ym:pv:URL!@'/success'");
  m.h_checkout = hotelJourneyCount_(week.from, week.to, 'ym:s:goal' + HOTEL_LT_GOALS.checkout + 'reaches>0');
  m.h_payment = hotelJourneyCount_(week.from, week.to, 'ym:s:goal' + HOTEL_LT_GOALS.paymentBlock + 'reaches>0');
  m.h_purchase = hotelJourneyCount_(week.from, week.to, 'ym:s:goal' + HOTEL_LT_GOALS.purchase + 'reaches>0');
  return m;
}

function ensureSheets_(ss) {
  if (!ss.getSheetByName(SHEET_FUNNEL)) ss.insertSheet(SHEET_FUNNEL);
  if (!ss.getSheetByName(SHEET_REF)) ss.insertSheet(SHEET_REF);
  const old = ss.getSheetByName('Лист1');
  if (old && ss.getSheets().length > 2) ss.deleteSheet(old);
}

function setupReference_(ss) {
  const sh = ss.getSheetByName(SHEET_REF);
  sh.clear();
  const rows = [
    ['Счётчик', 'ID', 'reachGoal / метрика', 'Когда'],
    [COUNTERS.mgt, '595574818', 'podbor_banner_click', 'Клик баннер'],
    [COUNTERS.mgt, '595574819', 'podbor_popup_click', 'Клик popup'],
    [COUNTERS.wizard, '595566508', 'podbor_start', 'Старт визарда'],
    [COUNTERS.wizard, '595566515', 'podbor_handoff', 'Handoff'],
    [COUNTERS.wizard, '595566515 + format=tour', 'podbor_handoff', 'Handoff в туры'],
    [COUNTERS.wizard, '595566515 + format=hotel', 'podbor_handoff', 'Handoff в отели'],
    [COUNTERS.mgt, '326738951', 'click-buyonline', 'Туры: корзина по moduleId'],
    [COUNTERS.mgt, '321609998', 'buying_submit', 'Туры: бронь по moduleId'],
    [COUNTERS.mgt, '321612203', 'Успешная оплата (имя в Метрике)', 'Туры: заявка / лид по moduleId'],
    [COUNTERS.hotels, String(HOTEL_LT_GOALS.checkout), 'lt_checkout_start', 'Отели: чекаут (journey с podbor)'],
    [COUNTERS.hotels, String(HOTEL_LT_GOALS.paymentBlock), 'payment_block_displayed', 'Отели: блок оплаты (journey с podbor)'],
    [COUNTERS.hotels, String(HOTEL_LT_GOALS.purchase), 'lt_purchase', 'Отели: оплата (реальная покупка)'],
    [COUNTERS.hotels, 'podbor_ref=1', 'URL handoff', 'Маркер подбора в handoff URL'],
    ['', '', '', ''],
    ['Не использовать', '358300437', 'отправил контактные данные LT', 'Legacy автоцель'],
    ['UTM фильтр', UTM_PODBOR, '', 'Туры и вход на mosgortur.ru'],
    ['Отели с подбора', PODBOR_HOTELS_ENTRY, 'clientID journey', 'Заход podbor_ref/UTM → выдача/корзина/чекаут/оплата'],
    ['Старт учёта', PODBOR_FUNNEL_START, 'PODBOR_FUNNEL_START', 'Недели до этой даты не выводятся в отчёт'],
  ];
  sh.getRange(1, 1, rows.length, 4).setValues(rows);
}

function setupAndSync() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheets_(ss);
  setupReference_(ss);

  const weeks = buildWeeks_(8);
  const updated = Utilities.formatDate(new Date(), 'Europe/Moscow', 'dd.MM.yyyy HH:mm');
  const rows = [COLUMNS];

  weeks.forEach(function (w) {
    const range = effectiveMetricsRange_(w);
    if (!range) return;
    const m = fetchWeek_(range);
    rows.push([
      w.label, w.from, w.to, m.banner, m.popup, m.start, m.people, m.budget, m.format,
      m.region, m.dates, m.summary, m.handoff, m.handoff_tours, m.handoff_hotels, m.cr, m.utm, m.t_search, m.t_card,
      m.t_cart, m.t_book, m.t_pay, m.h_search, m.h_cart, m.h_checkout, m.h_payment, m.h_purchase, updated,
    ]);
  });

  const sh = ss.getSheetByName(SHEET_FUNNEL);
  sh.clear();
  sh.getRange(1, 1, rows.length, COLUMNS.length).setValues(rows);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, COLUMNS.length);
}

function setupHourlyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'setupAndSync') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('setupAndSync')
    .timeBased()
    .everyHours(1)
    .create();
}

/** @deprecated используйте setupHourlyTrigger */
function setupWeeklyTrigger() {
  setupHourlyTrigger();
}

/** Первый запуск: sync + почасовой триггер (нужен YANDEX_METRIKA_TOKEN в Script Properties). */
function setupAll() {
  setupAndSync();
  setupHourlyTrigger();
}
