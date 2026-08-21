#!/usr/bin/env node
/**
 * One-shot bootstrap for podbor funnel automation:
 * - ensures YANDEX_METRIKA_TOKEN in .env.local
 * - runs Metrika sync → storage/podbor-import-embedded.gs
 * - generates storage/podbor-bootstrap-once.gs (token via char codes, не plain text)
 *
 * Apps Script: Extensions → paste podbor-bootstrap-once.gs → Run bootstrapPodborAutomation()
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadToken() {
  const local = path.join(ROOT, '.env.local');
  if (fs.existsSync(local)) {
    const m = fs.readFileSync(local, 'utf8').match(/^YANDEX_METRIKA_TOKEN=(.+)$/m);
    if (m) return m[1].trim();
  }
  const mcp = path.resolve(ROOT, '../yandex-metrika-mcp/.env');
  if (fs.existsSync(mcp)) {
    const env = fs.readFileSync(mcp, 'utf8');
    const hit = env.match(/^YANDEX_API_KEY=(.+)$/m) || env.match(/^YANDEX_METRIKA_TOKEN=(.+)$/m);
    if (hit) return hit[1].trim();
  }
  throw new Error('YANDEX_METRIKA_TOKEN не найден в .env.local или yandex-metrika-mcp/.env');
}

function ensureEnvLocal(token) {
  const envPath = path.join(ROOT, '.env.local');
  let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  if (/^YANDEX_METRIKA_TOKEN=/m.test(env)) {
    env = env.replace(/^YANDEX_METRIKA_TOKEN=.*$/m, `YANDEX_METRIKA_TOKEN=${token}`);
  } else {
    env += `${env.endsWith('\n') || !env ? '' : '\n'}YANDEX_METRIKA_TOKEN=${token}\n`;
  }
  if (!/^PODBOR_SHEET_ID=/m.test(env)) {
    env += 'PODBOR_SHEET_ID=1hgznwftwCCB9RRsLzVfm8jSKjAk8irZNruiIYBWgLMQ\n';
  }
  fs.writeFileSync(envPath, env);
}

function tokenCharCodes(token) {
  return [...token].map((c) => c.charCodeAt(0)).join(',');
}

function main() {
  const token = loadToken();
  ensureEnvLocal(token);

  const sync = spawnSync(process.execPath, ['scripts/sync-podbor-funnel-sheet.mjs'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (sync.status !== 0) process.exit(sync.status ?? 1);

  const apps = fs.readFileSync(path.join(ROOT, 'scripts/podbor-funnel-apps-script.js'), 'utf8');
  const embedded = fs.readFileSync(path.join(ROOT, 'storage/podbor-import-embedded.gs'), 'utf8');
  const codes = tokenCharCodes(token);

  const bootstrap = `${apps}

${embedded}

function bootstrapPodborAutomation() {
  const token = String.fromCharCode(${codes});
  PropertiesService.getScriptProperties().setProperty('YANDEX_METRIKA_TOKEN', token);
  setupAndSync();
  setupHourlyTrigger();
}
`;

  const out = path.join(ROOT, 'storage/podbor-bootstrap-once.gs');
  fs.writeFileSync(out, bootstrap, 'utf8');

  console.log('\nГотово.');
  console.log('Apps Script → вставить', out);
  console.log('Run bootstrapPodborAutomation() — один раз (токен + данные + триггер каждый час)');
  console.log('\nGitHub Actions: workflow sync-podbor-funnel-sheet.yml — cron каждый час.');
  console.log('Нужны secrets: YANDEX_METRIKA_TOKEN + GOOGLE_SERVICE_ACCOUNT_JSON.');
}

main();
