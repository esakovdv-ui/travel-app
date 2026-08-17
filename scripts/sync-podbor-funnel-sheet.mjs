#!/usr/bin/env node
/**
 * Sync podbor wizard funnel to Google Sheets.
 *
 * Usage:
 *   node scripts/sync-podbor-funnel-sheet.mjs
 *   node scripts/sync-podbor-funnel-sheet.mjs --weeks=8
 *   node scripts/sync-podbor-funnel-sheet.mjs --from=2026-08-04 --to=2026-08-12
 *   node scripts/sync-podbor-funnel-sheet.mjs --dry-run
 *
 * Env (.env.local):
 *   YANDEX_METRIKA_TOKEN or YANDEX_API_KEY
 *   PODBOR_SHEET_ID (default: 1hgznwftwCCB9RRsLzVfm8jSKjAk8irZNruiIYBWgLMQ)
 *   GOOGLE_SERVICE_ACCOUNT_JSON — path to JSON key OR inline JSON string
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
  queryWeeklyGoals,
  queryWeeklyVisits,
  sleep,
} from './lib/metrika-reporting.mjs';
import {
  COUNTERS,
  ENTRY_GOALS,
  WIZARD_GOALS,
  POST_HANDOFF,
  SHEET_COLUMNS,
  REFERENCE_ROWS,
  getFunnelStart,
  effectiveMetricsRange,
  filterReportWeeks,
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

function pct(num, den) {
  if (!den || !num) return '';
  return `${((num / den) * 100).toFixed(1).replace('.', ',')}%`;
}

const MGT_ENTRY_GOALS = [
  { key: 'banner', id: ENTRY_GOALS.banner_click.id },
  { key: 'popup', id: ENTRY_GOALS.popup_click.id },
];

const MGT_TOUR_GOALS = [
  { key: 'tours_cart', id: POST_HANDOFF.tours_cart.goalId },
  { key: 'tours_booking', id: POST_HANDOFF.tours_booking.goalId },
  { key: 'tours_purchase', id: POST_HANDOFF.tours_purchase.goalId },
];

const HOTEL_GOALS = [
  { key: 'hotels_checkout', id: POST_HANDOFF.hotels_checkout.goalId },
  { key: 'hotels_purchase', id: POST_HANDOFF.hotels_purchase.goalId },
];

function pickWeek(map, weekFrom) {
  if (map.has(weekFrom)) return map.get(weekFrom) ?? {};
  return {};
}

function pickVisits(map, weekFrom) {
  return map.get(weekFrom) ?? 0;
}

async function fetchWeekMetrics(dateFrom, dateTo) {
  const entry = await queryBatchGoals(COUNTERS.mgt, dateFrom, dateTo, MGT_ENTRY_GOALS);
  await sleep(300);
  const wizard = await queryBatchGoals(COUNTERS.wizard, dateFrom, dateTo, WIZARD_GOALS);
  await sleep(300);
  const utm = await queryBatchGoals(
    COUNTERS.mgt,
    dateFrom,
    dateTo,
    [],
    ['ym:s:visits'],
    POST_HANDOFF.utm_visits.filter
  );
  await sleep(300);
  const toursSearch = await queryBatchGoals(
    COUNTERS.mgt,
    dateFrom,
    dateTo,
    [],
    ['ym:s:visits'],
    POST_HANDOFF.tours_search.filter
  );
  await sleep(300);
  const toursCard = await queryBatchGoals(
    COUNTERS.mgt,
    dateFrom,
    dateTo,
    [],
    ['ym:s:visits'],
    POST_HANDOFF.tours_tour_card.filter
  );
  await sleep(300);
  const tourGoals = await queryBatchGoals(
    COUNTERS.mgt,
    dateFrom,
    dateTo,
    MGT_TOUR_GOALS,
    [],
    POST_HANDOFF.tours_cart.filter
  );
  await sleep(300);
  const hotelsSearch = await queryBatchGoals(
    COUNTERS.hotels,
    dateFrom,
    dateTo,
    [],
    ['ym:s:visits'],
    POST_HANDOFF.hotels_search.filter
  );
  await sleep(300);
  const hotelsPackage = await queryBatchGoals(
    COUNTERS.hotels,
    dateFrom,
    dateTo,
    [],
    ['ym:s:visits'],
    POST_HANDOFF.hotels_package.filter
  );
  await sleep(300);
  const hotelGoals = await queryBatchGoals(
    COUNTERS.hotels,
    dateFrom,
    dateTo,
    HOTEL_GOALS,
    [],
    POST_HANDOFF.hotels_checkout.filter
  );

  const metrics = {
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
    utm_visits: utm._visits ?? 0,
    tours_search: toursSearch._visits ?? 0,
    tours_tour_card: toursCard._visits ?? 0,
    hotels_search: hotelsSearch._visits ?? 0,
    hotels_package: hotelsPackage._visits ?? 0,
    tours_cart: tourGoals.tours_cart ?? 0,
    tours_booking: tourGoals.tours_booking ?? 0,
    tours_purchase: tourGoals.tours_purchase ?? 0,
    hotels_checkout: hotelGoals.hotels_checkout ?? 0,
    hotels_purchase: hotelGoals.hotels_purchase ?? 0,
  };
  metrics.cr_start_handoff = pct(metrics.handoff, metrics.start);
  return metrics;
}

async function fetchAllWeeklyData(rangeFrom, rangeTo) {
  const entryWeeks = await queryWeeklyGoals(COUNTERS.mgt, rangeFrom, rangeTo, MGT_ENTRY_GOALS);
  await sleep(400);
  const wizardWeeks = await queryWeeklyGoals(COUNTERS.wizard, rangeFrom, rangeTo, WIZARD_GOALS);
  await sleep(400);
  const utmWeeks = await queryWeeklyVisits(COUNTERS.mgt, rangeFrom, rangeTo, POST_HANDOFF.utm_visits.filter);
  await sleep(400);
  const toursSearchWeeks = await queryWeeklyVisits(COUNTERS.mgt, rangeFrom, rangeTo, POST_HANDOFF.tours_search.filter);
  await sleep(400);
  const toursCardWeeks = await queryWeeklyVisits(COUNTERS.mgt, rangeFrom, rangeTo, POST_HANDOFF.tours_tour_card.filter);
  await sleep(400);
  const tourGoalWeeks = await queryWeeklyGoals(
    COUNTERS.mgt,
    rangeFrom,
    rangeTo,
    MGT_TOUR_GOALS,
    POST_HANDOFF.tours_cart.filter
  );
  await sleep(400);
  const hotelsSearchWeeks = await queryWeeklyVisits(
    COUNTERS.hotels,
    rangeFrom,
    rangeTo,
    POST_HANDOFF.hotels_search.filter
  );
  await sleep(400);
  const hotelsPackageWeeks = await queryWeeklyVisits(
    COUNTERS.hotels,
    rangeFrom,
    rangeTo,
    POST_HANDOFF.hotels_package.filter
  );
  await sleep(400);
  const hotelGoalWeeks = await queryWeeklyGoals(
    COUNTERS.hotels,
    rangeFrom,
    rangeTo,
    HOTEL_GOALS,
    POST_HANDOFF.hotels_checkout.filter
  );

  return {
    entryWeeks,
    wizardWeeks,
    utmWeeks,
    toursSearchWeeks,
    toursCardWeeks,
    tourGoalWeeks,
    hotelsSearchWeeks,
    hotelsPackageWeeks,
    hotelGoalWeeks,
  };
}

function buildWeekRow(week, data, updatedAt) {
  const entry = pickWeek(data.entryWeeks, week.from);
  const wizard = pickWeek(data.wizardWeeks, week.from);
  const tourGoals = pickWeek(data.tourGoalWeeks, week.from);
  const hotelGoals = pickWeek(data.hotelGoalWeeks, week.from);

  const metrics = {
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
    utm_visits: pickVisits(data.utmWeeks, week.from),
    tours_search: pickVisits(data.toursSearchWeeks, week.from),
    tours_tour_card: pickVisits(data.toursCardWeeks, week.from),
    hotels_search: pickVisits(data.hotelsSearchWeeks, week.from),
    hotels_package: pickVisits(data.hotelsPackageWeeks, week.from),
    tours_cart: tourGoals.tours_cart ?? 0,
    tours_booking: tourGoals.tours_booking ?? 0,
    tours_purchase: tourGoals.tours_purchase ?? 0,
    hotels_checkout: hotelGoals.hotels_checkout ?? 0,
    hotels_purchase: hotelGoals.hotels_purchase ?? 0,
  };
  metrics.cr_start_handoff = pct(metrics.handoff, metrics.start);
  return rowToSheetValues(week, metrics, updatedAt);
}

function rowToSheetValues(week, metrics, updatedAt) {
  return [
    week.label,
    week.from,
    week.to,
    metrics.banner,
    metrics.popup,
    metrics.start,
    metrics.people,
    metrics.budget,
    metrics.format,
    metrics.region,
    metrics.dates,
    metrics.summary,
    metrics.handoff,
    metrics.cr_start_handoff,
    metrics.utm_visits,
    metrics.tours_search,
    metrics.tours_tour_card,
    metrics.tours_cart,
    metrics.tours_booking,
    metrics.tours_purchase,
    metrics.hotels_search,
    metrics.hotels_package,
    metrics.hotels_checkout,
    metrics.hotels_purchase,
    updatedAt,
  ];
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
  const titles = new Set((meta.data.sheets ?? []).map((s) => s.properties?.title));

  const requests = [];
  if (!titles.has('Воронка')) {
    requests.push({ addSheet: { properties: { title: 'Воронка' } } });
  }
  if (!titles.has('Справочник')) {
    requests.push({ addSheet: { properties: { title: 'Справочник' } } });
  }
  if (titles.has('Лист1')) {
    const sheetId = meta.data.sheets?.find((s) => s.properties?.title === 'Лист1')?.properties?.sheetId;
    if (sheetId != null) {
      requests.push({ deleteSheet: { sheetId } });
    }
  }
  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  }
}

async function writeToGoogleSheet(spreadsheetId, headerRow, dataRows, referenceRows) {
  const sheets = await getSheetsClient();
  if (!sheets) return false;

  await ensureSheetTabs(sheets, spreadsheetId);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Воронка!A1',
    valueInputOption: 'RAW',
    requestBody: { values: [headerRow, ...dataRows] },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Справочник!A1',
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

  const dataRows = [];
  if (reportWeeks.length === 0) {
    console.log('  (нет недель на/после старта учёта — только заголовок)');
  } else {
    const rangeFrom = reportWeeks[0].from;
    const rangeTo = reportWeeks[reportWeeks.length - 1].to;

    console.log(`  Metrika: ${rangeFrom} — ${rangeTo}`);
    console.log('Fetching Metrika (9 API calls)…');
    const weeklyData = await fetchAllWeeklyData(rangeFrom, rangeTo);
    await sleep(300);

    for (const week of reportWeeks) {
      const metricsRange = effectiveMetricsRange(week, funnelStart);
      let row;
      if (metricsRange.from === week.from && metricsRange.to === week.to) {
        row = buildWeekRow(week, weeklyData, updatedAt);
      } else {
        const metrics = await fetchWeekMetrics(metricsRange.from, metricsRange.to);
        row = rowToSheetValues(week, metrics, updatedAt);
      }
      console.log(`  ${week.label}: handoff=${row[12]}, utm=${row[14]}`);
      dataRows.push(row);
    }
  }

  if (dryRun) {
    console.log('\n--- dry-run ---');
    console.log(SHEET_COLUMNS.join('\t'));
    for (const row of dataRows) console.log(row.join('\t'));
    return;
  }

  const written = await writeToGoogleSheet(sheetId, SHEET_COLUMNS, dataRows, REFERENCE_ROWS);
  if (written) {
    console.log(`\nГотово: https://docs.google.com/spreadsheets/d/${sheetId}/edit`);
    return;
  }

  const outPath = path.join(ROOT, 'storage/podbor-funnel-export.tsv');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const tsv = [SHEET_COLUMNS.join('\t'), ...dataRows.map((r) => r.join('\t'))].join('\n');
  fs.writeFileSync(outPath, tsv, 'utf8');

  const embeddedPath = path.join(ROOT, 'storage/podbor-import-embedded.gs');
  spawnSync(process.execPath, ['scripts/generate-podbor-import-embedded.mjs'], {
    cwd: ROOT,
    stdio: 'ignore',
  });

  console.log('\nGoogle credentials не заданы (GOOGLE_SERVICE_ACCOUNT_JSON).');
  console.log(`TSV: ${outPath}`);
  console.log(`Apps Script (разовый импорт): ${embeddedPath} → importEmbeddedFunnelData()`);
  console.log('Live sync: scripts/podbor-funnel-apps-script.js → setupAndSync + YANDEX_METRIKA_TOKEN');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
