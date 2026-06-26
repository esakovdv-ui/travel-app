#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const SHIFT_IDS = ['dream-14-23', 'dream-14-03', 'talents-25-03', 'together-23-30'];
const UTM = 'utm_source=email&utm_medium=newsletter&utm_campaign=vlasevo_june_2026';

async function loadShifts() {
  const response = await fetch('https://motrip.ru/api/vlasevo-promo-shifts', { cache: 'no-store' });
  if (!response.ok) throw new Error(`API ${response.status}`);
  const data = await response.json();
  const shifts = Array.isArray(data) ? data : data.shifts;
  const byId = Object.fromEntries(shifts.map((shift) => [shift.id, shift]));
  for (const id of SHIFT_IDS) {
    if (!byId[id]?.url) throw new Error(`Missing shift url for ${id}`);
  }
  return byId;
}

function emailHref(baseUrl, content) {
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}${UTM}&utm_content=${content}`.replace(/&/g, '&amp;');
}

function syncFile(filePath, byId) {
  let html = readFileSync(filePath, 'utf8');
  for (const id of SHIFT_IDS) {
    const url = byId[id].url;
    for (const content of [`shift_${id}_btn`, `shift_${id}`]) {
      const basketHref = emailHref(url, content);
      const landingPattern = new RegExp(
        `https://online\\.mosgortur\\.ru/new/vlasevo-promo\\?${UTM.replace(/&/g, '&amp;')}&amp;utm_content=${content}(?:#lead-form)?`,
        'g',
      );
      html = html.replace(landingPattern, basketHref);
    }
    html = html.replace(
      new RegExp(`(utm_content=shift_${id}_btn)#lead-form`, 'g'),
      '$1',
    );
  }
  writeFileSync(filePath, html);
}

const byId = await loadShifts();
const targets = [
  path.join(root, 'public/email/vlasevo.html'),
  path.join(root, '../Власьево.html'),
];

for (const filePath of targets) {
  syncFile(filePath, byId);
  console.log('Updated', filePath);
}
