#!/usr/bin/env node
/**
 * Генератор ссылок на /rebooking из CSV.
 *
 * Формат input.csv:
 * order,cert,name,people,kids,kid1,kid2,kid3,price,nights,date
 *
 * Запуск: node scripts/generate-rebooking-links.js [input.csv] [output.csv]
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.REBOOKING_BASE_URL || 'https://online.mosgortur.ru/new/rebooking';

const inputPath = process.argv[2] || path.join(process.cwd(), 'input-rebooking.csv');
const outputPath = process.argv[3] || path.join(process.cwd(), 'output-rebooking-links.csv');

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

function buildLink(row) {
  const params = new URLSearchParams();
  const fields = [
    'order',
    'cert',
    'name',
    'people',
    'kids',
    'kid1',
    'kid2',
    'kid3',
    'nights',
    'date',
  ];
  fields.forEach((key) => {
    const value = row[key];
    if (value != null && String(value).trim() !== '') {
      params.set(key, String(value).trim());
    }
  });
  return `${BASE_URL}?${params.toString()}`;
}

function main() {
  if (!fs.existsSync(inputPath)) {
    console.error(`Файл не найден: ${inputPath}`);
    console.error('Создайте CSV с колонками: order,cert,name,people,kids,kid1,kid2,kid3,price,nights,date');
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    console.error('CSV должен содержать заголовок и хотя бы одну строку данных');
    process.exit(1);
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    if (!row.order && !row.name) continue;
    rows.push({
      ...row,
      link: buildLink(row),
    });
  }

  const outHeaders = [...headers, 'link'];
  const outLines = [
    outHeaders.join(','),
    ...rows.map((row) =>
      outHeaders
        .map((key) => {
          const val = row[key] ?? '';
          const str = String(val);
          return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        })
        .join(',')
    ),
  ];

  fs.writeFileSync(outputPath, outLines.join('\n') + '\n', 'utf8');
  console.log(`Готово: ${rows.length} ссылок → ${outputPath}`);
}

main();
