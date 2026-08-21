#!/usr/bin/env node
/**
 * Sync podbor wizard funnel to Google Sheets.
 * One sheet «Воронка»: wizard (weeks as rows) + tours/hotels (metrics as rows, weeks as columns).
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';
import { loadEnvLocal } from './lib/load-env-local.mjs';
import {
  ensureMetrikaToken,
  queryBatchGoals,
  queryWeeklyGoalUsers,
  queryWeeklyGoals,
  queryPodborHotelEntryClients,
  queryWeeklyHotelPodborJourneyUsers,
  queryHotelPodborJourneyUserCount,
  queryWeeklyVisits,
  sleep,
} from './lib/metrika-reporting.mjs';
import {
  COUNTERS,
  ENTRY_GOALS,
  WIZARD_GOALS,
  POST_HANDOFF,
  REFERENCE_ROWS,
  PODBOR_HOTELS_ENTRY,
  PODBOR_TOURS_ENTRY,
  getFunnelStart,
  effectiveMetricsRange,
  filterReportWeeks,
  crBetween,
  WIZARD_SHEET_COLUMNS,
  TOURS_METRIC_ROWS,
  HOTELS_METRIC_ROWS,
  buildMetricWeekMatrix,
  SHEET_TAB_FUNNEL,
  SHEET_TAB_REF,
  SHEET_TABS_OBSOLETE,
} from './lib/podbor-funnel-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MSK = 'Europe/Moscow';
const DEFAULT_SHEET_ID = '1hgznwftwCCB9RRsLzVfm8jSKjAk8irZNruiIYBWgLMQ';

function parseArgs(argv) {
  let weeks = 8;
  let from = '';
  let to = '';
  let dryRun = false;
  let sheetId = process.env.PODBOR_SHEET_ID?.trim() || DEFAULT_SHEET_ID;

  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--weeks=')) weeks = Number(arg.slice('--weeks='.length)) || 8;
    else if (arg.startsWith('--from=')) from = arg.slice('--from='.length).trim();
    else if (arg.startsWith('--to=')) to = arg.slice('--to='.length).trim();
    else if (arg.startsWith('--sheet-id=')) sheetId = arg.slice('--sheet-id='.length).trim();
    else if (arg === '--dry-run') dryRun = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node scripts/sync-podbor-funnel-sheet.mjs [--weeks=8] [--from=YYYY-MM-DD --to=YYYY-MM-DD] [--dry-run]'
      );
      process.exit(0);
    }
  }
  return { weeks, from, to, dryRun, sheetId };
}

function mskDayKey(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MSK,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function addDays(dayKey, days) {
  const d = new Date(`${dayKey}T12:00:00+03:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return mskDayKey(d);
}

function weekStartMonday(dayKey) {
  const d = new Date(`${dayKey}T12:00:00+03:00`);
  const dow = d.getUTCDay();
  const toMonday = dow === 0 ? -6 : 1 - dow;
  return addDays(dayKey, toMonday);
}

function fmtWeekLabel(from, to) {
  return `${from.slice(8, 10)}.${from.slice(5, 7)} — ${to.slice(8, 10)}.${to.slice(5, 7)}.${to.slice(0, 4)}`;
}

function buildWeekRanges(endDay, count) {
  const weeks = [];
  let cursor = endDay;

  for (let i = 0; i < count; i += 1) {
    const from = weekStartMonday(cursor);
    const sunday = addDays(from, 6);
    const to = sunday > endDay ? endDay : sunday;
    weeks.unshift({ from, to, label: fmtWeekLabel(from, to) });
    cursor = addDays(from, -1);
  }
  return weeks;
}

const MGT_ENTRY_GOALS = [
  { key: 'banner', id: ENTRY_GOALS.banner_click.id },
  { key: 'popup', id: ENTRY_GOALS.popup_click.id },
];

async function fetchTourCohortMetrics(dateFrom, dateTo) {
  const counter = COUNTERS.mgt;
  // Выдача = заход с маркером (handoff сразу открывает search)
  const [tours_search, tours_tour_card] = await Promise.all([
    queryBatchGoals(counter, dateFrom, dateTo, [], ['ym:s:users'], POST_HANDOFF.tours_search.filter),
    queryBatchGoals(
      counter,
      dateFrom,
      dateTo,
      [],
      ['ym:s:users'],
      POST_HANDOFF.tours_tour_card.filter
    ),
  ]);
  await sleep(200);
  const tourGoals = await queryBatchGoals(
    counter,
    dateFrom,
    dateTo,
    [
      { key: 'tours_cart', id: POST_HANDOFF.tours_cart.goalId },
      { key: 'tours_booking', id: POST_HANDOFF.tours_booking.goalId },
      { key: 'tours_purchase', id: POST_HANDOFF.tours_purchase.goalId },
    ],
    [],
    PODBOR_TOURS_ENTRY
  );
  const searchUsers = tours_search._users ?? 0;
  return {
    tours_entry: searchUsers,
    tours_search: searchUsers,
    tours_tour_card: tours_tour_card._users ?? 0,
    tours_cart: tourGoals.tours_cart ?? 0,
    tours_booking: tourGoals.tours_booking ?? 0,
    tours_purchase: tourGoals.tours_purchase ?? 0,
  };
}

async function fetchHotelJourneyMetrics(dateFrom, dateTo, entryClients) {
  const counter = COUNTERS.hotels;
  const [hotels_search, hotels_package, hotels_checkout, hotels_payment_block, hotels_purchase] =
    await Promise.all([
      queryHotelPodborJourneyUserCount(
        counter,
        dateFrom,
        dateTo,
        entryClients,
        POST_HANDOFF.hotels_search.filter
      ),
      queryHotelPodborJourneyUserCount(
        counter,
        dateFrom,
        dateTo,
        entryClients,
        POST_HANDOFF.hotels_package.filter
      ),
      queryHotelPodborJourneyUserCount(
        counter,
        dateFrom,
        dateTo,
        entryClients,
        POST_HANDOFF.hotels_checkout.filter
      ),
      queryHotelPodborJourneyUserCount(
        counter,
        dateFrom,
        dateTo,
        entryClients,
        POST_HANDOFF.hotels_payment_block.filter
      ),
      queryHotelPodborJourneyUserCount(
        counter,
        dateFrom,
        dateTo,
        entryClients,
        POST_HANDOFF.hotels_purchase.filter
      ),
    ]);
  return {
    hotels_search,
    hotels_package,
    hotels_checkout,
    hotels_payment_block,
    hotels_purchase,
  };
}

async function fetchHotelEntryClients(rangeFrom, rangeTo, funnelStart) {
  const entryFrom = funnelStart > rangeFrom ? funnelStart : rangeFrom;
  return queryPodborHotelEntryClients(COUNTERS.hotels, entryFrom, rangeTo, PODBOR_HOTELS_ENTRY);
}

function pickWeek(map, weekFrom) {
  if (map.has(weekFrom)) return map.get(weekFrom) ?? {};
  return {};
}

function pickWeekValue(map, weekFrom) {
  return map.get(weekFrom) ?? 0;
}

async function fetchWeekMetrics(dateFrom, dateTo) {
  const funnelStart = getFunnelStart();
  const entryClients = await fetchHotelEntryClients(dateFrom, dateTo, funnelStart);
  await sleep(300);
  const entry = await queryBatchGoals(COUNTERS.mgt, dateFrom, dateTo, MGT_ENTRY_GOALS);
  await sleep(300);
  const wizard = await queryBatchGoals(COUNTERS.wizard, dateFrom, dateTo, WIZARD_GOALS);
  await sleep(300);
  const handoffTours = await queryBatchGoals(
    COUNTERS.wizard,
    dateFrom,
    dateTo,
    [{ id: POST_HANDOFF.handoff_tours.goalId, key: POST_HANDOFF.handoff_tours.key }],
    [],
    POST_HANDOFF.handoff_tours.filter
  );
  await sleep(300);
  const handoffHotels = await queryBatchGoals(
    COUNTERS.wizard,
    dateFrom,
    dateTo,
    [{ id: POST_HANDOFF.handoff_hotels.goalId, key: POST_HANDOFF.handoff_hotels.key }],
    [],
    POST_HANDOFF.handoff_hotels.filter
  );
  await sleep(300);
  const tourJourney = await fetchTourCohortMetrics(dateFrom, dateTo);
  await sleep(300);
  const hotelJourney = await fetchHotelJourneyMetrics(dateFrom, dateTo, entryClients);

  return {
    banner: entry.banner ?? 0,
    popup: entry.popup ?? 0,
    start: wizard.start ?? 0,
    people: wizard.people ?? 0,
    budget: wizard.budget ?? 0,
    format: wizard.format ?? 0,
    region: wizard.region ?? 0,
    dates: wizard.dates ?? 0,
    summary: wizard.summary ?? 0,
    handoff: wizard.handoff ?? 0,
    handoff_tours: handoffTours.handoff_tours ?? 0,
    handoff_hotels: handoffHotels.handoff_hotels ?? 0,
    tours_entry: tourJourney.tours_entry,
    tours_search: tourJourney.tours_search,
    tours_tour_card: tourJourney.tours_tour_card,
    tours_cart: tourJourney.tours_cart,
    tours_booking: tourJourney.tours_booking,
    tours_purchase: tourJourney.tours_purchase,
    hotels_search: hotelJourney.hotels_search,
    hotels_package: hotelJourney.hotels_package,
    hotels_checkout: hotelJourney.hotels_checkout,
    hotels_payment_block: hotelJourney.hotels_payment_block,
    hotels_purchase: hotelJourney.hotels_purchase,
  };
}

async function fetchAllWeeklyData(rangeFrom, rangeTo) {
  const funnelStart = getFunnelStart();
  const entryClients = await fetchHotelEntryClients(rangeFrom, rangeTo, funnelStart);
  await sleep(400);

  const entryWeeks = await queryWeeklyGoals(COUNTERS.mgt, rangeFrom, rangeTo, MGT_ENTRY_GOALS);
  await sleep(400);
  const wizardWeeks = await queryWeeklyGoals(COUNTERS.wizard, rangeFrom, rangeTo, WIZARD_GOALS);
  await sleep(400);
  const handoffToursWeeks = await queryWeeklyGoalUsers(
    COUNTERS.wizard,
    rangeFrom,
    rangeTo,
    POST_HANDOFF.handoff_tours.goalId,
    POST_HANDOFF.handoff_tours.filter
  );
  await sleep(400);
  const handoffHotelsWeeks = await queryWeeklyGoalUsers(
    COUNTERS.wizard,
    rangeFrom,
    rangeTo,
    POST_HANDOFF.handoff_hotels.goalId,
    POST_HANDOFF.handoff_hotels.filter
  );
  await sleep(400);
  console.log('  Tours cohort (podbor_ref/UTM)…');
  // Выдача = заход с маркером (handoff сразу открывает search). Без moduleId.
  const toursSearchWeeks = await queryWeeklyVisits(
    COUNTERS.mgt,
    rangeFrom,
    rangeTo,
    POST_HANDOFF.tours_search.filter,
    'ym:s:users'
  );
  const toursEntryWeeks = toursSearchWeeks;
  await sleep(300);
  const toursCardWeeks = await queryWeeklyVisits(
    COUNTERS.mgt,
    rangeFrom,
    rangeTo,
    POST_HANDOFF.tours_tour_card.filter,
    'ym:s:users'
  );
  await sleep(300);
  const tourGoalWeeks = await queryWeeklyGoals(
    COUNTERS.mgt,
    rangeFrom,
    rangeTo,
    [
      { key: 'tours_cart', id: POST_HANDOFF.tours_cart.goalId },
      { key: 'tours_booking', id: POST_HANDOFF.tours_booking.goalId },
      { key: 'tours_purchase', id: POST_HANDOFF.tours_purchase.goalId },
    ],
    PODBOR_TOURS_ENTRY
  );
  const toursCartWeeks = new Map(
    [...tourGoalWeeks].map(([w, m]) => [w, m.tours_cart ?? 0])
  );
  const toursBookingWeeks = new Map(
    [...tourGoalWeeks].map(([w, m]) => [w, m.tours_booking ?? 0])
  );
  const toursPurchaseWeeks = new Map(
    [...tourGoalWeeks].map(([w, m]) => [w, m.tours_purchase ?? 0])
  );
  await sleep(400);
  console.log('  Hotels journey (clientID)…');
  const hotelsSearchWeeks = await queryWeeklyHotelPodborJourneyUsers(
    COUNTERS.hotels,
    rangeFrom,
    rangeTo,
    entryClients,
    POST_HANDOFF.hotels_search.filter
  );
  await sleep(400);
  const hotelsPackageWeeks = await queryWeeklyHotelPodborJourneyUsers(
    COUNTERS.hotels,
    rangeFrom,
    rangeTo,
    entryClients,
    POST_HANDOFF.hotels_package.filter
  );
  await sleep(400);
  const hotelsCheckoutWeeks = await queryWeeklyHotelPodborJourneyUsers(
    COUNTERS.hotels,
    rangeFrom,
    rangeTo,
    entryClients,
    POST_HANDOFF.hotels_checkout.filter
  );
  await sleep(400);
  const hotelsPaymentBlockWeeks = await queryWeeklyHotelPodborJourneyUsers(
    COUNTERS.hotels,
    rangeFrom,
    rangeTo,
    entryClients,
    POST_HANDOFF.hotels_payment_block.filter
  );
  await sleep(400);
  const hotelsPurchaseWeeks = await queryWeeklyHotelPodborJourneyUsers(
    COUNTERS.hotels,
    rangeFrom,
    rangeTo,
    entryClients,
    POST_HANDOFF.hotels_purchase.filter
  );

  return {
    entryWeeks,
    wizardWeeks,
    handoffToursWeeks,
    handoffHotelsWeeks,
    toursEntryWeeks,
    toursSearchWeeks,
    toursCardWeeks,
    toursCartWeeks,
    toursBookingWeeks,
    toursPurchaseWeeks,
    hotelsSearchWeeks,
    hotelsPackageWeeks,
    hotelsCheckoutWeeks,
    hotelsPaymentBlockWeeks,
    hotelsPurchaseWeeks,
  };
}

function metricsFromWeeklyData(week, data) {
  const entry = pickWeek(data.entryWeeks, week.from);
  const wizard = pickWeek(data.wizardWeeks, week.from);

  return {
    banner: entry.banner ?? 0,
    popup: entry.popup ?? 0,
    start: wizard.start ?? 0,
    people: wizard.people ?? 0,
    budget: wizard.budget ?? 0,
    format: wizard.format ?? 0,
    region: wizard.region ?? 0,
    dates: wizard.dates ?? 0,
    summary: wizard.summary ?? 0,
    handoff: wizard.handoff ?? 0,
    handoff_tours: pickWeekValue(data.handoffToursWeeks, week.from),
    handoff_hotels: pickWeekValue(data.handoffHotelsWeeks, week.from),
    tours_entry: pickWeekValue(data.toursEntryWeeks, week.from),
    tours_search: pickWeekValue(data.toursSearchWeeks, week.from),
    tours_tour_card: pickWeekValue(data.toursCardWeeks, week.from),
    tours_cart: pickWeekValue(data.toursCartWeeks, week.from),
    tours_booking: pickWeekValue(data.toursBookingWeeks, week.from),
    tours_purchase: pickWeekValue(data.toursPurchaseWeeks, week.from),
    hotels_search: pickWeekValue(data.hotelsSearchWeeks, week.from),
    hotels_package: pickWeekValue(data.hotelsPackageWeeks, week.from),
    hotels_checkout: pickWeekValue(data.hotelsCheckoutWeeks, week.from),
    hotels_payment_block: pickWeekValue(data.hotelsPaymentBlockWeeks, week.from),
    hotels_purchase: pickWeekValue(data.hotelsPurchaseWeeks, week.from),
  };
}

function rowWizard(week, m) {
  return [
    week.label,
    week.from,
    week.to,
    m.banner,
    m.popup,
    m.start,
    crBetween(m.people, m.start),
    m.people,
    crBetween(m.budget, m.people),
    m.budget,
    crBetween(m.format, m.budget),
    m.format,
    crBetween(m.region, m.format),
    m.region,
    crBetween(m.dates, m.region),
    m.dates,
    crBetween(m.summary, m.dates),
    m.summary,
    crBetween(m.handoff, m.summary),
    m.handoff,
    crBetween(m.handoff, m.start),
    m.handoff_tours,
    crBetween(m.handoff_tours, m.handoff),
    m.handoff_hotels,
    crBetween(m.handoff_hotels, m.handoff),
  ];
}

/** Один лист: визард (недели×шаги) + туры/отели (показатели×недели). */
function buildFunnelSheetValues(weeks, metricsByWeek, updatedAt) {
  const weekLabels = weeks.map((w) => w.label);
  const metricsList = weeks.map((w) => metricsByWeek.get(w.from));

  const values = [];
  values.push(['ВИЗАРД', `Обновлено: ${updatedAt}`]);
  values.push(WIZARD_SHEET_COLUMNS);
  for (const week of weeks) {
    values.push(rowWizard(week, metricsByWeek.get(week.from)));
  }

  values.push([]);
  values.push(['ТУРЫ']);
  values.push(...buildMetricWeekMatrix(TOURS_METRIC_ROWS, metricsList, weekLabels));

  values.push([]);
  values.push(['ОТЕЛИ']);
  values.push(...buildMetricWeekMatrix(HOTELS_METRIC_ROWS, metricsList, weekLabels));

  return values;
}

function loadGoogleCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  if (raw.startsWith('{')) return JSON.parse(raw);
  const filePath = path.isAbsolute(raw) ? raw : path.join(ROOT, raw);
  if (!fs.existsSync(filePath)) {
    throw new Error(`GOOGLE_SERVICE_ACCOUNT_JSON: файл не найден: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function getSheetsClient() {
  const credentials = loadGoogleCredentials();
  if (!credentials) return null;

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function ensureSheetTabs(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetsMeta = meta.data.sheets ?? [];
  const titles = new Set(sheetsMeta.map((s) => s.properties?.title));

  const requests = [];
  for (const title of [SHEET_TAB_FUNNEL, SHEET_TAB_REF]) {
    if (!titles.has(title)) {
      requests.push({ addSheet: { properties: { title } } });
    }
  }
  for (const drop of SHEET_TABS_OBSOLETE) {
    if (titles.has(drop) && drop !== SHEET_TAB_FUNNEL) {
      const sheetId = sheetsMeta.find((s) => s.properties?.title === drop)?.properties?.sheetId;
      if (sheetId != null) {
        requests.push({ deleteSheet: { sheetId } });
      }
    }
  }
  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  }
}

function padRowsToWidth(rows) {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  return rows.map((row) => {
    if (row.length >= width) return row;
    return [...row, ...Array(width - row.length).fill('')];
  });
}

async function writeToGoogleSheet(spreadsheetId, funnelValues, referenceRows) {
  const sheets = await getSheetsClient();
  if (!sheets) return false;

  await ensureSheetTabs(sheets, spreadsheetId);

  const padded = padRowsToWidth(funnelValues);
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${SHEET_TAB_FUNNEL}!A:ZZ`,
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_TAB_FUNNEL}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: padded },
  });

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${SHEET_TAB_REF}!A:ZZ`,
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_TAB_REF}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: referenceRows },
  });

  return true;
}

async function main() {
  loadEnvLocal(ROOT);
  ensureMetrikaToken();
  const { weeks, from, to, dryRun, sheetId } = parseArgs(process.argv);

  const endDay = to || mskDayKey(new Date());
  const weekRanges = from
    ? [{ from, to: to || endDay, label: fmtWeekLabel(from, to || endDay) }]
    : buildWeekRanges(endDay, weeks);

  const funnelStart = getFunnelStart();
  const reportWeeks = filterReportWeeks(weekRanges, funnelStart);

  console.log(
    `Podbor funnel sync: ${reportWeeks.length}/${weekRanges.length} week(s) in report, учёт с ${funnelStart}`
  );

  const updatedAt = new Intl.DateTimeFormat('ru-RU', {
    timeZone: MSK,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date());

  const metricsByWeek = new Map();

  if (reportWeeks.length === 0) {
    console.log('  (нет недель на/после старта учёта)');
  } else {
    const rangeFrom = reportWeeks[0].from;
    const rangeTo = reportWeeks[reportWeeks.length - 1].to;

    console.log(`  Metrika: ${rangeFrom} — ${rangeTo}`);
    console.log('Fetching Metrika…');
    const weeklyData = await fetchAllWeeklyData(rangeFrom, rangeTo);
    await sleep(300);

    for (const week of reportWeeks) {
      const metricsRange = effectiveMetricsRange(week, funnelStart);
      let metrics;
      if (metricsRange.from === week.from && metricsRange.to === week.to) {
        metrics = metricsFromWeeklyData(week, weeklyData);
      } else {
        metrics = await fetchWeekMetrics(metricsRange.from, metricsRange.to);
      }
      metricsByWeek.set(week.from, metrics);
      console.log(
        `  ${week.label}: handoff=${metrics.handoff} tours=${metrics.handoff_tours} hotels=${metrics.handoff_hotels}`
      );
    }
  }

  const funnelValues =
    reportWeeks.length === 0
      ? [['ВИЗАРД', `Обновлено: ${updatedAt}`], WIZARD_SHEET_COLUMNS]
      : buildFunnelSheetValues(reportWeeks, metricsByWeek, updatedAt);

  if (dryRun) {
    console.log('\n--- dry-run ---');
    for (const row of funnelValues) console.log(row.join('\t'));
    return;
  }

  const written = await writeToGoogleSheet(sheetId, funnelValues, REFERENCE_ROWS);
  if (written) {
    console.log(`\nГотово: https://docs.google.com/spreadsheets/d/${sheetId}/edit`);
    return;
  }

  const outDir = path.join(ROOT, 'storage');
  fs.mkdirSync(outDir, { recursive: true });
  const tsv = padRowsToWidth(funnelValues)
    .map((r) => r.join('\t'))
    .join('\n');
  fs.writeFileSync(path.join(outDir, 'podbor-funnel-export.tsv'), tsv, 'utf8');

  spawnSync(process.execPath, ['scripts/generate-podbor-import-embedded.mjs'], {
    cwd: ROOT,
    stdio: 'ignore',
  });

  console.log('\nGoogle credentials не заданы (GOOGLE_SERVICE_ACCOUNT_JSON).');
  console.log(`TSV: ${outDir}/podbor-funnel-export.tsv`);
  console.log('Live sync: scripts/podbor-funnel-apps-script.js → setupAndSync + YANDEX_METRIKA_TOKEN');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
