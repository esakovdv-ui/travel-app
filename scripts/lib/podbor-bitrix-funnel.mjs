/**
 * Podbor leads → Bitrix category/12 deals «Подбор: …» at stage C12:WON.
 * @see src/lib/bitrix-podbor-lead.ts
 */

import { ensureBitrixEnv } from './load-env-local.mjs';

export const PODBOR_BITRIX_CATEGORY_ID = 12;
export const PODBOR_BITRIX_WON_STAGE = 'C12:WON';
const PODBOR_TITLE_PREFIX = 'подбор:';
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

export function isPodborDealTitle(title) {
  return String(title || '')
    .trim()
    .toLowerCase()
    .startsWith(PODBOR_TITLE_PREFIX);
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
 * Deals «Подбор: …» created in period, currently at C12:WON.
 * @param {{ from: string, to: string }[]} weeks — report weeks (Monday keys in `from`)
 * @returns {Promise<Map<string, number>>} weekFrom → count
 */
export async function fetchPodborBitrixWonByWeek(weeks, funnelStart) {
  ensureBitrixEnv();
  const counts = new Map(weeks.map((w) => [w.from, 0]));
  if (!weeks.length) return counts;

  const rangeFrom = weeks[0].from;
  const rangeTo = weeks[weeks.length - 1].to;
  const createFrom = rangeFrom >= funnelStart ? rangeFrom : funnelStart;

  const deals = await bitrixListAll('crm.deal.list', {
    filter: {
      CATEGORY_ID: PODBOR_BITRIX_CATEGORY_ID,
      STAGE_ID: PODBOR_BITRIX_WON_STAGE,
      '>=DATE_CREATE': `${createFrom} 00:00:00`,
      '<=DATE_CREATE': `${rangeTo} 23:59:59`,
    },
    select: ['ID', 'TITLE', 'DATE_CREATE', 'STAGE_ID'],
    order: { DATE_CREATE: 'ASC' },
  });

  for (const deal of deals) {
    if (!isPodborDealTitle(deal.TITLE)) continue;
    const day = mskDayKey(deal.DATE_CREATE);
    if (day < createFrom || day > rangeTo) continue;
    const weekKey = weekStartMonday(day);
    if (counts.has(weekKey)) {
      counts.set(weekKey, (counts.get(weekKey) || 0) + 1);
    }
  }

  return counts;
}
