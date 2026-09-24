/**
 * Bitrix deal from podbor wizard contact form → category/12 (same funnel as camp leads).
 * Does not reuse camp-specific deal fields.
 */

export type PodborLeadUtm = Partial<
  Record<'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_content' | 'utm_term', string>
>;

export type PodborLeadAnswers = {
  adults?: number;
  kids?: number;
  kidsAges?: number[];
  budget?: number;
  budgetCustom?: boolean;
  format?: 'tour' | 'hotel' | null;
  region?: string | null;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  handoffUrl?: string;
};

const DEAL_CATEGORY_ID = 12;
const DEAL_STAGE_ID = 'C12:NEW';
const DEFAULT_ASSIGNED_BY_ID = 1;
/** Same funnel as camps; filter by TITLE prefix / UTM until custom SOURCE_ID is set in CRM. */
const DEFAULT_SOURCE_ID = 'WEBFORM';
export const PODBOR_LEAD_DUPLICATE_WINDOW_MS = 48 * 60 * 60 * 1000;

const REGION_LABELS: Record<string, string> = {
  sea: 'У моря',
  podmos: 'Подмосковье',
  spb: 'Санкт-Петербург',
  kaliningrad: 'Калининград',
  kazan: 'Казань',
  other: 'Другой регион',
  any: 'Пока не знаю',
  karelia: 'Карелия',
  kaluga: 'Калуга',
  altai: 'Алтай',
  yaroslavl: 'Ярославль',
  nnovgorod: 'Нижний Новгород',
  vladimir: 'Владимир',
};

export function clamp(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function normalizeLeadPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `+7${digits}`;
  }
  return null;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `+7***${digits.slice(-4)}`;
}

function assignedById(): number {
  const raw = process.env.PODBOR_BITRIX_ASSIGNED_BY_ID?.trim();
  const n = raw ? Number(raw) : DEFAULT_ASSIGNED_BY_ID;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_ASSIGNED_BY_ID;
}

function sourceId(): string {
  return process.env.PODBOR_BITRIX_SOURCE_ID?.trim() || DEFAULT_SOURCE_ID;
}

function buildBitrixUrl(domain: string, token: string, method: string): string {
  const cleanToken = token.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  const cleanMethod = method.replace(/^\/+/, '').replace(/\.json$/i, '');
  const base = process.env.BITRIX_REST_BASE_URL?.trim().replace(/\/+$/, '');
  if (base) {
    return `${base}/${cleanToken}/${cleanMethod}.json`;
  }
  const cleanDomain = domain.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return `https://${cleanDomain}/rest/${cleanToken}/${cleanMethod}.json`;
}

async function bitrixCall<T = unknown>(
  logPrefix: string,
  method: string,
  payload: Record<string, unknown>
) {
  const domain = process.env.BITRIX_DOMAIN;
  const token = process.env.WEBHOOK_TOKEN;
  if (!domain || !token) throw new Error('misconfigured');
  const url = buildBitrixUrl(domain, token, method);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(25000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    const bitrixError = typeof data?.error === 'string' ? data.error : 'unknown';
    const bitrixDescription =
      typeof data?.error_description === 'string' ? data.error_description : '';
    console.error(`${logPrefix}: ${method} failed`, data);
    throw new Error(`bitrix_error:${bitrixError}:${bitrixDescription}`.slice(0, 240));
  }
  return data.result as T;
}

async function findContactIdsByPhone(logPrefix: string, phone: string): Promise<number[]> {
  try {
    const result = await bitrixCall<Array<{ ID?: string | number }>>(logPrefix, 'crm.contact.list', {
      filter: { PHONE: phone },
      select: ['ID'],
    });
    return (result ?? [])
      .map((item) => (typeof item.ID === 'number' ? item.ID : Number(item.ID)))
      .filter((id) => Number.isFinite(id) && id > 0);
  } catch (error) {
    console.warn(`${logPrefix}: contact list lookup failed for ${maskPhone(phone)}`, error);
    return [];
  }
}

async function findContactByPhone(logPrefix: string, phone: string): Promise<number | null> {
  const ids = await findContactIdsByPhone(logPrefix, phone);
  return ids[0] ?? null;
}

function isPodborDealTitle(title: string): boolean {
  return title.trim().toLowerCase().startsWith('подбор:');
}

async function findRecentOpenPodborDeal(
  logPrefix: string,
  phone: string
): Promise<number | null> {
  const contactIds = await findContactIdsByPhone(logPrefix, phone);
  if (!contactIds.length) return null;

  const now = Date.now();
  let bestDealId: number | null = null;
  let bestCreatedAt = 0;

  for (const contactId of contactIds) {
    try {
      const result = await bitrixCall<
        Array<{
          ID?: string | number;
          TITLE?: string;
          STAGE_SEMANTIC_ID?: string;
          DATE_CREATE?: string;
        }>
      >(logPrefix, 'crm.deal.list', {
        filter: { CONTACT_ID: contactId, CATEGORY_ID: DEAL_CATEGORY_ID },
        select: ['ID', 'TITLE', 'STAGE_SEMANTIC_ID', 'DATE_CREATE'],
        order: { DATE_CREATE: 'DESC' },
      });

      for (const deal of result ?? []) {
        if (!isPodborDealTitle(deal.TITLE ?? '')) continue;
        const semantic = deal.STAGE_SEMANTIC_ID ?? '';
        if (semantic === 'S' || semantic === 'F') continue;

        const createdAt = Date.parse(deal.DATE_CREATE ?? '');
        if (!Number.isFinite(createdAt) || now - createdAt > PODBOR_LEAD_DUPLICATE_WINDOW_MS) {
          continue;
        }

        const id = typeof deal.ID === 'number' ? deal.ID : Number(deal.ID);
        if (!Number.isFinite(id) || id <= 0) continue;
        if (createdAt >= bestCreatedAt) {
          bestCreatedAt = createdAt;
          bestDealId = id;
        }
      }
    } catch (error) {
      console.warn(`${logPrefix}: open deal lookup failed for contact ${contactId}`, error);
    }
  }

  return bestDealId;
}

async function resolveContactId(
  logPrefix: string,
  name: string,
  phone: string
): Promise<{ contactId: number; contactCreated: boolean }> {
  const existingId = await findContactByPhone(logPrefix, phone);
  if (existingId) return { contactId: existingId, contactCreated: false };

  try {
    const contactId = await bitrixCall<number>(logPrefix, 'crm.contact.add', {
      fields: {
        NAME: name,
        PHONE: [{ VALUE: phone, VALUE_TYPE: 'WORK' }],
        SOURCE_ID: sourceId(),
        ASSIGNED_BY_ID: assignedById(),
      },
    });
    return { contactId, contactCreated: true };
  } catch (error) {
    const fallbackId = await findContactByPhone(logPrefix, phone);
    if (fallbackId) return { contactId: fallbackId, contactCreated: false };
    throw error;
  }
}

export function parseLeadUtm(raw: unknown): PodborLeadUtm {
  const utm: PodborLeadUtm = {};
  if (!raw || typeof raw !== 'object') return utm;
  const source = raw as Record<string, unknown>;
  (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const).forEach(
    (key) => {
      const value = clamp(source[key], 250);
      if (value) utm[key] = value;
    }
  );
  return utm;
}

function formatBudget(budget?: number): string {
  if (typeof budget !== 'number' || !Number.isFinite(budget)) return '—';
  return `${Math.round(budget).toLocaleString('ru-RU')} ₽`;
}

function formatPeople(answers: PodborLeadAnswers): string {
  const adults = answers.adults ?? 0;
  const kids = answers.kids ?? 0;
  const ages =
    Array.isArray(answers.kidsAges) && answers.kidsAges.length
      ? ` (возраст: ${answers.kidsAges.join(', ')})`
      : '';
  if (!adults && !kids) return '—';
  const a = adults === 1 ? '1 взрослый' : `${adults} взрослых`;
  if (!kids) return a;
  const k = kids === 1 ? '1 ребёнок' : kids < 5 ? `${kids} ребёнка` : `${kids} детей`;
  return `${a}, ${k}${ages}`;
}

function formatLabel(format?: string | null): string {
  if (format === 'hotel') return 'Отель';
  if (format === 'tour') return 'Тур';
  return '—';
}

function regionLabel(region?: string | null): string {
  if (!region) return '—';
  return REGION_LABELS[region] ?? region;
}

export function buildPodborDealTitle(name: string, answers: PodborLeadAnswers): string {
  const format = formatLabel(answers.format);
  const region = regionLabel(answers.region);
  const dates =
    answers.checkIn && answers.checkOut
      ? `${answers.checkIn}–${answers.checkOut}`
      : answers.nights
        ? `${answers.nights} н.`
        : 'даты не указаны';
  return `Подбор: ${format}, ${region}, ${dates} — ${name}`.slice(0, 250);
}

export function buildPodborDealComments({
  answers,
  utm = {},
  sessionId,
}: {
  answers: PodborLeadAnswers;
  utm?: PodborLeadUtm;
  sessionId?: string;
}): string {
  const lines = [
    'Источник: визард подбора motrip.ru/podbor',
    `Кто едет: ${formatPeople(answers)}`,
    `Бюджет: ${formatBudget(answers.budget)}${answers.budgetCustom ? ' (своя сумма)' : ''}`,
    `Формат: ${formatLabel(answers.format)}`,
    `Куда: ${regionLabel(answers.region)}`,
    `Даты: ${answers.checkIn || '—'} — ${answers.checkOut || '—'}`,
    `Ночей: ${answers.nights ?? '—'}`,
  ];
  if (answers.handoffUrl) {
    lines.push(`URL выдачи: ${answers.handoffUrl}`);
  }
  if (sessionId) {
    lines.push(`sessionId: ${sessionId}`);
  }
  lines.push('', 'SLA: связаться через 2–4 часа, если нет самостоятельной оплаты.');

  const utmLines = Object.entries(utm).map(([key, value]) => `${key}: ${value}`);
  if (utmLines.length) {
    lines.push('', 'UTM:', ...utmLines);
  }
  return lines.join('\n');
}

export type SubmitPodborLeadInput = {
  logPrefix?: string;
  name: string;
  phone: string;
  answers?: PodborLeadAnswers;
  utm?: PodborLeadUtm;
  sessionId?: string;
};

export async function submitPodborLead({
  logPrefix = 'podbor-lead',
  name,
  phone,
  answers = {},
  utm = {},
  sessionId,
}: SubmitPodborLeadInput) {
  const dealUtm: PodborLeadUtm = {
    utm_source: utm.utm_source || 'podbor_wizard',
    utm_medium: utm.utm_medium || 'wizard',
    ...(utm.utm_campaign ? { utm_campaign: utm.utm_campaign } : {}),
    ...(utm.utm_content ? { utm_content: utm.utm_content } : {}),
    ...(utm.utm_term ? { utm_term: utm.utm_term } : {}),
  };

  const duplicateId = await findRecentOpenPodborDeal(logPrefix, phone);
  if (duplicateId) {
    console.info(
      `${logPrefix}: duplicate open deal ${duplicateId} for ${maskPhone(phone)}, skip create`
    );
    return { dealId: duplicateId, contactId: null as number | null, contactCreated: false, duplicate: true };
  }

  const { contactId, contactCreated } = await resolveContactId(logPrefix, name, phone);

  const dealFields: Record<string, unknown> = {
    TITLE: buildPodborDealTitle(name, answers),
    COMMENTS: buildPodborDealComments({ answers, utm: dealUtm, sessionId }),
    CATEGORY_ID: DEAL_CATEGORY_ID,
    STAGE_ID: DEAL_STAGE_ID,
    TYPE_ID: '1',
    CONTACT_ID: contactId,
    SOURCE_ID: sourceId(),
    ASSIGNED_BY_ID: assignedById(),
    UTM_SOURCE: dealUtm.utm_source ?? '',
    UTM_MEDIUM: dealUtm.utm_medium ?? '',
    UTM_CAMPAIGN: dealUtm.utm_campaign ?? '',
    UTM_CONTENT: dealUtm.utm_content ?? '',
    UTM_TERM: dealUtm.utm_term ?? '',
  };

  const dealId = await bitrixCall<number>(logPrefix, 'crm.deal.add', { fields: dealFields });
  console.info(
    `${logPrefix}: deal ${dealId} contact ${contactId} created=${contactCreated} phone=${maskPhone(phone)}`
  );

  return { dealId, contactId, contactCreated, duplicate: false };
}

export function mapPodborLeadError(message: string): string {
  if (message === 'misconfigured') return message;
  if (message.includes('INVALID_CREDENTIALS')) return 'misconfigured';
  if (message.startsWith('bitrix_error:')) return 'bitrix_error';
  return 'bitrix_error';
}

export function parsePodborLeadAnswers(raw: unknown): PodborLeadAnswers {
  if (!raw || typeof raw !== 'object') return {};
  const source = raw as Record<string, unknown>;
  const answers: PodborLeadAnswers = {};

  if (typeof source.adults === 'number' && Number.isFinite(source.adults)) {
    answers.adults = Math.min(6, Math.max(1, Math.round(source.adults)));
  }
  if (typeof source.kids === 'number' && Number.isFinite(source.kids)) {
    answers.kids = Math.min(4, Math.max(0, Math.round(source.kids)));
  }
  if (Array.isArray(source.kidsAges)) {
    answers.kidsAges = source.kidsAges
      .map((age) => (typeof age === 'number' && Number.isFinite(age) ? Math.round(age) : null))
      .filter((age): age is number => age != null && age >= 0 && age <= 17)
      .slice(0, 4);
  }
  if (typeof source.budget === 'number' && Number.isFinite(source.budget) && source.budget > 0) {
    answers.budget = Math.round(source.budget);
  }
  if (typeof source.budgetCustom === 'boolean') answers.budgetCustom = source.budgetCustom;
  if (source.format === 'tour' || source.format === 'hotel' || source.format === null) {
    answers.format = source.format;
  }
  if (typeof source.region === 'string' || source.region === null) {
    answers.region = source.region === null ? null : clamp(source.region, 40);
  }
  if (typeof source.checkIn === 'string') answers.checkIn = clamp(source.checkIn, 40);
  if (typeof source.checkOut === 'string') answers.checkOut = clamp(source.checkOut, 40);
  if (typeof source.nights === 'number' && Number.isFinite(source.nights) && source.nights > 0) {
    answers.nights = Math.round(source.nights);
  }
  if (typeof source.handoffUrl === 'string') answers.handoffUrl = clamp(source.handoffUrl, 2000);

  return answers;
}
