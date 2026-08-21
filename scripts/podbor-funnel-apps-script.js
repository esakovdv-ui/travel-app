/**
 * Google Apps Script для таблицы podbor funnel.
 * Листы: Воронка (визард + туры/отели) / Справочник
 *
 * Визард: недели строками. Туры и отели: показатели строками, недели колонками.
 */

const SHEET_FUNNEL = 'Воронка';
const SHEET_REF = 'Справочник';
const OBSOLETE = ['Визард', 'Туры', 'Отели', 'Лист1'];

const COUNTERS = { mgt: '90662828', wizard: '109401746', hotels: '97107007' };
const UTM_PODBOR = "ym:s:UTMSource=='podbor_wizard'";
const PODBOR_TOUR_MODULE = '68ea30c6';
const TOURS_FROM_PODBOR = "ym:pv:URL=@'" + PODBOR_TOUR_MODULE + "'";
const PODBOR_TOURS_REF_START = '2026-08-21';
const PODBOR_TOURS_ENTRY_REF = '(' + UTM_PODBOR + " OR ym:pv:URL=@'podbor_ref=1')";
const PODBOR_HOTELS_ENTRY = "(ym:s:UTMSource=='podbor_wizard' OR ym:pv:URL=@'podbor_ref=1')";
const HOTEL_LT_GOALS = {
  checkout: 579160037,
  paymentBlock: 579160036,
  purchase: 579160040,
};
const PODBOR_FUNNEL_START = '2026-08-13';

function toursFiltersForWeek_(weekFrom) {
  if (weekFrom >= PODBOR_TOURS_REF_START) {
    return {
      search: PODBOR_TOURS_ENTRY_REF,
      card: PODBOR_TOURS_ENTRY_REF + " AND ym:pv:URL=@'action=tourCard'",
      goals: PODBOR_TOURS_ENTRY_REF,
    };
  }
  return {
    search: TOURS_FROM_PODBOR + " AND ym:pv:URL=@'action=search' AND ym:pv:URL=@'dateFrom='",
    card: TOURS_FROM_PODBOR + " AND ym:pv:URL=@'action=tourCard'",
    goals: TOURS_FROM_PODBOR,
  };
}

const WIZARD_COLUMNS = [
  'Неделя', 'С', 'По', 'Клик баннер', 'Клик popup', 'Старт визарда',
  'CR → кто едет', 'Шаг: кто едет', 'CR → бюджет', 'Шаг: бюджет',
  'CR → формат', 'Шаг: формат', 'CR → регион', 'Шаг: регион',
  'CR → даты', 'Шаг: даты', 'CR → итог', 'Шаг: итог',
  'CR → handoff', 'Handoff', 'CR старт→handoff',
  'Handoff: туры', 'CR туры от handoff', 'Handoff: отели', 'CR отели от handoff',
];

const TOURS_LABELS = [
  'Handoff: туры', 'Выдача', 'CR handoff→выдача', 'Карточка', 'CR выдача→карточка',
  'Корзина', 'CR карточка→корзина', 'Бронь', 'CR корзина→бронь', 'Заявка', 'CR бронь→заявка',
];

const HOTELS_LABELS = [
  'Handoff: отели', 'Выдача', 'CR handoff→выдача', 'Корзина', 'CR выдача→корзина',
  'Чекаут', 'CR корзина→чекаут', 'Блок оплаты', 'CR чекаут→блок оплаты',
  'Оплата', 'CR блок оплаты→оплата',
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

function journeyCount_(counter, reportFrom, reportTo, entryIds, downstreamFilter) {
  if (!entryIds || !entryIds.length) return 0;
  var matched = {};
  for (var i = 0; i < entryIds.length; i += 10) {
    var chunk = entryIds.slice(i, i + 10);
    var orFilter = chunk.map(function (cid) { return "ym:s:clientID=='" + cid + "'"; }).join(' OR ');
    var path = '/stat/v1/data?id=' + counter + '&date1=' + reportFrom + '&date2=' + reportTo +
      '&metrics=ym:s:visits&dimensions=ym:s:clientID&limit=10000' +
      '&filters=' + encodeURIComponent('(' + orFilter + ') AND ' + downstreamFilter);
    (metrikaGet_(path).data || []).forEach(function (row) {
      if (row.dimensions[0] && row.dimensions[0].name) matched[row.dimensions[0].name] = true;
    });
  }
  return Object.keys(matched).length;
}

function hotelJourneyCount_(reportFrom, reportTo, downstreamFilter) {
  var entryFrom = PODBOR_FUNNEL_START > reportFrom ? PODBOR_FUNNEL_START : reportFrom;
  var ids = hotelEntryClients_(entryFrom, reportTo);
  return journeyCount_(COUNTERS.hotels, reportFrom, reportTo, ids, downstreamFilter);
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
  var tf = toursFiltersForWeek_(week.from);
  m.t_search = usersCount_(COUNTERS.mgt, week.from, week.to, tf.search);
  m.t_card = usersCount_(COUNTERS.mgt, week.from, week.to, tf.card);
  m.t_cart = goalUsers_(COUNTERS.mgt, 326738951, week.from, week.to, tf.goals);
  m.t_book = goalUsers_(COUNTERS.mgt, 321609998, week.from, week.to, tf.goals);
  m.t_pay = goalUsers_(COUNTERS.mgt, 321612203, week.from, week.to, tf.goals);
  m.h_search = hotelJourneyCount_(week.from, week.to, "ym:pv:URL=@'russia.mosgortur.ru/search'");
  m.h_cart = hotelJourneyCount_(week.from, week.to,
    "ym:pv:URL=@'russia.mosgortur.ru/packages/' AND ym:pv:URL!@'/success'");
  m.h_checkout = hotelJourneyCount_(week.from, week.to, 'ym:s:goal' + HOTEL_LT_GOALS.checkout + 'reaches>0');
  m.h_payment = hotelJourneyCount_(week.from, week.to, 'ym:s:goal' + HOTEL_LT_GOALS.paymentBlock + 'reaches>0');
  m.h_purchase = hotelJourneyCount_(week.from, week.to, 'ym:s:goal' + HOTEL_LT_GOALS.purchase + 'reaches>0');
  return m;
}

function toursValues_(m) {
  return [
    m.handoff_tours, m.t_search, pct_(m.t_search, m.handoff_tours),
    m.t_card, pct_(m.t_card, m.t_search), m.t_cart, pct_(m.t_cart, m.t_card),
    m.t_book, pct_(m.t_book, m.t_cart), m.t_pay, pct_(m.t_pay, m.t_book),
  ];
}

function hotelsValues_(m) {
  return [
    m.handoff_hotels, m.h_search, pct_(m.h_search, m.handoff_hotels),
    m.h_cart, pct_(m.h_cart, m.h_search), m.h_checkout, pct_(m.h_checkout, m.h_cart),
    m.h_payment, pct_(m.h_payment, m.h_checkout), m.h_purchase, pct_(m.h_purchase, m.h_payment),
  ];
}

function matrixBlock_(title, labels, weekLabels, weekValueRows) {
  var rows = [[title]];
  rows.push(['Показатель'].concat(weekLabels));
  for (var i = 0; i < labels.length; i++) {
    var row = [labels[i]];
    for (var w = 0; w < weekValueRows.length; w++) row.push(weekValueRows[w][i]);
    rows.push(row);
  }
  return rows;
}

function padRows_(rows) {
  var width = 0;
  rows.forEach(function (r) { if (r.length > width) width = r.length; });
  return rows.map(function (r) {
    while (r.length < width) r.push('');
    return r;
  });
}

function ensureSheets_(ss) {
  if (!ss.getSheetByName(SHEET_FUNNEL)) ss.insertSheet(SHEET_FUNNEL);
  if (!ss.getSheetByName(SHEET_REF)) ss.insertSheet(SHEET_REF);
  OBSOLETE.forEach(function (name) {
    var old = ss.getSheetByName(name);
    if (old && ss.getSheets().length > 1) ss.deleteSheet(old);
  });
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
    [COUNTERS.mgt, '321612203', 'Успешная оплата (имя в Метрике)', 'Туры: заявка'],
    [COUNTERS.hotels, String(HOTEL_LT_GOALS.purchase), 'lt_purchase', 'Отели: оплата'],
    ['Лист Воронка', 'Визард: недели строками; Туры/Отели: показатели×недели', '', ''],
    ['Старт учёта', PODBOR_FUNNEL_START, '', ''],
  ];
  sh.getRange(1, 1, rows.length, 4).setValues(rows);
}

function setupAndSync() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheets_(ss);
  setupReference_(ss);

  const weeks = buildWeeks_(8);
  const updated = Utilities.formatDate(new Date(), 'Europe/Moscow', 'dd.MM.yyyy HH:mm');
  const weekLabels = [];
  const wizardData = [];
  const toursCols = [];
  const hotelsCols = [];

  weeks.forEach(function (w) {
    const range = effectiveMetricsRange_(w);
    if (!range) return;
    const m = fetchWeek_(range);
    weekLabels.push(w.label);
    wizardData.push([
      w.label, w.from, w.to, m.banner, m.popup, m.start,
      pct_(m.people, m.start), m.people, pct_(m.budget, m.people), m.budget,
      pct_(m.format, m.budget), m.format, pct_(m.region, m.format), m.region,
      pct_(m.dates, m.region), m.dates, pct_(m.summary, m.dates), m.summary,
      pct_(m.handoff, m.summary), m.handoff, pct_(m.handoff, m.start),
      m.handoff_tours, pct_(m.handoff_tours, m.handoff),
      m.handoff_hotels, pct_(m.handoff_hotels, m.handoff),
    ]);
    toursCols.push(toursValues_(m));
    hotelsCols.push(hotelsValues_(m));
  });

  var values = [];
  values.push(['ВИЗАРД', 'Обновлено: ' + updated]);
  values.push(WIZARD_COLUMNS);
  wizardData.forEach(function (r) { values.push(r); });
  values.push([]);
  matrixBlock_('ТУРЫ', TOURS_LABELS, weekLabels, toursCols).forEach(function (r) { values.push(r); });
  values.push([]);
  matrixBlock_('ОТЕЛИ', HOTELS_LABELS, weekLabels, hotelsCols).forEach(function (r) { values.push(r); });

  values = padRows_(values);
  const sh = ss.getSheetByName(SHEET_FUNNEL);
  sh.clear();
  sh.getRange(1, 1, values.length, values[0].length).setValues(values);
  sh.setFrozenRows(2);
}

function setupHourlyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'setupAndSync') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('setupAndSync').timeBased().everyHours(1).create();
}

function setupWeeklyTrigger() {
  setupHourlyTrigger();
}

function setupAll() {
  setupAndSync();
  setupHourlyTrigger();
}
