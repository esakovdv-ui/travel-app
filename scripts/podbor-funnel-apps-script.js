/**
 * Google Apps Script для таблицы podbor funnel.
 * Вставить: Extensions → Apps Script → вставить этот файл → Run setupAndSync
 *
 * Script Properties (Project settings → Script properties):
 *   YANDEX_METRIKA_TOKEN — OAuth-токен Яндекс.Метрики
 *
 * Триггер (опционально): setupWeeklyTrigger — каждый понедельник 09:00 МСK
 */

const SHEET_FUNNEL = 'Воронка';
const SHEET_REF = 'Справочник';

const COUNTERS = { mgt: '90662828', wizard: '109401746', hotels: '97107007' };
const UTM_PODBOR = "ym:s:UTMSource=='podbor_wizard'";
/** Учёт с этой даты (МСK). Тестовые прохождения до неё — нули. */
const PODBOR_FUNNEL_START = '2026-08-13';

const COLUMNS = [
  'Неделя', 'С', 'По', 'Клик баннер', 'Клик popup', 'Старт визарда',
  'Шаг: кто едет', 'Шаг: бюджет', 'Шаг: формат', 'Шаг: регион', 'Шаг: даты', 'Шаг: итог',
  'Handoff', 'Handoff: туры', 'Handoff: отели', 'CR старт→handoff', 'UTM визиты', 'Туры: выдача', 'Туры: карточка',
  'Туры: корзина', 'Туры: бронь', 'Туры: оплата', 'Отели: выдача', 'Отели: корзина',
  'Отели: чекаут', 'Отели: покупка', 'Обновлено',
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

function goalReaches_(counter, goalId, d1, d2, filter) {
  let path = '/stat/v1/data?id=' + counter + '&date1=' + d1 + '&date2=' + d2 +
    '&metrics=ym:s:goal' + goalId + 'reaches';
  if (filter) path += '&filters=' + encodeURIComponent(filter);
  return metrikaGet_(path).totals[0] || 0;
}

function usersVisits_(counter, d1, d2, filter) {
  let path = '/stat/v1/data?id=' + counter + '&date1=' + d1 + '&date2=' + d2 +
    '&metrics=ym:s:visits';
  if (filter) path += '&filters=' + encodeURIComponent(filter);
  return metrikaGet_(path).totals[0] || 0;
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

function emptyMetrics_() {
  return {
    banner: 0, popup: 0, start: 0, people: 0, budget: 0, format: 0, region: 0,
    dates: 0, summary: 0, handoff: 0, cr: '', utm: 0, t_search: 0, t_card: 0,
    t_cart: 0, t_book: 0, t_pay: 0, h_search: 0, h_cart: 0, h_checkout: 0, h_purchase: 0,
  };
}

function fetchWeek_(week) {
  const m = {};
  m.banner = goalReaches_(COUNTERS.mgt, 595574818, week.from, week.to);
  m.popup = goalReaches_(COUNTERS.mgt, 595574819, week.from, week.to);
  WIZARD_GOALS.forEach(function (g) {
    m[g.key] = goalReaches_(COUNTERS.wizard, g.id, week.from, week.to);
  });
  m.handoff_tours = goalReaches_(COUNTERS.wizard, 595566515, week.from, week.to, "ym:s:paramsLevel2=='tour'");
  m.handoff_hotels = goalReaches_(COUNTERS.wizard, 595566515, week.from, week.to, "ym:s:paramsLevel2=='hotel'");
  m.cr = pct_(m.handoff, m.start);
  m.utm = usersVisits_(COUNTERS.mgt, week.from, week.to, UTM_PODBOR);
  m.t_search = usersVisits_(COUNTERS.mgt, week.from, week.to,
    UTM_PODBOR + " AND ym:pv:URL=@'online.mosgortur.ru/tours' AND ym:pv:URL=@'action=search'");
  m.t_card = usersVisits_(COUNTERS.mgt, week.from, week.to,
    UTM_PODBOR + " AND ym:pv:URL=@'online.mosgortur.ru/tours' AND ym:pv:URL=@'action=tourCard'");
  m.t_cart = goalReaches_(COUNTERS.mgt, 328431134, week.from, week.to, UTM_PODBOR);
  m.t_book = goalReaches_(COUNTERS.mgt, 328431171, week.from, week.to, UTM_PODBOR);
  m.t_pay = goalReaches_(COUNTERS.mgt, 321612203, week.from, week.to, UTM_PODBOR);
  m.h_search = usersVisits_(COUNTERS.hotels, week.from, week.to,
    UTM_PODBOR + " AND ym:pv:URL=@'russia.mosgortur.ru/search'");
  m.h_cart = usersVisits_(COUNTERS.hotels, week.from, week.to,
    UTM_PODBOR + " AND ym:pv:URL=@'russia.mosgortur.ru/packages/' AND ym:pv:URL!@'/success'");
  m.h_checkout = goalReaches_(COUNTERS.hotels, 579160037, week.from, week.to,
    UTM_PODBOR + " AND ym:pv:URL=@'russia.mosgortur.ru'");
  m.h_purchase = goalReaches_(COUNTERS.hotels, 579160040, week.from, week.to,
    UTM_PODBOR + " AND ym:pv:URL=@'russia.mosgortur.ru'");
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
    [COUNTERS.mgt, '328431134', 'Корзина тур', 'UTM podbor_wizard'],
    [COUNTERS.mgt, '321612203', 'Успешная оплата', 'UTM podbor_wizard'],
    [COUNTERS.hotels, '579160040', 'lt_purchase', 'Отели + UTM'],
    ['', '', '', ''],
    ['UTM фильтр', UTM_PODBOR, '', 'Прокси-воронка без join счётчиков'],
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
      m.t_cart, m.t_book, m.t_pay, m.h_search, m.h_cart, m.h_checkout, m.h_purchase, updated,
    ]);
  });

  const sh = ss.getSheetByName(SHEET_FUNNEL);
  sh.clear();
  sh.getRange(1, 1, rows.length, COLUMNS.length).setValues(rows);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, COLUMNS.length);
}

function setupWeeklyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'setupAndSync') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('setupAndSync')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9)
    .inTimezone('Europe/Moscow')
    .create();
}

/** Первый запуск: sync + еженедельный триггер (нужен YANDEX_METRIKA_TOKEN в Script Properties). */
function setupAll() {
  setupAndSync();
  setupWeeklyTrigger();
}
