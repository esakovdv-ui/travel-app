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


function buildBitrixUrl(domain: string, token: string, method: string): string {
  const cleanDomain = domain.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const cleanToken = token.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  const cleanMethod = method.replace(/^\/+/, '').replace(/\.json$/i, '');
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

async function findContactByPhone(logPrefix: string, phone: string): Promise<number | null> {
  try {
    const result = await bitrixCall<Array<{ ID?: string | number }>>(logPrefix, 'crm.contact.list', {
      filter: { PHONE: phone },
      select: ['ID'],
    });
    const rawId = result?.[0]?.ID;
    const id = typeof rawId === 'number' ? rawId : Number(rawId);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch (error) {
    console.warn(`${logPrefix}: contact list lookup failed for ${phone}`, error);
    return null;
  }
}

async function resolveContactId(
  logPrefix: string,
  name: string,
  phone: string
): Promise<{ contactId: number; contactCreated: boolean }> {
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
    const existingId = await findContactByPhone(logPrefix, phone);
    if (existingId) return { contactId: existingId, contactCreated: false };
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
  bookingPrice?: number;
  source?: string;
  utm?: UtmFields;
};

function formatBookingPrice(price: number): string {
  return `${Math.round(price).toLocaleString('ru-RU')} ₽`;
}

export function parseBookingPrice(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    return Math.round(raw);
  }
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Number(raw.replace(/\s/g, '').replace(',', '.'));
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.round(parsed);
    }
  }
  return undefined;
}

export async function submitCampLead({
  logPrefix,
  landing,
  name,
  phone,
  shift,
  bookingPrice,
  source,
  utm = {},
}: SubmitCampLeadInput) {
  const commentLines = [`Смена: ${shift}`];
  if (bookingPrice != null) {
    commentLines.push(`Цена бронирования: ${formatBookingPrice(bookingPrice)}`);
  }
  if (source?.trim()) {
    commentLines.push(`Источник формы: ${source.trim()}`);
  }
  if (landing === 'vlasevo-promo') {
    commentLines.push('Лендинг: /vlasevo-promo');
  } else if (landing === 'vlasevo') {
    commentLines.push('Лендинг: /vlasevo');
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
