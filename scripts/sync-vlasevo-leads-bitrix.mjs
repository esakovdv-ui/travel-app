#!/usr/bin/env node
/**
 * Sync pending vlasevo leads to Bitrix. Intended to run on GitHub Actions
 * (external network) when the VPS cannot reach crm.mosgortur.ru directly.
 */
import fs from 'node:fs';
import path from 'node:path';

const DEAL_CATEGORY_ID = 22;
const DEAL_STAGE_ID = 'C22:NEW';
const ASSIGNED_BY_ID = 1;

const LANDING_TITLES = {
  raduga: 'Радуга',
  vlasevo: 'Власьево',
  'vlasevo-promo': 'Власьево',
};
const DUPLICATE_WINDOW_MS = 48 * 60 * 60 * 1000;

function buildBitrixUrl(domain, token, method) {
  const cleanToken = token.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  const cleanMethod = method.replace(/^\/+/, '').replace(/\.json$/i, '');
  const base = process.env.BITRIX_REST_BASE_URL?.trim().replace(/\/+$/, '');
  if (base) {
    return `${base}/${cleanToken}/${cleanMethod}.json`;
  }
  const cleanDomain = domain.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return `https://${cleanDomain}/rest/${cleanToken}/${cleanMethod}.json`;
}

async function bitrixCall(method, payload) {
  const domain = process.env.BITRIX_DOMAIN || 'crm.mosgortur.ru';
  const token = process.env.WEBHOOK_TOKEN;
  if (!token) throw new Error('misconfigured: WEBHOOK_TOKEN');

  const response = await fetch(buildBitrixUrl(domain, token, method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    const err = typeof data?.error === 'string' ? data.error : 'unknown';
    throw new Error(`bitrix_error:${err}`);
  }
  return data.result;
}

async function findContactByPhone(phone) {
  try {
    const result = await bitrixCall('crm.contact.list', {
      filter: { PHONE: phone },
      select: ['ID'],
    });
    const rawId = result?.[0]?.ID;
    const id = typeof rawId === 'number' ? rawId : Number(rawId);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

async function resolveContactId(name, phone) {
  try {
    const contactId = await bitrixCall('crm.contact.add', {
      fields: {
        NAME: name,
        PHONE: [{ VALUE: phone, VALUE_TYPE: 'WORK' }],
        SOURCE_ID: 'WEBFORM',
        ASSIGNED_BY_ID,
      },
    });
    return { contactId, contactCreated: true };
  } catch (error) {
    const existingId = await findContactByPhone(phone);
    if (existingId) return { contactId: existingId, contactCreated: false };
    throw error;
  }
}

function buildLeadComments(lead) {
  const commentLines = [`Смена: ${lead.shift}`];
  if (lead.bookingPrice != null) {
    commentLines.push(`Цена бронирования: ${Math.round(lead.bookingPrice).toLocaleString('ru-RU')} ₽`);
  }
  if (lead.source?.trim()) commentLines.push(`Источник формы: ${lead.source.trim()}`);
  if (lead.landing === 'vlasevo-promo') commentLines.push('Лендинг: /vlasevo-promo');
  else if (lead.landing === 'vlasevo') commentLines.push('Лендинг: /vlasevo');
  if (lead.utm && typeof lead.utm === 'object') {
    const utmLines = Object.entries(lead.utm).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
    if (utmLines.length) commentLines.push('', 'UTM:', ...utmLines);
  }
  return commentLines.join('\n');
}

function buildDealFields(lead, contactId) {
  const landingTitle = LANDING_TITLES[lead.landing] ?? LANDING_TITLES.vlasevo;
  const dealFields = {
    TITLE: `Заявка с лендинга «${landingTitle}» — ${lead.name}`,
    COMMENTS: buildLeadComments(lead),
    UTM_SOURCE: lead.utm?.utm_source ?? '',
    UTM_MEDIUM: lead.utm?.utm_medium ?? '',
    UTM_CAMPAIGN: lead.utm?.utm_campaign ?? '',
    UTM_CONTENT: lead.utm?.utm_content ?? '',
    UTM_TERM: lead.utm?.utm_term ?? '',
  };
  if (contactId) dealFields.CONTACT_ID = contactId;
  return dealFields;
}

async function submitLeadToBitrix(lead) {
  const { contactId } = await resolveContactId(lead.name, lead.phone);

  const dealFields = {
    ...buildDealFields(lead, contactId),
    CATEGORY_ID: DEAL_CATEGORY_ID,
    STAGE_ID: DEAL_STAGE_ID,
    TYPE_ID: '1',
    SOURCE_ID: 'WEBFORM',
    ASSIGNED_BY_ID,
  };

  const dealId = await bitrixCall('crm.deal.add', { fields: dealFields });
  return { dealId, contactId };
}

async function updateLeadInBitrix(lead, dealId) {
  await bitrixCall('crm.deal.update', {
    id: dealId,
    fields: buildDealFields(lead),
  });
  const contactId = await findContactByPhone(lead.phone);
  return { dealId, contactId };
}

async function syncLeadToBitrix(lead) {
  if (lead.bitrixDealId) {
    return updateLeadInBitrix(lead, lead.bitrixDealId);
  }
  return submitLeadToBitrix(lead);
}

function isRecentEnough(createdAt, now = Date.now()) {
  const createdAtMs = Date.parse(createdAt);
  return Number.isFinite(createdAtMs) && now - createdAtMs >= 0 && now - createdAtMs <= DUPLICATE_WINDOW_MS;
}

function preferLeadForDedup(currentBest, candidate) {
  if (!currentBest) return candidate;
  if (candidate.bitrixDealId && !currentBest.bitrixDealId) return candidate;
  if (!candidate.bitrixDealId && currentBest.bitrixDealId) return currentBest;
  return Date.parse(candidate.createdAt) > Date.parse(currentBest.createdAt) ? candidate : currentBest;
}

function findRecentDuplicateLead(leads, targetLead) {
  let bestMatch = null;
  for (const lead of leads) {
    if (lead.id === targetLead.id) continue;
    if (lead.phone !== targetLead.phone || lead.shift !== targetLead.shift) continue;
    if (!isRecentEnough(lead.createdAt)) continue;
    bestMatch = preferLeadForDedup(bestMatch, lead);
  }
  return bestMatch;
}

function mergeLeadData(baseLead, incomingLead) {
  return {
    ...baseLead,
    name: incomingLead.name || baseLead.name,
    landing: incomingLead.landing ?? baseLead.landing,
    bookingPrice: incomingLead.bookingPrice ?? baseLead.bookingPrice,
    source: incomingLead.source ?? baseLead.source,
    utm:
      incomingLead.utm && typeof incomingLead.utm === 'object'
        ? { ...(baseLead.utm ?? {}), ...incomingLead.utm }
        : baseLead.utm,
    qualification: {
      ...(baseLead.qualification ?? {}),
      ...(incomingLead.qualification ?? {}),
    },
  };
}

function readLeads(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function main() {
  const filePath = process.argv[2] || path.join(process.cwd(), 'storage/vlasevo-leads.json');
  const leads = readLeads(filePath);
  const pending = leads.filter((lead) => lead.bitrixStatus !== 'sent');

  if (pending.length === 0) {
    console.log('No pending leads to sync.');
    return;
  }

  console.log(`Syncing ${pending.length} lead(s) via ${process.env.BITRIX_DOMAIN || 'crm.mosgortur.ru'}...`);
  let synced = 0;
  let failed = 0;

  for (const lead of leads) {
    if (lead.bitrixStatus === 'sent') continue;
    try {
      const duplicateLead = findRecentDuplicateLead(leads, lead);
      const leadForSync = duplicateLead ? mergeLeadData(duplicateLead, lead) : lead;
      const inheritedDealId = lead.bitrixDealId ?? duplicateLead?.bitrixDealId;
      const inheritedContactId = lead.bitrixContactId ?? duplicateLead?.bitrixContactId;
      const result = await syncLeadToBitrix({
        ...leadForSync,
        bitrixDealId: inheritedDealId,
      });
      lead.bitrixStatus = 'sent';
      lead.bitrixDealId = result.dealId ?? inheritedDealId;
      lead.bitrixContactId = result.contactId ?? inheritedContactId;
      delete lead.bitrixError;
      if (duplicateLead && duplicateLead.id !== lead.id) {
        duplicateLead.bitrixStatus = 'sent';
        duplicateLead.bitrixDealId = lead.bitrixDealId;
        duplicateLead.bitrixContactId = lead.bitrixContactId;
        duplicateLead.name = leadForSync.name;
        duplicateLead.landing = leadForSync.landing;
        duplicateLead.bookingPrice = leadForSync.bookingPrice;
        duplicateLead.source = leadForSync.source;
        duplicateLead.utm = leadForSync.utm;
        duplicateLead.qualification = leadForSync.qualification;
        delete duplicateLead.bitrixError;
      }
      synced += 1;
      console.log(`OK ${lead.id} -> deal ${lead.bitrixDealId}`);
    } catch (error) {
      lead.bitrixStatus = 'failed';
      lead.bitrixError = (error instanceof Error ? error.message : 'unknown').slice(0, 240);
      failed += 1;
      console.error(`FAIL ${lead.id}: ${lead.bitrixError}`);
    }
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(leads, null, 2)}\n`, 'utf8');
  console.log(`Done. synced=${synced} failed=${failed}`);
  if (failed > 0 && synced === 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
