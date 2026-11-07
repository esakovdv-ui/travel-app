/**
 * Staff portal leads → Bitrix category/22 deals with SOURCE_ID UC_58Z62L.
 * @see apps/staff-landing/src/app/api/lead/route.ts
 */

import { ensureBitrixEnv } from './load-env-local.mjs';

export const STAFF_BITRIX_CATEGORY_ID = 22;
export const STAFF_BITRIX_SOURCE_ID = 'UC_58Z62L';
const MSK = 'Europe/Moscow';

function buildBitrixUrl(method) {
  const token = process.env.WEBHOOK_TOKEN?.trim().replace(/^\/+|\/+$/g, '');
  const base = process.env.BITRIX_REST_BASE_URL?.trim().replace(/\/+$/, '');
  if (!token || !base) throw new Error('Bitrix webhook not configured');
  return `${base}/${token}/${method.replace(/\.json$/i, '')}.json`;
}

async function bitrixCall(method, payload = {}) {
  const response = await fetch(buildBitrixUrl(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(45000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    const err = typeof data?.error === 'string' ? data.error : 'unknown';
    const desc = typeof data?.error_description === 'string' ? data.error_description : '';
    throw new Error(`bitrix_error:${err}:${desc}`.slice(0, 240));
  }
  return data;
}

async function bitrixListAll(method, payload) {
  const out = [];
  let start = 0;
  while (true) {
    const data = await bitrixCall(method, { ...payload, start });
    const rows = Array.isArray(data.result) ? data.result : [];
    out.push(...rows);
    if (!data.next) break;
    start = data.next;
    if (start > 10000) break;
  }
  return out;
}

function mskDayKey(isoOrDate) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MSK,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function weekStartMonday(dayKey) {
  const d = new Date(`${dayKey}T12:00:00+03:00`);
  const dow = d.getUTCDay();
  const toMonday = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + toMonday);
  return mskDayKey(d);
}

/**
 * Staff deals created in period, grouped by report week (Monday key).
 * @param {{ from: string, to: string }[]} weeks
 * @returns {Promise<{ byWeek: Map<string, number>, total: number }>}
 */
export async function fetchStaffBitrixLeadsByWeek(weeks, funnelStart) {
  ensureBitrixEnv();
  const byWeek = new Map(weeks.map((w) => [w.from, 0]));
  if (!weeks.length) return { byWeek, total: 0 };

  const rangeFrom = weeks[0].from;
  const rangeTo = weeks[weeks.length - 1].to;
  const createFrom = rangeFrom >= funnelStart ? rangeFrom : funnelStart;

  const deals = await bitrixListAll('crm.deal.list', {
    filter: {
      CATEGORY_ID: STAFF_BITRIX_CATEGORY_ID,
      SOURCE_ID: STAFF_BITRIX_SOURCE_ID,
      '>=DATE_CREATE': `${createFrom} 00:00:00`,
      '<=DATE_CREATE': `${rangeTo} 23:59:59`,
    },
    select: ['ID', 'TITLE', 'DATE_CREATE', 'SOURCE_ID'],
    order: { DATE_CREATE: 'ASC' },
  });

  let total = 0;
  for (const deal of deals) {
    const day = mskDayKey(deal.DATE_CREATE);
    if (day < createFrom || day > rangeTo) continue;
    total += 1;
    const weekKey = weekStartMonday(day);
    if (byWeek.has(weekKey)) {
      byWeek.set(weekKey, (byWeek.get(weekKey) || 0) + 1);
    }
  }

  return { byWeek, total };
}
