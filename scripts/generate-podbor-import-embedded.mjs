#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REFERENCE_ROWS } from './lib/podbor-funnel-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsvPath = path.join(ROOT, 'storage/podbor-funnel-export.tsv');
const outPath = path.join(ROOT, 'storage/podbor-import-embedded.gs');

const rows = fs.readFileSync(tsvPath, 'utf8').trim().split('\n').map((l) => l.split('\t'));
const reference = REFERENCE_ROWS;

const out = `function importEmbeddedFunnelData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('Воронка');
  if (!sh) sh = ss.insertSheet('Воронка');
  let refSh = ss.getSheetByName('Справочник');
  if (!refSh) refSh = ss.insertSheet('Справочник');
  const old = ss.getSheetByName('Лист1');
  if (old) ss.deleteSheet(old);
  const funnel = ${JSON.stringify(rows)};
  const reference = ${JSON.stringify(reference)};
  sh.clear();
  refSh.clear();
  sh.getRange(1, 1, funnel.length, funnel[0].length).setValues(funnel);
  refSh.getRange(1, 1, reference.length, reference[0].length).setValues(reference);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, funnel[0].length);
  refSh.autoResizeColumns(1, 4);
}
`;

fs.writeFileSync(outPath, out, 'utf8');
console.log('Wrote', outPath);
