import {
  clamp,
  normalizeLeadPhone,
  parseBookingPrice,
  parseLeadUtm,
  type UtmFields,
} from '@/lib/bitrix-camp-lead';

export type RebookingTourInfo = {
  hotel?: string;
  country?: string;
  region?: string;
  dateFrom?: string;
  dateTo?: string;
  nights?: number;
  price?: number;
  placement?: string;
  meal?: string;
  tourvisorOrderId?: string;
  orderTypeName?: string;
  email?: string;
  raw?: Record<string, unknown>;
};

export type RebookingLeadInput = {
  logPrefix: string;
  order: string;
  cert: string;
  name: string;
  phone: string;
  email?: string;
  comment?: string;
  people?: number;
  kids?: number;
  kidAges?: number[];
  price?: number;
  nights?: number;
  date?: string;
  destination?: string;
  tour?: RebookingTourInfo;
  utm?: UtmFields;
};

function buildBitrixUrl(domain: string, token: string, method: string): string {
  const cleanToken = token.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  const cleanMethod = method.replace(/^\/+/, '').replace(/\.json$/i, '');
  const base = (process.env.REBOOKING_BITRIX_REST_BASE_URL || process.env.BITRIX_REST_BASE_URL)
    ?.trim()
    .replace(/\/+$/, '');
  if (base) {
    return `${base}/${cleanToken}/${cleanMethod}.json`;
  }
  const cleanDomain = domain.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return `https://${cleanDomain}/rest/${cleanToken}/${cleanMethod}.json`;
}

async function bitrixCall<T = unknown>(
  logPrefix: string,
  domain: string,
  token: string,
  method: string,
  payload: Record<string, unknown>
) {
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

export function splitFullName(fullName: string): {
  name: string;
  lastName: string;
  secondName: string;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { name: '', lastName: '', secondName: '' };
  if (parts.length === 1) return { name: parts[0], lastName: '', secondName: '' };
  if (parts.length === 2) return { name: parts[1], lastName: parts[0], secondName: '' };
  return {
    lastName: parts[0],
    name: parts[1],
    secondName: parts.slice(2).join(' '),
  };
}

function formatPrice(price: number): string {
  return `${Math.round(price).toLocaleString('ru-RU')} ₽`;
}

function formatComposition(people?: number, kids?: number, kidAges?: number[]): string {
  const adults =
    people != null && kids != null ? Math.max(people - kids, 0) : people != null ? people : undefined;
  const lines: string[] = [];
  if (people != null) lines.push(`Всего человек: ${people}`);
  if (adults != null) lines.push(`Взрослых: ${adults}`);
  if (kids != null) lines.push(`Детей: ${kids}`);
  if (kidAges?.length) {
    kidAges.forEach((age, index) => {
      lines.push(`Возраст ребёнка ${index + 1}: ${age}`);
    });
  }
  return lines.join('\n');
}

function formatTourBlock(tour?: RebookingTourInfo): string[] {
  if (!tour) return [];
  const lines = ['', 'Выбранный тур:'];
  if (tour.hotel) lines.push(`Отель: ${tour.hotel}`);
  if (tour.country) lines.push(`Страна: ${tour.country}`);
  if (tour.region) lines.push(`Курорт: ${tour.region}`);
  if (tour.dateFrom) lines.push(`Дата вылета: ${tour.dateFrom}`);
  if (tour.nights != null) lines.push(`Ночей: ${tour.nights}`);
  if (tour.placement) lines.push(`Размещение: ${tour.placement}`);
  if (tour.meal) lines.push(`Питание: ${tour.meal}`);
  if (tour.price != null) lines.push(`Цена тура: ${formatPrice(tour.price)}`);
  if (tour.orderTypeName) lines.push(`Тип заявки Tourvisor: ${tour.orderTypeName}`);
  if (tour.tourvisorOrderId) lines.push(`Заявка Tourvisor: ${tour.tourvisorOrderId}`);
  return lines;
}

function buildLeadTitle(input: RebookingLeadInput): string {
  const tourLabel =
    input.tour?.hotel ||
    input.tour?.country ||
    input.destination ||
    'новый тур';
  const namePart = input.name?.trim() || 'клиент';
  return `Перебронирование ${input.order} — ${tourLabel} — ${namePart}`;
}

function buildComments(input: RebookingLeadInput): string {
  const lines = [
    'Тип: перебронирование',
    `Заявка: ${input.order}`,
    `Сертификат: ${input.cert || '—'}`,
    `ФИО: ${input.name || '—'}`,
  ];

  const composition = formatComposition(input.people, input.kids, input.kidAges);
  if (composition) {
    lines.push('', 'Исходная поездка:', composition);
  }
  if (input.price != null) lines.push(`Бюджет исходной поездки: ${formatPrice(input.price)}`);
  if (input.nights != null) lines.push(`Дней отдыха (исходные): ${input.nights}`);
  if (input.date) lines.push(`Дата начала (исходная): ${input.date}`);
  if (input.destination) lines.push(`Выбранное направление: ${input.destination}`);

  lines.push(...formatTourBlock(input.tour));

  if (input.comment?.trim()) {
    lines.push('', `Комментарий: ${input.comment.trim()}`);
  }
  lines.push('', 'Источник: /rebooking');

  const utmLines = Object.entries(input.utm ?? {}).map(([key, value]) => `${key}: ${value}`);
  if (utmLines.length) {
    lines.push('', 'UTM:', ...utmLines);
  }

  return lines.join('\n');
}

function getRebookingConfig() {
  const domain =
    process.env.REBOOKING_BITRIX_DOMAIN?.trim() ||
    process.env.BITRIX_DOMAIN?.trim() ||
    'crm.mosgortur.ru';
  const token =
    process.env.REBOOKING_WEBHOOK_TOKEN?.trim() ||
    '1981/j9pvdbhovvem7j6c';
  if (!domain || !token) throw new Error('misconfigured');
  return { domain, token };
}

export async function submitRebookingLead(input: RebookingLeadInput) {
  const { domain, token } = getRebookingConfig();
  const { name, lastName, secondName } = splitFullName(input.name || 'Клиент');

  const fields: Record<string, unknown> = {
    TITLE: buildLeadTitle(input),
    NAME: name || 'Клиент',
    LAST_NAME: lastName,
    PHONE: [{ VALUE: input.phone, VALUE_TYPE: 'WORK' }],
    COMMENTS: buildComments(input),
    SOURCE_ID: 'WEB',
    UF_CRM_LEAD_TYPE: 'rebooking',
  };

  if (secondName) fields.SECOND_NAME = secondName;
  const email = input.email?.trim() || input.tour?.email?.trim();
  if (email) fields.EMAIL = [{ VALUE: email, VALUE_TYPE: 'WORK' }];
  if (input.tour?.price != null) {
    fields.OPPORTUNITY = Math.round(input.tour.price);
    fields.CURRENCY_ID = 'RUB';
  }
  if (input.utm?.utm_source) fields.UTM_SOURCE = input.utm.utm_source;
  if (input.utm?.utm_medium) fields.UTM_MEDIUM = input.utm.utm_medium;
  if (input.utm?.utm_campaign) fields.UTM_CAMPAIGN = input.utm.utm_campaign;
  if (input.utm?.utm_content) fields.UTM_CONTENT = input.utm.utm_content;
  if (input.utm?.utm_term) fields.UTM_TERM = input.utm.utm_term;

  try {
    const leadId = await bitrixCall<number>(input.logPrefix, domain, token, 'crm.lead.add', {
      fields,
    });
    return { leadId };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!message.includes('UF_CRM_LEAD_TYPE')) throw error;

    const { UF_CRM_LEAD_TYPE: _removed, ...fieldsWithoutCustom } = fields;
    const leadId = await bitrixCall<number>(input.logPrefix, domain, token, 'crm.lead.add', {
      fields: fieldsWithoutCustom,
    });
    return { leadId };
  }
}

export function parseTourFromBody(raw: unknown): RebookingTourInfo | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const source = raw as Record<string, unknown>;
  const tour: RebookingTourInfo = {
    hotel: clamp(source.hotel, 300) || clamp(source.hotelname, 300) || undefined,
    country: clamp(source.country, 120) || undefined,
    region: clamp(source.region, 120) || clamp(source.resort, 120) || undefined,
    dateFrom: clamp(source.dateFrom, 30) || clamp(source.flydate, 30) || clamp(source.date, 30) || undefined,
    dateTo: clamp(source.dateTo, 30) || undefined,
    placement: clamp(source.placement, 200) || undefined,
    meal: clamp(source.meal, 120) || undefined,
    orderTypeName: clamp(source.orderTypeName, 120) || clamp(source.typename, 120) || undefined,
    email: clamp(source.email, 200) || undefined,
    tourvisorOrderId:
      clamp(source.tourvisorOrderId, 40) || clamp(source.orderId, 40) || clamp(source.id, 40) || undefined,
  };
  const nights = parsePositiveInt(source.nights);
  if (nights != null) tour.nights = nights;
  const price = parseBookingPrice(source.price ?? source.tourPrice);
  if (price != null) tour.price = price;
  if (source.raw && typeof source.raw === 'object') {
    tour.raw = source.raw as Record<string, unknown>;
  }
  const hasData = Object.entries(tour).some(([key, value]) => key !== 'raw' && value != null);
  return hasData ? tour : undefined;
}

export function parseKidAges(body: Record<string, unknown>, kids: number): number[] {
  const ages: number[] = [];
  for (let i = 1; i <= Math.min(kids, 3); i += 1) {
    const raw = body[`kid${i}`];
    const age =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string' && raw.trim()
          ? Number(raw.trim())
          : NaN;
    if (Number.isFinite(age) && age >= 0 && age <= 15) ages.push(Math.round(age));
  }
  return ages;
}

export function parsePositiveInt(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return Math.round(raw);
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Number(raw.trim());
    if (Number.isFinite(parsed) && parsed >= 0) return Math.round(parsed);
  }
  return undefined;
}

export function mapRebookingLeadError(message: string): string {
  if (message === 'misconfigured') return message;
  if (message.includes('INVALID_CREDENTIALS')) return 'misconfigured';
  if (message.startsWith('bitrix_error:')) return 'bitrix_error';
  return 'bitrix_error';
}

export { clamp, normalizeLeadPhone, parseBookingPrice, parseLeadUtm };
