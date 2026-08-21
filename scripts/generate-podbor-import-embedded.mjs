#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REFERENCE_ROWS,
  WIZARD_SHEET_COLUMNS,
  TOURS_SHEET_COLUMNS,
  HOTELS_SHEET_COLUMNS,
} from './lib/podbor-funnel-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = path.join(ROOT, 'storage/podbor-import-embedded.gs');

function loadTsv(name, fallbackHeader) {
  const p = path.join(ROOT, 'storage', name);
  if (!fs.existsSync(p)) return [fallbackHeader];
  return fs.readFileSync(p, 'utf8').trim().split('\n').map((l) => l.split('\t'));
}

const wizard = loadTsv('podbor-funnel-wizard.tsv', WIZARD_SHEET_COLUMNS);
const tours = loadTsv('podbor-funnel-tours.tsv', TOURS_SHEET_COLUMNS);
const hotels = loadTsv('podbor-funnel-hotels.tsv', HOTELS_SHEET_COLUMNS);
const reference = REFERENCE_ROWS;

const out = `function importEmbeddedFunnelData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  function ensure(name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    return sh;
  }
  const wizardSh = ensure('Визард');
  const toursSh = ensure('Туры');
  const hotelsSh = ensure('Отели');
  const refSh = ensure('Справочник');
  ['Воронка', 'Лист1'].forEach(function (name) {
    const old = ss.getSheetByName(name);
    if (old && ss.getSheets().length > 1) ss.deleteSheet(old);
  });
  const wizard = ${JSON.stringify(wizard)};
  const tours = ${JSON.stringify(tours)};
  const hotels = ${JSON.stringify(hotels)};
  const reference = ${JSON.stringify(reference)};
  function fill(sh, rows) {
    sh.clear();
    sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, rows[0].length);
  }
  fill(wizardSh, wizard);
  fill(toursSh, tours);
  fill(hotelsSh, hotels);
  refSh.clear();
  refSh.getRange(1, 1, reference.length, reference[0].length).setValues(reference);
  refSh.autoResizeColumns(1, 4);
}
`;

fs.writeFileSync(outPath, out, 'utf8');
console.log('Wrote', outPath);
