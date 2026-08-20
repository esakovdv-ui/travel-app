import fs from 'node:fs';
import path from 'node:path';

export function loadEnvLocal(cwd = process.cwd()) {
  const envPath = path.join(cwd, '.env.local');
  if (!fs.existsSync(envPath)) return;

  for (const rawLine of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key || process.env[key]) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

export function ensureBitrixEnv() {
  process.env.BITRIX_DOMAIN ||= 'crm.mosgortur.ru';
  process.env.WEBHOOK_TOKEN ||= '1981/0ly7df3o8j23eq30';
  process.env.BITRIX_REST_BASE_URL ||= 'https://it.mosgortur.ru/b24catch';
}

function buildBitrixUrl(domain, token, method) {
  const cleanToken = token.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  const cleanMethod = method.replace(/^\/+/, '').replace(/\.json$/i, '');
  const base = process.env.BITRIX_REST_BASE_URL?.trim().replace(/\/+$/, '');
  if (base) return `${base}/${cleanToken}/${cleanMethod}.json`;
  const cleanDomain = domain.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return `https://${cleanDomain}/rest/${cleanToken}/${cleanMethod}.json`;
}

export async function validateBitrixEnv() {
  ensureBitrixEnv();
  const domain = process.env.BITRIX_DOMAIN?.trim();
  const token = process.env.WEBHOOK_TOKEN?.trim();
  if (!domain || !token) {
    throw new Error('misconfigured: задайте BITRIX_DOMAIN и WEBHOOK_TOKEN в .env.local');
  }

  const response = await fetch(buildBitrixUrl(domain, token, 'profile'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    const err = typeof data?.error === 'string' ? data.error : 'unknown';
    const desc = typeof data?.error_description === 'string' ? data.error_description : '';
    throw new Error(`bitrix_error:${err}:${desc}`.slice(0, 240));
  }
  return data.result;
}
