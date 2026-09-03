#!/usr/bin/env node
/**
 * Sync staff.motrip.ru funnel to Google Sheets.
 * Sheets: Воронка (totals) · По неделям (users) · Справочник
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';
import { loadEnvLocal } from './lib/load-env-local.mjs';
import { fetchStaffBitrixLeadsByWeek } from './lib/staff-bitrix-funnel.mjs';
import {
  ensureMetrikaToken,
  queryBatchGoalStats,
  queryUsersVisits,
  queryWeeklyGoalStats,
  queryWeeklyUsersVisits,
  sleep,
} from './lib/metrika-reporting.mjs';
import {
  STAFF_COUNTER,
  STAFF_GOALS,
  STAFF_START_URL_FILTER,
  SHEET_TAB_FUNNEL,
  SHEET_TAB_WEEKS,
  SHEET_TAB_REF,
  FUNNEL_COLUMNS,
  WEEKLY_STAGE_ROWS,
  REFERENCE_ROWS,
  getFunnelStart,
  filterReportWeeks,
  effectiveMetricsRange,
  crBetween,
} from './lib/staff-funnel-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MSK = 'Europe/Moscow';
/** Заполняется после первого создания таблицы. */
const DEFAULT_SHEET_ID = '';

function parseArgs(argv) {
  let weeks = 8;
  let from = '';
  let to = '';
  let dryRun = false;
  let createSheet = false;
  let sheetId = process.env.STAFF_SHEET_ID?.trim() || DEFAULT_SHEET_ID;
  let shareEmail = process.env.STAFF_SHEET_SHARE_EMAIL?.trim() || '';

  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--weeks=')) weeks = Number(arg.slice('--weeks='.length)) || 8;
    else if (arg.startsWith('--from=')) from = arg.slice('--from='.length).trim();
    else if (arg.startsWith('--to=')) to = arg.slice('--to='.length).trim();
    else if (arg.startsWith('--sheet-id=')) sheetId = arg.slice('--sheet-id='.length).trim();
    else if (arg.startsWith('--share=')) shareEmail = arg.slice('--share='.length).trim();
    else if (arg === '--dry-run') dryRun = true;
    else if (arg === '--create') createSheet = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node scripts/sync-staff-funnel-sheet.mjs [--weeks=8] [--from=YYYY-MM-DD --to=YYYY-MM-DD] [--sheet-id=ID] [--share=email] [--create] [--dry-run]'
      );
      process.exit(0);
    }
  }
  return { weeks, from, to, dryRun, createSheet, sheetId, shareEmail };
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

function emptyGoalStats() {
  return { users: 0, visits: 0, reaches: 0 };
}

function emptyMetrics() {
  const out = {
    visit_users: 0,
    visit_visits: 0,
    bitrix: 0,
  };
  for (const g of STAFF_GOALS) out[g.key] = emptyGoalStats();
  return out;
}

function pickWeekGoals(map, weekFrom) {
  return map.get(weekFrom) ?? {};
}

async function fetchPeriodMetrics(dateFrom, dateTo) {
  const visit = await queryUsersVisits(STAFF_COUNTER, dateFrom, dateTo, STAFF_START_URL_FILTER);
  await sleep(300);
  const goals = await queryBatchGoalStats(STAFF_COUNTER, dateFrom, dateTo, STAFF_GOALS);
  const metrics = emptyMetrics();
  metrics.visit_users = visit.users ?? 0;
  metrics.visit_visits = visit.visits ?? 0;
  for (const g of STAFF_GOALS) {
    metrics[g.key] = goals[g.key] ?? emptyGoalStats();
  }
  return metrics;
}

function metricsFromWeeklyData(week, weeklyVisits, weeklyGoals, bitrixByWeek) {
  const visit = weeklyVisits.get(week.from) ?? { users: 0, visits: 0 };
  const goals = pickWeekGoals(weeklyGoals, week.from);
  const metrics = emptyMetrics();
  metrics.visit_users = visit.users ?? 0;
  metrics.visit_visits = visit.visits ?? 0;
  for (const g of STAFF_GOALS) {
    metrics[g.key] = goals[g.key] ?? emptyGoalStats();
  }
  metrics.bitrix = bitrixByWeek.get(week.from) ?? 0;
  return metrics;
}

function weeklyUsersForRow(row, m) {
  if (row.key === 'visit') return m.visit_users;
  if (row.key === 'bitrix') return m.bitrix;
  return m[row.key]?.users ?? 0;
}

function buildFunnelRows(metrics) {
  const visitUsers = metrics.visit_users;
  const rows = [
    [
      'Зашли на портал',
      metrics.visit_users,
      metrics.visit_visits,
      '',
      '',
      '',
    ],
  ];

  let prevUsers = visitUsers;
  for (const goal of STAFF_GOALS) {
    const stats = metrics[goal.key] ?? emptyGoalStats();
    rows.push([
      goal.label,
      stats.users,
      stats.visits,
      stats.reaches,
      goal.chain ? crBetween(stats.users, prevUsers) : '',
      crBetween(stats.users, visitUsers),
    ]);
    if (goal.chain) prevUsers = stats.users;
  }

  rows.push([
    'Заявки в Битрикс',
    '',
    '',
    metrics.bitrix,
    crBetween(metrics.bitrix, prevUsers),
    crBetween(metrics.bitrix, visitUsers),
  ]);

  return rows;
}

function buildFunnelSheetValues(periodLabel, updatedAt, metrics) {
  return [
    ['staff.motrip.ru — воронка', `Период: ${periodLabel}`, `Обновлено: ${updatedAt}`],
    [],
    FUNNEL_COLUMNS,
    ...buildFunnelRows(metrics),
  ];
}

function buildWeeksSheetValues(weeks, metricsByWeek, updatedAt) {
  const header = ['Этап', ...weeks.map((w) => w.label)];
  const values = [
    ['Посетители по неделям', `Обновлено: ${updatedAt}`],
    [],
    header,
  ];
  for (const row of WEEKLY_STAGE_ROWS) {
    values.push([
      row.label,
      ...weeks.map((w) => weeklyUsersForRow(row, metricsByWeek.get(w.from) ?? emptyMetrics())),
    ]);
  }
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

async function getGoogleClients() {
  const credentials = loadGoogleCredentials();
  if (!credentials) return null;

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ],
  });
  return {
    sheets: google.sheets({ version: 'v4', auth }),
    drive: google.drive({ version: 'v3', auth }),
  };
}

async function withGoogleRetry(label, fn, attempts = 6) {
  let lastErr;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      const retryable =
        /unavailable|timeout|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket|rate|429|502|503|504|internal error|backend error/i.test(
          msg
        );
      if (!retryable || attempt === attempts - 1) throw err;
      const waitMs = Math.min(120000, 5000 * 2 ** attempt);
      console.warn(
        `Google Sheets «${label}» failed (${msg.slice(0, 140)}); retry ${attempt + 1}/${attempts - 1} in ${Math.round(waitMs / 1000)}s`
      );
      await sleep(waitMs);
    }
  }
  throw lastErr;
}

async function ensureSheetTabs(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const titles = new Set((meta.data.sheets ?? []).map((s) => s.properties?.title));
  const requests = [];
  for (const title of [SHEET_TAB_FUNNEL, SHEET_TAB_WEEKS, SHEET_TAB_REF]) {
    if (!titles.has(title)) {
      requests.push({ addSheet: { properties: { title } } });
    }
  }
  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  }
}

async function createSpreadsheet(sheets) {
  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: 'staff.motrip.ru — воронка' },
      sheets: [
        { properties: { title: SHEET_TAB_FUNNEL } },
        { properties: { title: SHEET_TAB_WEEKS } },
        { properties: { title: SHEET_TAB_REF } },
      ],
    },
  });
  return created.data.spreadsheetId;
}

async function shareSpreadsheet(drive, spreadsheetId, email) {
  await drive.permissions.create({
    fileId: spreadsheetId,
    requestBody: {
      type: 'user',
      role: 'writer',
      emailAddress: email,
    },
    sendNotificationEmail: true,
  });
}

function padRowsToWidth(rows) {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  return rows.map((row) => {
    if (row.length >= width) return row;
    return [...row, ...Array(width - row.length).fill('')];
  });
}

async function writeTab(sheets, spreadsheetId, tab, values) {
  const padded = padRowsToWidth(values);
  await withGoogleRetry(`clear ${tab}`, () =>
    sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${tab}!A:ZZ`,
    })
  );
  await withGoogleRetry(`write ${tab}`, () =>
    sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tab}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: padded },
    })
  );
}

function printSheet(title, values) {
  console.log(`\n--- ${title} ---`);
  for (const row of values) console.log(row.join('\t'));
}

async function main() {
  loadEnvLocal(ROOT);
  ensureMetrikaToken();
  const parsed = parseArgs(process.argv);
  const { weeks, from, to, dryRun, createSheet } = parsed;
  let { sheetId, shareEmail } = parsed;

  const endDay = to || mskDayKey(new Date());
  const weekRanges = from
    ? [{ from, to: to || endDay, label: fmtWeekLabel(from, to || endDay) }]
    : buildWeekRanges(endDay, weeks);

  const funnelStart = getFunnelStart();
  const reportWeeks = filterReportWeeks(weekRanges, funnelStart);

  console.log(
    `Staff funnel sync: ${reportWeeks.length}/${weekRanges.length} week(s) in report, учёт с ${funnelStart}`
  );

  const updatedAt = new Intl.DateTimeFormat('ru-RU', {
    timeZone: MSK,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date());

  const metricsByWeek = new Map();
  let periodMetrics = emptyMetrics();
  let periodLabel = 'нет данных';

  if (reportWeeks.length > 0) {
    const firstRange = effectiveMetricsRange(reportWeeks[0], funnelStart);
    const rangeFrom = firstRange.from;
    const rangeTo = reportWeeks[reportWeeks.length - 1].to;
    periodLabel = fmtWeekLabel(rangeFrom, rangeTo);

    console.log(`  Metrika: ${rangeFrom} — ${rangeTo}`);
    console.log('Fetching Metrika totals…');
    periodMetrics = await fetchPeriodMetrics(rangeFrom, rangeTo);
    await sleep(400);

    console.log('Fetching Metrika weekly…');
    const weeklyVisits = await queryWeeklyUsersVisits(
      STAFF_COUNTER,
      rangeFrom,
      rangeTo,
      STAFF_START_URL_FILTER
    );
    await sleep(400);
    const weeklyGoals = await queryWeeklyGoalStats(
      STAFF_COUNTER,
      rangeFrom,
      rangeTo,
      STAFF_GOALS
    );
    await sleep(300);

    let bitrixByWeek = new Map(reportWeeks.map((w) => [w.from, 0]));
    try {
      console.log('Fetching Bitrix staff deals…');
      const bitrix = await fetchStaffBitrixLeadsByWeek(reportWeeks, funnelStart);
      bitrixByWeek = bitrix.byWeek;
      periodMetrics.bitrix = bitrix.total;
    } catch (err) {
      console.warn(`Bitrix staff leads skipped: ${err.message || err}`);
    }

    for (const week of reportWeeks) {
      const metrics = metricsFromWeeklyData(week, weeklyVisits, weeklyGoals, bitrixByWeek);
      metricsByWeek.set(week.from, metrics);
      console.log(
        `  ${week.label}: visit=${metrics.visit_users} login=${metrics.login_success.users} lead=${metrics.lead_success.users} bitrix=${metrics.bitrix}`
      );
    }
  }

  const funnelValues = buildFunnelSheetValues(periodLabel, updatedAt, periodMetrics);
  const weeksValues =
    reportWeeks.length === 0
      ? [['Посетители по неделям', `Обновлено: ${updatedAt}`], WEEKLY_STAGE_ROWS.map((r) => r.label)]
      : buildWeeksSheetValues(reportWeeks, metricsByWeek, updatedAt);

  if (dryRun) {
    printSheet(SHEET_TAB_FUNNEL, funnelValues);
    printSheet(SHEET_TAB_WEEKS, weeksValues);
    return;
  }

  const clients = await getGoogleClients();
  if (!clients) {
    const outDir = path.join(ROOT, 'storage');
    fs.mkdirSync(outDir, { recursive: true });
    const tsv = padRowsToWidth(funnelValues)
      .map((r) => r.join('\t'))
      .join('\n');
    fs.writeFileSync(path.join(outDir, 'staff-funnel-export.tsv'), tsv, 'utf8');
    console.log('\nGoogle credentials не заданы (GOOGLE_SERVICE_ACCOUNT_JSON).');
    console.log(`TSV: ${outDir}/staff-funnel-export.tsv`);
    return;
  }

  const { sheets, drive } = clients;
  if (!sheetId) {
    if (!createSheet) {
      throw new Error(
        'STAFF_SHEET_ID пустой. Передайте --create, чтобы создать таблицу, или --sheet-id= / STAFF_SHEET_ID.'
      );
    }
    console.log('Creating Google Spreadsheet…');
    sheetId = await withGoogleRetry('create spreadsheet', () => createSpreadsheet(sheets));
    console.log(`Created spreadsheet ${sheetId}`);
    if (!shareEmail) shareEmail = 'esakov.dv@gmail.com';
    try {
      await withGoogleRetry('share', () => shareSpreadsheet(drive, sheetId, shareEmail));
      console.log(`Shared with ${shareEmail}`);
    } catch (err) {
      console.warn(`Share failed (${err.message || err}). Add the SA as editor on the sheet.`);
    }
  }

  await withGoogleRetry('ensure tabs', () => ensureSheetTabs(sheets, sheetId));
  await writeTab(sheets, sheetId, SHEET_TAB_FUNNEL, funnelValues);
  await writeTab(sheets, sheetId, SHEET_TAB_WEEKS, weeksValues);
  await writeTab(sheets, sheetId, SHEET_TAB_REF, REFERENCE_ROWS);

  console.log(`\nГотово: https://docs.google.com/spreadsheets/d/${sheetId}/edit`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
