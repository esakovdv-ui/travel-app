#!/usr/bin/env node
/**
 * Загружает rebooking_link в Bitrix по номеру заявки в TITLE сделки.
 * Колонка deal_id в Excel «Крым Все» — это ID договора МГТ, не ID сделки CRM.
 *
 * Usage: node scripts/import-rebooking-links-bitrix-by-order.mjs [csv] [--dry-run] [--limit=N]
 */

import fs from 'node:fs';
import path from 'node:path';
import { loadEnvLocal, ensureBitrixEnv } from './lib/load-env-local.mjs';

loadEnvLocal();
ensureBitrixEnv();

const LINK_FIELD = process.env.REBOOKING_LINK_FIELD?.trim() || 'UF_CRM_1782832678147';
const DELAY_MS = Number(process.env.BITRIX_IMPORT_DELAY_MS || 120);
const DEAL_CACHE = new Map();

function parseArgs(argv) {
  let csvPath = '/Users/dima/Downloads/Крым Все_rebooking_ссылки.csv';
  let dryRun = false;
  let limit = Infinity;
  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('--limit=')) limit = Number(arg.slice('--limit='.length));
    else if (!arg.startsWith('-')) csvPath = arg;
  }
  return { csvPath, dryRun, limit };
}

function buildBitrixUrl(method) {
  const token = process.env.WEBHOOK_TOKEN?.trim().replace(/^\/+|\/+$/g, '');
  const base = process.env.BITRIX_REST_BASE_URL?.trim().replace(/\/+$/, '');
  const cleanMethod = method.replace(/^\/+|\/+$/g, '').replace(/\.json$/i, '');
  return `${base}/${token}/${cleanMethod}.json`;
}

async function bitrixCall(method, payload) {
  const response = await fetch(buildBitrixUrl(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    throw new Error(`bitrix_error:${data?.error || 'unknown'}:${data?.error_description || ''}`.slice(0, 240));
  }
  return data.result;
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  result.push(current);
  return result;
}

function readCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const orderIdx = headers.indexOf('order');
  const linkIdx = headers.indexOf('rebooking_link');
  if (orderIdx < 0 || linkIdx < 0) throw new Error('CSV must contain order and rebooking_link');

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const order = String(cols[orderIdx] || '').trim();
    const link = String(cols[linkIdx] || '').trim();
    if (!order || !link) continue;
    rows.push({ order, link });
  }
  return rows;
}

async function findDealIdByOrder(order) {
  if (DEAL_CACHE.has(order)) return DEAL_CACHE.get(order);
  const deals = await bitrixCall('crm.deal.list', {
    filter: { '%TITLE': order },
    select: ['ID', 'TITLE'],
  });
  const match = (deals || []).filter((d) => String(d.TITLE || '').includes(order));
  const dealId = match.length === 1 ? Number(match[0].ID) : null;
  DEAL_CACHE.set(order, dealId);
  return dealId;
}

function withBitrixDealId(link, bitrixDealId) {
  try {
    const url = new URL(link);
    url.searchParams.set('dealId', String(bitrixDealId));
    return url.toString();
  } catch {
    return link;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const { csvPath, dryRun, limit } = parseArgs(process.argv);
  const resolved = path.resolve(csvPath);
  const rows = readCsv(resolved).slice(0, limit);
  console.log(`CSV: ${resolved}`);
  console.log(`Строк: ${rows.length}, поле: ${LINK_FIELD}`);
  if (dryRun) console.log('Режим: --dry-run\n');

  let ok = 0;
  let failed = 0;
  let notFound = 0;

  for (const row of rows) {
    const label = `order ${row.order}`;
    try {
      const dealId = await findDealIdByOrder(row.order);
      if (!dealId) {
        notFound += 1;
        console.error(`[not found] ${label}`);
        continue;
      }
      if (dryRun) {
        console.log(`[dry-run] ${label} → deal ${dealId}`);
        ok += 1;
        continue;
      }
      await bitrixCall('crm.deal.update', {
        id: dealId,
        fields: { [LINK_FIELD]: withBitrixDealId(row.link, dealId) },
      });
      ok += 1;
      console.log(`[ok] ${label} → deal ${dealId}`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[fail] ${label}: ${message}`);
    }
    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }

  console.log(`\nГотово: ok=${ok}, not_found=${notFound}, failed=${failed}`);
  if (failed > 0 || notFound > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
