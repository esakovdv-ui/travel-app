#!/usr/bin/env node
/**
 * Генератор ссылок /rebooking из выгрузки «Крым Все.xlsx».
 *
 * Запуск:
 *   node scripts/generate-krym-all-rebooking-links.mjs "/Users/dima/Downloads/Крым Все.xlsx"
 *
 * Env:
 *   REBOOKING_BASE_URL — default: https://online.mosgortur.ru/new/rebooking
 *   UTM_CAMPAIGN — default: krym_sprint_2_15_july2026
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildTouristParams } from './lib/rebooking-tourist-params.mjs';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const BASE_URL = process.env.REBOOKING_BASE_URL || 'https://online.mosgortur.ru/new/rebooking';
const UTM = {
  utm_source: process.env.UTM_SOURCE || 'email',
  utm_medium: process.env.UTM_MEDIUM || 'newsletter',
  utm_campaign: process.env.UTM_CAMPAIGN || 'krym_sprint_2_15_july2026',
};

const HEADER_SKIP_ROWS = 2;

function parseDateToIso(raw) {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  const n = Number(raw);
  if (Number.isFinite(n) && n > 40000 && n < 60000) {
    const utc = Math.round((n - 25569) * 86400 * 1000);
    const d = new Date(utc);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = String(raw || '').trim();
  if (!s) return '';
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (isoDate) return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;
  const ru = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if (ru) return `${ru[3]}-${ru[2]}-${ru[1]}`;
  return s;
}

function parseIntValue(raw) {
  if (raw == null || raw === '') return '';
  const n = Number(String(raw).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? String(Math.round(n)) : '';
}

function normalizePhoneForLink(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.length === 10) return `+7${digits}`;
  return String(raw || '').trim();
}

function csvEscape(value) {
  const str = String(value ?? '');
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

function buildRebookingLink(row) {
  const params = new URLSearchParams();
  const fields = [
    'order',
    'cert',
    'name',
    'phone',
    'people',
    'adults',
    'kids',
    'kid1',
    'kid2',
    'kid3',
    'nights',
    'date',
    'price',
  ];
  fields.forEach((key) => {
    let value = row[key];
    if (key === 'phone') value = normalizePhoneForLink(value);
    if (value != null && String(value).trim() !== '' && !(key === 'kids' && Number(value) === 0)) {
      params.set(key, String(value).trim());
    }
  });
  if (row.deal_id != null && String(row.deal_id).trim() !== '') {
    params.set('dealId', String(row.deal_id).trim());
  }
  Object.entries(UTM).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return `${BASE_URL}?${params.toString()}`;
}

function mapExcelRow(values) {
  const order = String(values[0] || '').trim();
  if (!order) return null;

  const people = parseIntValue(values[6]);
  const childrenRaw = String(values[7] || '').trim();
  const tourists = buildTouristParams({
    people: people !== '' ? people : undefined,
    childrenDetails: childrenRaw,
  });

  return {
    order,
    price: parseIntValue(values[1]),
    name: String(values[3] || '').trim(),
    email: String(values[4] || '').trim(),
    phone: String(values[5] || '').trim(),
    people,
    adults: tourists.adults != null ? String(tourists.adults) : '',
    kids: tourists.kids > 0 ? String(tourists.kids) : '',
    kid1: tourists.kid1 != null ? String(tourists.kid1) : '',
    kid2: tourists.kid2 != null ? String(tourists.kid2) : '',
    kid3: tourists.kid3 != null ? String(tourists.kid3) : '',
    nights: parseIntValue(values[8]),
    date: parseDateToIso(values[9]),
    cert: String(values[10] || '').trim(),
    deal_id: String(values[11] || '').trim(), // dg_key МГТ, не Bitrix ID — для CRM см. import-rebooking-links-bitrix-by-order.mjs
    children_raw: childrenRaw,
    warnings: tourists.warnings.join(';'),
  };
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Укажите путь к Excel: node scripts/generate-krym-all-rebooking-links.mjs file.xlsx');
    process.exit(1);
  }

  const resolvedInput = path.resolve(inputPath);
  if (!fs.existsSync(resolvedInput)) {
    console.error(`Файл не найден: ${resolvedInput}`);
    process.exit(1);
  }

  const baseName = path.basename(resolvedInput, path.extname(resolvedInput));
  const outputDir = path.dirname(resolvedInput);
  const outputPath = path.resolve(
    process.argv[3] || path.join(outputDir, `${baseName}_rebooking_ссылки.csv`)
  );

  const workbook = XLSX.readFile(resolvedInput, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (rows.length <= HEADER_SKIP_ROWS) {
    console.error('В файле нет данных');
    process.exit(1);
  }

  const mapped = [];
  const skipped = [];
  const stats = { noKids: 0, kids1to3: 0, kids4plus: 0, withWarnings: 0, noEmail: 0 };

  for (let i = HEADER_SKIP_ROWS; i < rows.length; i += 1) {
    const values = rows[i].map((cell) => (cell == null ? '' : cell));
    const row = mapExcelRow(values);
    if (!row) {
      skipped.push(i + 1);
      continue;
    }

    if (!row.email) stats.noEmail += 1;
    if (!row.kids) stats.noKids += 1;
    else if (Number(row.kids) <= 3 && !row.warnings.includes('kids_capped_to_3_oldest')) {
      stats.kids1to3 += 1;
    } else {
      stats.kids4plus += 1;
    }
    if (row.warnings) stats.withWarnings += 1;

    mapped.push({
      ...row,
      rebooking_link: buildRebookingLink(row),
    });
  }

  const outHeaders = [
    'order',
    'name',
    'email',
    'phone',
    'deal_id',
    'people',
    'adults',
    'kids',
    'kid1',
    'kid2',
    'kid3',
    'nights',
    'date',
    'price',
    'cert',
    'children_raw',
    'warnings',
    'rebooking_link',
    'utm_campaign',
  ];

  const outLines = [
    outHeaders.join(','),
    ...mapped.map((row) =>
      outHeaders
        .map((key) => {
          if (key === 'utm_campaign') return csvEscape(UTM.utm_campaign);
          return csvEscape(row[key]);
        })
        .join(',')
    ),
  ];

  fs.writeFileSync(outputPath, `\uFEFF${outLines.join('\n')}\n`, 'utf8');

  console.log(`Готово: ${mapped.length} ссылок → ${outputPath}`);
  if (skipped.length) console.log(`Пропущено строк без order: ${skipped.length}`);
  console.log(`Статистика: без детей=${stats.noKids}, 1–3 детей=${stats.kids1to3}, 4+ детей=${stats.kids4plus}`);
  console.log(`Без email: ${stats.noEmail}, с предупреждениями: ${stats.withWarnings}`);
  console.log(`UTM: ${UTM.utm_source} / ${UTM.utm_medium} / ${UTM.utm_campaign}`);
  if (mapped[0]) {
    console.log('\nПример (4+ детей):');
    const sample4 = mapped.find((r) => r.warnings.includes('kids_capped_to_3_oldest')) || mapped[0];
    console.log(sample4.rebooking_link);
  }
}

main();
