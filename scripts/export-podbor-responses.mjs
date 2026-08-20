#!/usr/bin/env node
/**
 * Export podbor wizard responses from storage/podbor-responses.json to TSV.
 *
 * Usage:
 *   npm run podbor:export-responses
 *   npm run podbor:export-responses -- --from=2026-08-13 --status=completed
 *   curl "https://motrip.ru/api/podbor-responses?password=...&format=tsv" -o podbor.tsv
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvLocal } from './lib/load-env-local.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnvLocal(ROOT);

const args = process.argv.slice(2);
function arg(name, fallback) {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}

const storePath = process.env.PODBOR_RESPONSES_PATH || path.join(ROOT, 'storage/podbor-responses.json');
const outPath = arg('out', path.join(ROOT, 'storage/podbor-responses-export.tsv'));
const from = arg('from', '');
const to = arg('to', '');
const status = arg('status', 'all');

if (!fs.existsSync(storePath)) {
  console.error('Нет файла:', storePath);
  process.exit(1);
}

const sessions = JSON.parse(fs.readFileSync(storePath, 'utf8'));
const fromTs = from ? Date.parse(`${from}T00:00:00+03:00`) : NaN;
const toTs = to ? Date.parse(`${to}T23:59:59+03:00`) : NaN;

const filtered = sessions.filter((s) => {
  if (status !== 'all' && s.status !== status) return false;
  const ts = Date.parse(s.startedAt);
  if (Number.isFinite(fromTs) && ts < fromTs) return false;
  if (Number.isFinite(toTs) && ts > toTs) return false;
  return true;
});

const header = [
  'session_id', 'started_at', 'updated_at', 'completed_at', 'status', 'embedded',
  'utm_source', 'utm_medium', 'utm_campaign',
  'adults', 'kids', 'kids_ages', 'budget', 'budget_custom', 'format', 'region',
  'check_in', 'check_out', 'nights', 'handoff_url', 'referer',
].join('\t');

const rows = filtered.map((s) => {
  const a = s.answers || {};
  return [
    s.id, s.startedAt, s.updatedAt, s.completedAt || '', s.status, s.embedded ? '1' : '0',
    s.utm?.utm_source || '', s.utm?.utm_medium || '', s.utm?.utm_campaign || '',
    a.adults ?? '', a.kids ?? '', (a.kidsAges || []).join(','), a.budget ?? '',
    a.budgetCustom ? '1' : '0', a.format ?? '', a.region ?? '',
    a.checkIn ?? '', a.checkOut ?? '', a.nights ?? '', a.handoffUrl ?? '', s.referer || '',
  ].join('\t');
});

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, [header, ...rows].join('\n') + '\n', 'utf8');
console.log(`Exported ${filtered.length} session(s) → ${outPath}`);
