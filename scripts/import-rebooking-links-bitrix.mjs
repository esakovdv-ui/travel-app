#!/usr/bin/env node
/**
 * Загружает персональные rebooking_link из CSV в поле сделки Bitrix24.
 *
 * Использование:
 *   node scripts/import-rebooking-links-bitrix.mjs [path/to.csv] [--dry-run] [--limit=N]
 *
 * Env:
 *   BITRIX_DOMAIN или REBOOKING_BITRIX_DOMAIN (default: crm.mosgortur.ru)
 *   WEBHOOK_TOKEN — вебхук с правами crm.deal.update
 *   BITRIX_REST_BASE_URL — прокси (https://it.mosgortur.ru/b24catch)
 *   REBOOKING_LINK_FIELD — код UF-поля (default: UF_CRM_REBOOKING_LINK)
 */

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_CSV =
  '/Users/dima/Downloads/крым_срочные_июль_полный_bitrix_рассылка.csv';
const LINK_FIELD = process.env.REBOOKING_LINK_FIELD?.trim() || 'UF_CRM_REBOOKING_LINK';
const DELAY_MS = Number(process.env.BITRIX_IMPORT_DELAY_MS || 120);

function parseArgs(argv) {
  const args = argv.slice(2);
  let csvPath = DEFAULT_CSV;
  let dryRun = false;
  let limit = Infinity;

  for (const arg of args) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('--limit=')) limit = Number(arg.slice('--limit='.length));
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/import-rebooking-links-bitrix.mjs [csv] [--dry-run] [--limit=N]`);
      process.exit(0);
    } else if (!arg.startsWith('-')) csvPath = arg;
  }

  return { csvPath, dryRun, limit };
}

function buildBitrixUrl(domain, token, method) {
  const cleanToken = token.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  const cleanMethod = method.replace(/^\/+/, '').replace(/\.json$/i, '');
  const base = process.env.BITRIX_REST_BASE_URL?.trim().replace(/\/+$/, '');
  if (base) return `${base}/${cleanToken}/${cleanMethod}.json`;
  const cleanDomain = domain.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return `https://${cleanDomain}/rest/${cleanToken}/${cleanMethod}.json`;
}

async function bitrixCall(method, payload) {
  const domain =
    process.env.BITRIX_DOMAIN?.trim() ||
    process.env.REBOOKING_BITRIX_DOMAIN?.trim() ||
    'crm.mosgortur.ru';
  const token = process.env.WEBHOOK_TOKEN?.trim() || process.env.REBOOKING_WEBHOOK_TOKEN?.trim();
  if (!token) throw new Error('misconfigured: WEBHOOK_TOKEN or REBOOKING_WEBHOOK_TOKEN');

  const response = await fetch(buildBitrixUrl(domain, token, method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(25000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    const err = typeof data?.error === 'string' ? data.error : 'unknown';
    const desc =
      typeof data?.error_description === 'string' ? data.error_description : '';
    throw new Error(`bitrix_error:${err}:${desc}`.slice(0, 240));
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
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const dealIdx = headers.indexOf('deal_id');
  const linkIdx = headers.indexOf('rebooking_link');
  const emailIdx = headers.indexOf('email');
  const orderIdx = headers.indexOf('order');

  if (dealIdx < 0 || linkIdx < 0) {
    throw new Error('CSV must contain deal_id and rebooking_link columns');
  }

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const dealId = Number(String(cols[dealIdx] || '').trim());
    const link = String(cols[linkIdx] || '').trim();
    if (!Number.isFinite(dealId) || dealId <= 0 || !link) continue;
    rows.push({
      dealId,
      link,
      email: emailIdx >= 0 ? String(cols[emailIdx] || '').trim() : '',
      order: orderIdx >= 0 ? String(cols[orderIdx] || '').trim() : '',
    });
  }
  return rows;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function updateDeal(dealId, link) {
  return bitrixCall('crm.deal.update', {
    id: dealId,
    fields: { [LINK_FIELD]: link },
  });
}

async function main() {
  const { csvPath, dryRun, limit } = parseArgs(process.argv);
  const resolved = path.resolve(csvPath);
  if (!fs.existsSync(resolved)) {
    console.error(`Файл не найден: ${resolved}`);
    process.exit(1);
  }

  const rows = readCsv(resolved);
  const batch = rows.slice(0, limit);
  console.log(`CSV: ${resolved}`);
  console.log(`Строк: ${rows.length}, к обработке: ${batch.length}`);
  console.log(`Поле сделки: ${LINK_FIELD}`);
  if (dryRun) console.log('Режим: --dry-run (запросы в Bitrix не отправляются)\n');

  let ok = 0;
  let failed = 0;

  for (const row of batch) {
    const label = `deal ${row.dealId} (${row.order || row.email || '—'})`;
    if (dryRun) {
      console.log(`[dry-run] ${label} → ${row.link.slice(0, 80)}…`);
      ok += 1;
      continue;
    }

    try {
      await updateDeal(row.dealId, row.link);
      ok += 1;
      console.log(`[ok] ${label}`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[fail] ${label}: ${message}`);
    }

    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }

  console.log(`\nГотово: ok=${ok}, failed=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
