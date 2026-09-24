#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REFERENCE_ROWS } from './lib/podbor-funnel-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsvPath = path.join(ROOT, 'storage/podbor-funnel-export.tsv');
const outPath = path.join(ROOT, 'storage/podbor-import-embedded.gs');

const rows = fs.existsSync(tsvPath)
  ? fs.readFileSync(tsvPath, 'utf8').trim().split('\n').map((l) => l.split('\t'))
  : [['ВИЗАРД']];
const reference = REFERENCE_ROWS;

const out = `function importEmbeddedFunnelData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('Воронка');
  if (!sh) sh = ss.insertSheet('Воронка');
  let refSh = ss.getSheetByName('Справочник');
  if (!refSh) refSh = ss.insertSheet('Справочник');
  ['Визард', 'Туры', 'Отели', 'Лист1'].forEach(function (name) {
    const old = ss.getSheetByName(name);
    if (old && ss.getSheets().length > 1) ss.deleteSheet(old);
  });
  const funnel = ${JSON.stringify(rows)};
  const reference = ${JSON.stringify(reference)};
  const width = funnel.reduce(function (max, row) { return Math.max(max, row.length); }, 0);
  const padded = funnel.map(function (row) {
    const copy = row.slice();
    while (copy.length < width) copy.push('');
    return copy;
  });
  sh.clear();
  refSh.clear();
  sh.getRange(1, 1, padded.length, width).setValues(padded);
  refSh.getRange(1, 1, reference.length, reference[0].length).setValues(reference);
  sh.setFrozenRows(2);
}
`;

fs.writeFileSync(outPath, out, 'utf8');
console.log('Wrote', outPath);
