/**
 * Yandex Metrika Reporting API helpers.
 * Token: YANDEX_METRIKA_TOKEN or YANDEX_API_KEY (also loads yandex-metrika-mcp/.env).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvLocal } from './load-env-local.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MCP_ENV = path.join(path.dirname(ROOT), 'yandex-metrika-mcp/.env');

export function ensureMetrikaToken() {
  loadEnvLocal(ROOT);
  if (!process.env.YANDEX_METRIKA_TOKEN && !process.env.YANDEX_API_KEY && fs.existsSync(MCP_ENV)) {
    for (const rawLine of fs.readFileSync(MCP_ENV, 'utf8').split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      if (!process.env[key]) process.env[key] = line.slice(eq + 1).trim();
    }
  }
  const token = process.env.YANDEX_METRIKA_TOKEN?.trim() || process.env.YANDEX_API_KEY?.trim();
  if (!token) {
    throw new Error('Задайте YANDEX_METRIKA_TOKEN или YANDEX_API_KEY в .env.local');
  }
  return token;
}

export function encFilter(filter) {
  return encodeURIComponent(filter);
}

export async function metrikaApi(path, token = ensureMetrikaToken(), attempt = 0) {
  const response = await fetch(`https://api-metrika.yandex.net${path}`, {
    headers: { Authorization: `OAuth ${token}` },
    signal: AbortSignal.timeout(60000),
  });
  const text = await response.text();
  if (response.status === 429 && attempt < 5) {
    const waitMs = 15000 * (attempt + 1);
    await sleep(waitMs);
    return metrikaApi(path, token, attempt + 1);
  }
  if (!response.ok) {
    throw new Error(`metrika ${response.status}: ${text.slice(0, 400)}`);
  }
  return JSON.parse(text);
}

/** Users + reaches for a goal in date range. */
export async function queryGoalReaches(counterId, goalId, dateFrom, dateTo, filter = null) {
  const f = filter ? `&filters=${encFilter(filter)}` : '';
  const data = await metrikaApi(
    `/stat/v1/data?id=${counterId}&date1=${dateFrom}&date2=${dateTo}` +
      `&metrics=ym:s:goal${goalId}users,ym:s:goal${goalId}reaches${f}`
  );
  return {
    users: data.totals?.[0] ?? 0,
    reaches: data.totals?.[1] ?? 0,
  };
}

/** Session users/visits with optional filter. */
export async function queryUsersVisits(counterId, dateFrom, dateTo, filter = null) {
  const f = filter ? `&filters=${encFilter(filter)}` : '';
  const data = await metrikaApi(
    `/stat/v1/data?id=${counterId}&date1=${dateFrom}&date2=${dateTo}` +
      `&metrics=ym:s:users,ym:s:visits${f}`
  );
  return {
    users: data.totals?.[0] ?? 0,
    visits: data.totals?.[1] ?? 0,
  };
}

/** Daily breakdown for one metric or goal reaches. */
export async function queryDailyGoalReaches(counterId, goalId, dateFrom, dateTo, filter = null) {
  const f = filter ? `&filters=${encFilter(filter)}` : '';
  const data = await metrikaApi(
    `/stat/v1/data?id=${counterId}&date1=${dateFrom}&date2=${dateTo}` +
      `&metrics=ym:s:goal${goalId}reaches&dimensions=ym:s:date&group=day&sort=ym:s:date${f}`
  );
  const out = new Map();
  for (const row of data.data ?? []) {
    out.set(row.dimensions[0].name, row.metrics[0] ?? 0);
  }
  return out;
}

/** Daily users/visits with filter. */
export async function queryDailyUsersVisits(counterId, dateFrom, dateTo, filter = null) {
  const f = filter ? `&filters=${encFilter(filter)}` : '';
  const data = await metrikaApi(
    `/stat/v1/data?id=${counterId}&date1=${dateFrom}&date2=${dateTo}` +
      `&metrics=ym:s:users,ym:s:visits&dimensions=ym:s:date&group=day&sort=ym:s:date${f}`
  );
  const out = new Map();
  for (const row of data.data ?? []) {
    out.set(row.dimensions[0].name, {
      users: row.metrics[0] ?? 0,
      visits: row.metrics[1] ?? 0,
    });
  }
  return out;
}

export function sumDailyMap(dailyMap, dateFrom, dateTo) {
  let users = 0;
  let visits = 0;
  for (const [day, v] of dailyMap) {
    if (day >= dateFrom && day <= dateTo) {
      users += v.users ?? 0;
      visits += v.visits ?? 0;
    }
  }
  return { users, visits };
}

export function sumDailyGoalMap(dailyMap, dateFrom, dateTo) {
  let reaches = 0;
  for (const [day, v] of dailyMap) {
    if (day >= dateFrom && day <= dateTo) reaches += v ?? 0;
  }
  return reaches;
}

/** Batch goal reaches + visits in one request. goals: [{ id, key }] */
export async function queryBatchGoals(counterId, dateFrom, dateTo, goals, extraMetrics = [], filter = null) {
  const goalMetrics = goals.flatMap((g) => [`ym:s:goal${g.id}reaches`]);
  const metrics = [...extraMetrics, ...goalMetrics].join(',');
  const f = filter ? `&filters=${encFilter(filter)}` : '';
  const data = await metrikaApi(
    `/stat/v1/data?id=${counterId}&date1=${dateFrom}&date2=${dateTo}&metrics=${metrics}${f}`
  );
  const totals = data.totals ?? [];
  const out = {};
  let offset = extraMetrics.length;
  for (const g of goals) {
    out[g.key] = totals[offset] ?? 0;
    offset += 1;
  }
  if (extraMetrics.includes('ym:s:visits')) out._visits = totals[0] ?? 0;
  return out;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Weekly reaches for goals over a date range.
 * Returns Map weekStart (YYYY-MM-DD Monday) -> { goalKey: reaches }.
 */
export async function queryWeeklyGoals(counterId, dateFrom, dateTo, goals, filter = null) {
  const goalMetrics = goals.map((g) => `ym:s:goal${g.id}reaches`).join(',');
  const f = filter ? `&filters=${encFilter(filter)}` : '';
  const data = await metrikaApi(
    `/stat/v1/data?id=${counterId}&date1=${dateFrom}&date2=${dateTo}` +
      `&metrics=${goalMetrics}&dimensions=ym:s:startOfWeek&group=week&sort=ym:s:startOfWeek${f}`
  );
  const byWeek = new Map();
  for (const row of data.data ?? []) {
    const weekStart = row.dimensions[0].name;
    const metrics = {};
    goals.forEach((g, i) => {
      metrics[g.key] = row.metrics[i] ?? 0;
    });
    byWeek.set(weekStart, metrics);
  }
  return byWeek;
}

/** Weekly visits with filter. Map weekStart -> visits */
export async function queryWeeklyVisits(counterId, dateFrom, dateTo, filter) {
  const f = filter ? `&filters=${encFilter(filter)}` : '';
  const data = await metrikaApi(
    `/stat/v1/data?id=${counterId}&date1=${dateFrom}&date2=${dateTo}` +
      `&metrics=ym:s:visits&dimensions=ym:s:startOfWeek&group=week&sort=ym:s:startOfWeek${f}`
  );
  const byWeek = new Map();
  for (const row of data.data ?? []) {
    byWeek.set(row.dimensions[0].name, row.metrics[0] ?? 0);
  }
  return byWeek;
}
