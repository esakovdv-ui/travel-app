#!/usr/bin/env node
/**
 * Готовит CSV для импорта получателей в Маркетинг Bitrix24 (вариант B).
 *
 *   node scripts/prepare-bitrix-marketing-csv.mjs [input.csv] [output.csv]
 *
 * Колонки выхода: Email, Name, rebooking_link, order
 * (имена колонок — как ожидает импорт адресов в Bitrix)
 */

import fs from 'node:fs';
import path from 'node:path';

const inputPath =
  process.argv[2] ||
  '/Users/dima/Downloads/крым_срочные_июль_полный_bitrix_рассылка.csv';
const outputPath =
  process.argv[3] ||
  path.join(path.dirname(inputPath), 'крым_bitrix_marketing_import.csv');

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

function csvEscape(value) {
  const str = String(value ?? '');
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

function main() {
  const raw = fs.readFileSync(inputPath, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = Object.fromEntries(headers.map((h, i) => [h, i]));

  const out = ['Email,Name,rebooking_link,order'];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const email = String(cols[idx.email] || '').trim();
    const name = String(cols[idx.name] || '').trim();
    const link = String(cols[idx.rebooking_link] || '').trim();
    const order = String(cols[idx.order] || '').trim();
    if (!email || !link) continue;
    out.push(
      [email, name, link, order].map(csvEscape).join(',')
    );
  }

  fs.writeFileSync(outputPath, `${out.join('\n')}\n`, 'utf8');
  console.log(`Готово: ${out.length - 1} адресов → ${outputPath}`);
}

main();
