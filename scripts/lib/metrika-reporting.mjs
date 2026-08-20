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

/** Batch goal users (+ optional extra metrics). goals: [{ id, key }] */
export async function queryBatchGoals(counterId, dateFrom, dateTo, goals, extraMetrics = [], filter = null) {
  const goalMetrics = goals.flatMap((g) => [`ym:s:goal${g.id}users`]);
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
  if (extraMetrics.includes('ym:s:users')) out._users = totals[0] ?? 0;
  return out;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Unique clientIDs with any visit matching entryFilter in [entryFrom, entryTo]. */
export async function queryPodborHotelEntryClients(
  counterId,
  entryFrom,
  entryTo,
  entryFilter
) {
  const data = await metrikaApi(
    `/stat/v1/data?id=${counterId}&date1=${entryFrom}&date2=${entryTo}` +
      `&metrics=ym:s:visits&dimensions=ym:s:clientID&limit=10000` +
      `&filters=${encFilter(entryFilter)}`
  );
  return new Set(
    (data.data ?? []).map((row) => row.dimensions[0]?.name).filter(Boolean)
  );
}

function chunkClientIds(clientIds, size = 10) {
  const chunks = [];
  for (let i = 0; i < clientIds.length; i += size) {
    chunks.push(clientIds.slice(i, i + size));
  }
  return chunks;
}

/**
 * clientID journey: entry clients (podbor) → downstream action in report period.
 * Returns Map weekStart (Monday) -> unique user count.
 */
export async function queryWeeklyHotelPodborJourneyUsers(
  counterId,
  dateFrom,
  dateTo,
  entryClientIds,
  downstreamFilter
) {
  const byWeek = new Map();
  if (!entryClientIds?.size) return byWeek;

  for (const chunk of chunkClientIds([...entryClientIds])) {
    const orFilter = chunk.map((cid) => `ym:s:clientID=='${cid}'`).join(' OR ');
    const data = await metrikaApi(
      `/stat/v1/data?id=${counterId}&date1=${dateFrom}&date2=${dateTo}` +
        `&metrics=ym:s:visits&dimensions=ym:s:startOfWeek,ym:s:clientID&group=week&limit=10000` +
        `&filters=${encFilter(`(${orFilter}) AND ${downstreamFilter}`)}`
    );
    for (const row of data.data ?? []) {
      const weekStart = row.dimensions[0]?.name;
      const clientId = row.dimensions[1]?.name;
      if (!weekStart || !clientId) continue;
      if (!byWeek.has(weekStart)) byWeek.set(weekStart, new Set());
      byWeek.get(weekStart).add(clientId);
    }
    await sleep(200);
  }

  const counts = new Map();
  for (const [weekStart, clients] of byWeek) {
    counts.set(weekStart, clients.size);
  }
  return counts;
}

/** Single date range count for podbor hotel journey. */
export async function queryHotelPodborJourneyUserCount(
  counterId,
  dateFrom,
  dateTo,
  entryClientIds,
  downstreamFilter
) {
  if (!entryClientIds?.size) return 0;
  const matched = new Set();
  for (const chunk of chunkClientIds([...entryClientIds])) {
    const orFilter = chunk.map((cid) => `ym:s:clientID=='${cid}'`).join(' OR ');
    const data = await metrikaApi(
      `/stat/v1/data?id=${counterId}&date1=${dateFrom}&date2=${dateTo}` +
        `&metrics=ym:s:visits&dimensions=ym:s:clientID&limit=10000` +
        `&filters=${encFilter(`(${orFilter}) AND ${downstreamFilter}`)}`
    );
    for (const row of data.data ?? []) {
      if (row.dimensions[0]?.name) matched.add(row.dimensions[0].name);
    }
    await sleep(200);
  }
  return matched.size;
}

/**
 * Weekly unique users for goals over a date range.
 * Returns Map weekStart (YYYY-MM-DD Monday) -> { goalKey: users }.
 */
export async function queryWeeklyGoals(counterId, dateFrom, dateTo, goals, filter = null) {
  const goalMetrics = goals.map((g) => `ym:s:goal${g.id}users`).join(',');
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

/** Weekly unique users for one goal with arbitrary filter. Map weekStart -> users */
export async function queryWeeklyGoalUsers(counterId, dateFrom, dateTo, goalId, filter = null) {
  const f = filter ? `&filters=${encFilter(filter)}` : '';
  const data = await metrikaApi(
    `/stat/v1/data?id=${counterId}&date1=${dateFrom}&date2=${dateTo}` +
      `&metrics=ym:s:goal${goalId}users&dimensions=ym:s:startOfWeek&group=week&sort=ym:s:startOfWeek${f}`
  );
  const byWeek = new Map();
  for (const row of data.data ?? []) {
    byWeek.set(row.dimensions[0].name, row.metrics[0] ?? 0);
  }
  return byWeek;
}

/** @deprecated use queryWeeklyGoalUsers */
export const queryWeeklyGoalReaches = queryWeeklyGoalUsers;

/** Weekly users or visits with filter. Map weekStart -> number. Default: users. */
export async function queryWeeklyVisits(counterId, dateFrom, dateTo, filter, metric = 'ym:s:users') {
  const f = filter ? `&filters=${encFilter(filter)}` : '';
  const data = await metrikaApi(
    `/stat/v1/data?id=${counterId}&date1=${dateFrom}&date2=${dateTo}` +
      `&metrics=${metric}&dimensions=ym:s:startOfWeek&group=week&sort=ym:s:startOfWeek${f}`
  );
  const byWeek = new Map();
  for (const row of data.data ?? []) {
    byWeek.set(row.dimensions[0].name, row.metrics[0] ?? 0);
  }
  return byWeek;
}

/**
 * Hotel purchases attributed to podbor by client journey:
 * lt_checkout with podbor_wizard (any time from funnelStart) → lt_purchase in report week.
 * Returns Map weekStart (Monday) -> unique buyer count.
 */
export async function queryWeeklyHotelPodborJourneyPurchases(
  counterId,
  dateFrom,
  dateTo,
  {
    funnelStart,
    checkoutGoalId = 579160037,
    purchaseGoalId = 579160040,
    utmFilter = "ym:s:UTMSource=='podbor_wizard'",
  } = {}
) {
  const checkoutFrom = funnelStart && funnelStart > dateFrom ? funnelStart : dateFrom;
  const checkoutFilter = `${utmFilter} AND ym:s:goal${checkoutGoalId}reaches>0`;
  const checkoutData = await metrikaApi(
    `/stat/v1/data?id=${counterId}&date1=${checkoutFrom}&date2=${dateTo}` +
      `&metrics=ym:s:goal${checkoutGoalId}reaches&dimensions=ym:s:clientID&limit=10000` +
      `&filters=${encFilter(checkoutFilter)}`
  );

  const checkoutClients = new Set(
    (checkoutData.data ?? []).map((row) => row.dimensions[0].name).filter(Boolean)
  );
  const byWeek = new Map();
  if (checkoutClients.size === 0) return byWeek;

  const chunks = [];
  const ids = [...checkoutClients];
  for (let i = 0; i < ids.length; i += 40) {
    chunks.push(ids.slice(i, i + 40));
  }

  for (const chunk of chunks) {
    const orFilter = chunk.map((cid) => `ym:s:clientID=='${cid}'`).join(' OR ');
    const purchaseData = await metrikaApi(
      `/stat/v1/data?id=${counterId}&date1=${dateFrom}&date2=${dateTo}` +
        `&metrics=ym:s:goal${purchaseGoalId}reaches` +
        `&dimensions=ym:s:startOfWeek,ym:s:clientID&group=week&limit=10000` +
        `&filters=${encFilter(`(${orFilter}) AND ym:s:goal${purchaseGoalId}reaches>0`)}`
    );
    for (const row of purchaseData.data ?? []) {
      const weekStart = row.dimensions[0].name;
      const clientId = row.dimensions[1].name;
      if (!weekStart || !clientId) continue;
      if (!byWeek.has(weekStart)) byWeek.set(weekStart, new Set());
      byWeek.get(weekStart).add(clientId);
    }
    await sleep(200);
  }

  const counts = new Map();
  for (const [weekStart, clients] of byWeek) {
    counts.set(weekStart, clients.size);
  }
  return counts;
}

/** Unique buyers: podbor checkout (from funnelStart) + lt_purchase in [purchaseFrom, purchaseTo]. */
export async function queryHotelPodborJourneyPurchaseCount(
  counterId,
  purchaseFrom,
  purchaseTo,
  {
    funnelStart,
    checkoutGoalId = 579160037,
    purchaseGoalId = 579160040,
    utmFilter = "ym:s:UTMSource=='podbor_wizard'",
  } = {}
) {
  const checkoutFrom = funnelStart && funnelStart > purchaseFrom ? funnelStart : purchaseFrom;
  const checkoutFilter = `${utmFilter} AND ym:s:goal${checkoutGoalId}reaches>0`;
  const checkoutData = await metrikaApi(
    `/stat/v1/data?id=${counterId}&date1=${checkoutFrom}&date2=${purchaseTo}` +
      `&metrics=ym:s:goal${checkoutGoalId}reaches&dimensions=ym:s:clientID&limit=10000` +
      `&filters=${encFilter(checkoutFilter)}`
  );
  const checkoutClients = new Set(
    (checkoutData.data ?? []).map((row) => row.dimensions[0].name).filter(Boolean)
  );
  if (checkoutClients.size === 0) return 0;

  const chunks = [];
  const ids = [...checkoutClients];
  for (let i = 0; i < ids.length; i += 40) chunks.push(ids.slice(i, i + 40));

  const buyers = new Set();
  for (const chunk of chunks) {
    const orFilter = chunk.map((cid) => `ym:s:clientID=='${cid}'`).join(' OR ');
    const purchaseData = await metrikaApi(
      `/stat/v1/data?id=${counterId}&date1=${purchaseFrom}&date2=${purchaseTo}` +
        `&metrics=ym:s:goal${purchaseGoalId}reaches&dimensions=ym:s:clientID&limit=10000` +
        `&filters=${encFilter(`(${orFilter}) AND ym:s:goal${purchaseGoalId}reaches>0`)}`
    );
    for (const row of purchaseData.data ?? []) {
      if (row.dimensions[0]?.name) buyers.add(row.dimensions[0].name);
    }
    await sleep(200);
  }
  return buyers.size;
}
