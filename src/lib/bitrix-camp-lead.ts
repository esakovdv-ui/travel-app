export type UtmFields = Partial<
  Record<'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_content' | 'utm_term', string>
>;

export type CampLanding = 'raduga' | 'vlasevo' | 'vlasevo-promo';

const DEAL_CATEGORY_ID = 12;
const DEAL_STAGE_ID = 'C12:NEW';
const ASSIGNED_BY_ID = 1;

const LANDING_TITLES: Record<CampLanding, string> = {
  raduga: 'Радуга',
  vlasevo: 'Власьево',
  'vlasevo-promo': 'Власьево',
};

function clamp(value: unknown, max: number): string {
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

function phoneLookupValues(phone: string): string[] {
  const digits = phone.replace(/\D/g, '');
  const national =
    digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))
      ? digits.slice(1)
      : digits.length === 10
        ? digits
        : digits;
  return [...new Set([phone, `+7${national}`, national, `8${national}`, digits].filter(Boolean))];
}

async function bitrixCall<T = unknown>(
  logPrefix: string,
  method: string,
  payload: Record<string, unknown>
) {
  const domain = process.env.BITRIX_DOMAIN;
  const token = process.env.WEBHOOK_TOKEN;
  if (!domain || !token) throw new Error('misconfigured');
  const url = `https://${domain}/rest/${token}${method}.json`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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

async function findContactByPhoneList(logPrefix: string, phone: string): Promise<number | null> {
  for (const value of phoneLookupValues(phone)) {
    try {
      const result = await bitrixCall<Array<{ ID?: string | number }>>(logPrefix, 'crm.contact.list', {
        filter: { PHONE: value },
        select: ['ID'],
      });
      const rawId = result?.[0]?.ID;
      const id = typeof rawId === 'number' ? rawId : Number(rawId);
      if (Number.isFinite(id) && id > 0) return id;
    } catch (error) {
      console.warn(`${logPrefix}: contact list lookup failed for ${value}`, error);
    }
  }
  return null;
}

async function findContactByPhone(logPrefix: string, phone: string): Promise<number | null> {
  for (const value of phoneLookupValues(phone)) {
    try {
      const result = await bitrixCall<{ CONTACT?: number[] }>(logPrefix, 'crm.duplicate.findbycomm', {
        type: 'PHONE',
        values: [value],
        entity_type: 'CONTACT',
      });
      const id = result?.CONTACT?.[0];
      if (typeof id === 'number') return id;
    } catch (error) {
      console.warn(`${logPrefix}: duplicate lookup failed for ${value}`, error);
    }
  }
  return findContactByPhoneList(logPrefix, phone);
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
        SOURCE_ID: 'WEBFORM',
        ASSIGNED_BY_ID,
      },
    });
    return { contactId, contactCreated: true };
  } catch (error) {
    const fallbackId = await findContactByPhone(logPrefix, phone);
    if (fallbackId) return { contactId: fallbackId, contactCreated: false };
    throw error;
  }
}

export function parseLeadUtm(raw: unknown): UtmFields {
  const utm: UtmFields = {};
  if (!raw || typeof raw !== 'object') return utm;
  const source = raw as Record<string, unknown>;
  (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const).forEach((key) => {
    const value = clamp(source[key], 250);
    if (value) utm[key] = value;
  });
  return utm;
}

export type SubmitCampLeadInput = {
  logPrefix: string;
  landing: CampLanding;
  name: string;
  phone: string;
  shift: string;
  source?: string;
  utm?: UtmFields;
};

export async function submitCampLead({
  logPrefix,
  landing,
  name,
  phone,
  shift,
  source,
  utm = {},
}: SubmitCampLeadInput) {
  const commentLines = [`Смена: ${shift}`];
  if (source?.trim()) {
    commentLines.push(`Источник формы: ${source.trim()}`);
  }
  if (landing === 'vlasevo-promo') {
    commentLines.push('Лендинг: /vlasevo-promo');
  }
  const utmLines = Object.entries(utm).map(([key, value]) => `${key}: ${value}`);
  if (utmLines.length) {
    commentLines.push('', 'UTM:', ...utmLines);
  }
  const comments = commentLines.join('\n');
  const landingTitle = LANDING_TITLES[landing] ?? LANDING_TITLES.vlasevo;

  const { contactId, contactCreated } = await resolveContactId(logPrefix, name, phone);

  const dealFields: Record<string, unknown> = {
    TITLE: `Заявка с лендинга «${landingTitle}» — ${name}`,
    CATEGORY_ID: DEAL_CATEGORY_ID,
    STAGE_ID: DEAL_STAGE_ID,
    TYPE_ID: '1',
    CONTACT_ID: contactId,
    SOURCE_ID: 'WEBFORM',
    ASSIGNED_BY_ID,
    COMMENTS: comments,
  };
  if (utm.utm_source) dealFields.UTM_SOURCE = utm.utm_source;
  if (utm.utm_medium) dealFields.UTM_MEDIUM = utm.utm_medium;
  if (utm.utm_campaign) dealFields.UTM_CAMPAIGN = utm.utm_campaign;
  if (utm.utm_content) dealFields.UTM_CONTENT = utm.utm_content;
  if (utm.utm_term) dealFields.UTM_TERM = utm.utm_term;

  const dealId = await bitrixCall<number>(logPrefix, 'crm.deal.add', { fields: dealFields });

  return { dealId, contactId, contactCreated };
}

export { clamp };

export function mapCampLeadError(message: string): string {
  if (message === 'misconfigured') return message;
  if (message.includes('INVALID_CREDENTIALS')) return 'misconfigured';
  if (message.startsWith('bitrix_error:')) return 'bitrix_error';
  return 'bitrix_error';
}
