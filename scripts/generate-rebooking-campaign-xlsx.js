#!/usr/bin/env node
/**
 * Генератор CSV для email-рассылки Bitrix из Excel-выгрузки (формат «крым_срочные»).
 *
 * Входные колонки (как в выгрузке):
 *   Номер заявки, ФИО (Б24), Телефон (Б24), Email (Б24), Дата выезда,
 *   Туристов, Стоимость (руб), Б24 ссылка, …
 *
 * Выход: email, name, phone, order, deal_id, date, people, rebooking_link
 *
 * Запуск:
 *   node scripts/generate-rebooking-campaign-xlsx.js "/path/to/file.xlsx" [output.csv]
 *
 * Env:
 *   REBOOKING_BASE_URL — база ссылки (default: online.mosgortur.ru/new/rebooking)
 *   UTM_CAMPAIGN — utm_campaign (default: krym_srochnye_july2026)
 *   UTM_SOURCE — default: email
 *   UTM_MEDIUM — default: newsletter
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const BASE_URL = process.env.REBOOKING_BASE_URL || 'https://online.mosgortur.ru/new/rebooking';
const UTM = {
  utm_source: process.env.UTM_SOURCE || 'email',
  utm_medium: process.env.UTM_MEDIUM || 'newsletter',
  utm_campaign: process.env.UTM_CAMPAIGN || 'krym_srochnye_july2026',
};

const COLUMN_ALIASES = {
  order: ['номер заявки', 'order', 'заявка'],
  name: ['фио (б24)', 'фио', 'name', 'клиент'],
  phone: ['телефон (б24)', 'телефон', 'phone'],
  email: ['email (б24)', 'email', 'e-mail', 'почта'],
  date: ['дата выезда', 'дата', 'date'],
  people: ['туристов', 'people', 'человек'],
  price: ['стоимость (руб)', 'стоимость', 'price', 'бюджет'],
  dealUrl: ['б24 ссылка', 'ссылка б24', 'deal_url', 'сделка'],
  cert: ['сертификат', 'cert'],
  kids: ['детей', 'kids'],
  nights: ['ночей', 'nights'],
};

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function pickColumn(headers, aliases) {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const index = normalized.indexOf(alias);
    if (index >= 0) return index;
  }
  return -1;
}

function parseDateToIso(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const ru = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if (ru) return `${ru[3]}-${ru[2]}-${ru[1]}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return s;
  return s;
}

function parseIntValue(raw) {
  if (raw == null || raw === '') return '';
  const n = Number(String(raw).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? String(Math.round(n)) : '';
}

function extractDealId(url) {
  const match = String(url || '').match(/\/crm\/deal\/details\/(\d+)/i);
  return match ? match[1] : '';
}

function buildRebookingLink(row) {
  const params = new URLSearchParams();
  const fields = ['order', 'cert', 'name', 'people', 'kids', 'kid1', 'kid2', 'kid3', 'nights', 'date'];
  fields.forEach((key) => {
    const value = row[key];
    if (value != null && String(value).trim() !== '') {
      params.set(key, String(value).trim());
    }
  });
  Object.entries(UTM).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return `${BASE_URL}?${params.toString()}`;
}

function csvEscape(value) {
  const str = String(value ?? '');
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

function mapRow(values, columns) {
  const get = (key) => {
    const index = columns[key];
    return index >= 0 ? values[index] : '';
  };

  const order = String(get('order') || '').trim();
  if (!order) return null;

  const email = String(get('email') || '').trim();
  if (!email) return null;

  const dealUrl = String(get('dealUrl') || '').trim();

  return {
    email,
    name: String(get('name') || '').trim(),
    phone: String(get('phone') || '').trim(),
    order,
    deal_id: extractDealId(dealUrl),
    deal_url: dealUrl,
    date: parseDateToIso(get('date')),
    people: parseIntValue(get('people')),
    cert: String(get('cert') || '').trim(),
    kids: parseIntValue(get('kids')),
    nights: parseIntValue(get('nights')),
  };
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Укажите путь к Excel: node scripts/generate-rebooking-campaign-xlsx.js file.xlsx [output.csv]');
    process.exit(1);
  }

  const resolvedInput = path.resolve(inputPath);
  if (!fs.existsSync(resolvedInput)) {
    console.error(`Файл не найден: ${resolvedInput}`);
    process.exit(1);
  }

  const baseName = path.basename(resolvedInput, path.extname(resolvedInput));
  const outputPath = path.resolve(
    process.argv[3] || path.join(path.dirname(resolvedInput), `${baseName}_bitrix_рассылка.csv`)
  );

  const workbook = XLSX.readFile(resolvedInput, { cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (rows.length < 2) {
    console.error('В файле нет данных');
    process.exit(1);
  }

  const headers = rows[0].map((cell) => String(cell));
  const columns = {};
  Object.entries(COLUMN_ALIASES).forEach(([key, aliases]) => {
    columns[key] = pickColumn(headers, aliases);
  });

  if (columns.order < 0) {
    console.error('Не найдена колонка «Номер заявки»');
    process.exit(1);
  }
  if (columns.email < 0) {
    console.error('Не найдена колонка «Email (Б24)»');
    process.exit(1);
  }

  const mapped = [];
  const skipped = [];

  for (let i = 1; i < rows.length; i += 1) {
    const values = rows[i].map((cell) => (cell == null ? '' : cell));
    const row = mapRow(values, columns);
    if (!row) {
      skipped.push(i + 1);
      continue;
    }
    mapped.push({
      ...row,
      rebooking_link: buildRebookingLink(row),
    });
  }

  const outHeaders = [
    'email',
    'name',
    'phone',
    'order',
    'deal_id',
    'deal_url',
    'date',
    'people',
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

  console.log(`Готово: ${mapped.length} строк → ${outputPath}`);
  if (skipped.length) {
    console.log(`Пропущено строк без email/order: ${skipped.length}`);
  }
  console.log(`UTM: ${UTM.utm_source} / ${UTM.utm_medium} / ${UTM.utm_campaign}`);
  if (mapped[0]) {
    console.log('\nПример ссылки:');
    console.log(mapped[0].rebooking_link);
  }
}

main();
