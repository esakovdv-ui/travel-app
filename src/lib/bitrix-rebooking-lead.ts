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
  /** Телефон из письма / ссылки рассылки (оригинал из таблицы). */
  sourcePhone?: string;
  email?: string;
  /** ID исходной сделки B2C из таблицы рассылки. */
  dealId?: string;
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

type RebookingTripContext = Pick<
  RebookingLeadInput,
  | 'order'
  | 'cert'
  | 'name'
  | 'sourcePhone'
  | 'phone'
  | 'email'
  | 'dealId'
  | 'people'
  | 'kids'
  | 'kidAges'
  | 'price'
  | 'nights'
  | 'date'
  | 'comment'
  | 'utm'
>;

function formatPhoneLines(input: { sourcePhone?: string; phone?: string }): string[] {
  const lines: string[] = [];
  const source = input.sourcePhone?.trim();
  const tour = input.phone?.trim();
  if (source) lines.push(`Телефон (из письма): ${source}`);
  if (tour && tour !== source) lines.push(`Телефон в заявке Tourvisor: ${tour}`);
  if (!source && tour) lines.push(`Телефон: ${tour}`);
  return lines;
}

function buildDealLine(dealId?: string): string[] {
  const id = dealId?.trim();
  if (!id) return [];
  const domain =
    process.env.REBOOKING_BITRIX_DOMAIN?.trim() ||
    process.env.BITRIX_DOMAIN?.trim() ||
    'crm.mosgortur.ru';
  const cleanDomain = domain.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return [
    `Сделка B2C (из рассылки): ${id}`,
    `Ссылка на сделку: https://${cleanDomain}/crm/deal/details/${id}/`,
  ];
}

function buildTripContextLines(input: RebookingTripContext): string[] {
  const lines = [
    `Заявка: ${input.order}`,
    `Сертификат: ${input.cert || '—'}`,
    `ФИО: ${input.name || '—'}`,
  ];

  const dealLines = buildDealLine(input.dealId);
  if (dealLines.length) {
    lines.push('', ...dealLines);
  }

  const phoneLines = formatPhoneLines({ sourcePhone: input.sourcePhone, phone: input.phone });
  if (phoneLines.length) {
    lines.push('', ...phoneLines);
  }

  const composition = formatComposition(input.people, input.kids, input.kidAges);
  if (composition) {
    lines.push('', 'Исходная поездка:', composition);
  }
  if (input.price != null) lines.push(`Бюджет исходной поездки: ${formatPrice(input.price)}`);
  if (input.nights != null) lines.push(`Дней отдыха (исходные): ${input.nights}`);
  if (input.date) lines.push(`Дата начала (исходная): ${input.date}`);

  if (input.comment?.trim()) {
    lines.push('', `Комментарий клиента: ${input.comment.trim()}`);
  }

  const utmLines = Object.entries(input.utm ?? {}).map(([key, value]) => `${key}: ${value}`);
  if (utmLines.length) {
    lines.push('', 'UTM:', ...utmLines);
  }

  return lines;
}

function formatAnnulTimestamp(): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
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

function buildAnnulTitle(input: RebookingAnnulInput): string {
  const namePart = input.name?.trim() || 'клиент';
  return `Аннуляция ${input.order} — ${namePart}`;
}

function buildComments(input: RebookingLeadInput): string {
  const lines = [
    'Тип: перебронирование',
    ...buildTripContextLines({
      ...input,
      phone: input.phone,
      sourcePhone: input.sourcePhone || input.phone,
    }),
  ];

  if (input.destination) lines.push(`Выбранное направление: ${input.destination}`);
  lines.push(...formatTourBlock(input.tour));
  lines.push('', 'Источник: /rebooking');

  return lines.join('\n');
}

function buildAnnulComments(input: RebookingAnnulInput): string {
  const lines = [
    'Тип: запрос аннуляции',
    `Время запроса (МСК): ${formatAnnulTimestamp()}`,
    ...buildTripContextLines({
      ...input,
      sourcePhone: input.sourcePhone || input.phone,
      phone: undefined,
    }),
    '',
    'Источник: /rebooking (кнопка «Аннулировать заявку»)',
  ];

  return lines.join('\n');
}

const DEFAULT_REBOOKING_ENTITY_TYPE_ID = 1302;
const DEFAULT_REBOOKING_CATEGORY_ID = 61;
/** Стадия «Перебронь» в смарт-процессе «Перебронирование Крым». */
const DEFAULT_REBOOKING_STAGE_ID = 'DT1302_61:NEW';
/** Стадия «Аннуляция» в том же смарт-процессе. */
const DEFAULT_ANNUL_STAGE_ID = 'DT1302_61:UC_QEP35A';
const DEFAULT_REBOOKING_ASSIGNED_BY_ID = 1;

export type RebookingAnnulInput = {
  logPrefix: string;
  order: string;
  cert: string;
  name: string;
  /** Телефон из письма / ссылки рассылки. */
  sourcePhone?: string;
  phone?: string;
  email?: string;
  /** ID исходной сделки B2C из таблицы рассылки. */
  dealId?: string;
  comment?: string;
  people?: number;
  kids?: number;
  kidAges?: number[];
  price?: number;
  nights?: number;
  date?: string;
  utm?: UtmFields;
};

function getRebookingConfig() {
  const domain =
    process.env.REBOOKING_BITRIX_DOMAIN?.trim() ||
    process.env.BITRIX_DOMAIN?.trim() ||
    'crm.mosgortur.ru';
  const rebookingToken = process.env.REBOOKING_WEBHOOK_TOKEN?.trim();
  const revokedTokens = new Set(['1981/j9pvdbhovvem7j6c']);
  const token =
    (rebookingToken && !revokedTokens.has(rebookingToken) ? rebookingToken : '') ||
    process.env.WEBHOOK_TOKEN?.trim() ||
    '1981/0ly7df3o8j23eq30';
  if (!domain || !token) throw new Error('misconfigured');

  const entityTypeId = parsePositiveInt(process.env.REBOOKING_BITRIX_ENTITY_TYPE_ID);
  const categoryId = parsePositiveInt(process.env.REBOOKING_BITRIX_CATEGORY_ID);
  const assignedById = parsePositiveInt(process.env.REBOOKING_BITRIX_ASSIGNED_BY_ID);

  return {
    domain,
    token,
    entityTypeId: entityTypeId ?? DEFAULT_REBOOKING_ENTITY_TYPE_ID,
    categoryId: categoryId ?? DEFAULT_REBOOKING_CATEGORY_ID,
    stageId: process.env.REBOOKING_BITRIX_STAGE_ID?.trim() || DEFAULT_REBOOKING_STAGE_ID,
    assignedById: assignedById ?? DEFAULT_REBOOKING_ASSIGNED_BY_ID,
  };
}

export function getBitrixRebookingItemUrl(itemId: number): string {
  const entityTypeId =
    parsePositiveInt(process.env.REBOOKING_BITRIX_ENTITY_TYPE_ID) ?? DEFAULT_REBOOKING_ENTITY_TYPE_ID;
  const domain =
    process.env.REBOOKING_BITRIX_DOMAIN?.trim() ||
    process.env.BITRIX_DOMAIN?.trim() ||
    'crm.mosgortur.ru';
  const cleanDomain = domain.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return `https://${cleanDomain}/crm/type/${entityTypeId}/details/${itemId}/`;
}

async function findContactByPhone(
  logPrefix: string,
  domain: string,
  token: string,
  phone: string
): Promise<number | null> {
  try {
    const result = await bitrixCall<Array<{ ID?: string | number }>>(
      logPrefix,
      domain,
      token,
      'crm.contact.list',
      { filter: { PHONE: phone }, select: ['ID'] }
    );
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
  domain: string,
  token: string,
  name: string,
  phone: string,
  email: string | undefined,
  assignedById: number
): Promise<number | null> {
  const existingId = await findContactByPhone(logPrefix, domain, token, phone);
  if (existingId) return existingId;

  const fields: Record<string, unknown> = {
    NAME: name || 'Клиент',
    PHONE: [{ VALUE: phone, VALUE_TYPE: 'WORK' }],
    SOURCE_ID: 'WEB',
    ASSIGNED_BY_ID: assignedById,
  };
  if (email) fields.EMAIL = [{ VALUE: email, VALUE_TYPE: 'WORK' }];

  try {
    return await bitrixCall<number>(logPrefix, domain, token, 'crm.contact.add', { fields });
  } catch (error) {
    console.warn(`${logPrefix}: contact add failed`, error);
    return null;
  }
}

async function addRebookingTimelineComment(
  logPrefix: string,
  domain: string,
  token: string,
  entityTypeId: number,
  itemId: number,
  comment: string
) {
  try {
    await bitrixCall<number>(logPrefix, domain, token, 'crm.timeline.comment.add', {
      fields: {
        ENTITY_ID: itemId,
        ENTITY_TYPE: `dynamic_${entityTypeId}`,
        COMMENT: comment,
      },
    });
  } catch (error) {
    console.warn(`${logPrefix}: timeline comment failed for item ${itemId}`, error);
  }
}

async function createRebookingSmartProcessItem(options: {
  logPrefix: string;
  title: string;
  comments: string;
  stageId: string;
  name: string;
  phone?: string;
  sourcePhone?: string;
  email?: string;
  opportunity?: number;
  utm?: UtmFields;
}) {
  const { domain, token, entityTypeId, categoryId, assignedById } = getRebookingConfig();
  const { name } = splitFullName(options.name || 'Клиент');
  const contactPhone = options.sourcePhone?.trim() || options.phone?.trim();
  let contactId: number | null = null;
  if (contactPhone) {
    contactId = await resolveContactId(
      options.logPrefix,
      domain,
      token,
      name || options.name || 'Клиент',
      contactPhone,
      options.email,
      assignedById
    );
  }

  const fields: Record<string, unknown> = {
    title: options.title,
    stageId: options.stageId,
    categoryId,
    opened: 'Y',
    assignedById,
    sourceDescription: options.comments,
  };

  if (contactId) fields.contactId = contactId;
  if (options.opportunity != null) {
    fields.opportunity = Math.round(options.opportunity);
    fields.currencyId = 'RUB';
  }
  if (options.utm?.utm_source) fields.utmSource = options.utm.utm_source;
  if (options.utm?.utm_medium) fields.utmMedium = options.utm.utm_medium;
  if (options.utm?.utm_campaign) fields.utmCampaign = options.utm.utm_campaign;
  if (options.utm?.utm_content) fields.utmContent = options.utm.utm_content;
  if (options.utm?.utm_term) fields.utmTerm = options.utm.utm_term;

  const result = await bitrixCall<{ item: { id: number } }>(
    options.logPrefix,
    domain,
    token,
    'crm.item.add',
    { entityTypeId, fields }
  );

  const itemId = result?.item?.id;
  if (!itemId) throw new Error('bitrix_error:missing_item_id');

  await addRebookingTimelineComment(
    options.logPrefix,
    domain,
    token,
    entityTypeId,
    itemId,
    options.comments
  );

  return { itemId, leadId: itemId };
}

function getAnnulStageId(): string {
  return process.env.REBOOKING_BITRIX_ANNUL_STAGE_ID?.trim() || DEFAULT_ANNUL_STAGE_ID;
}

export async function submitRebookingLead(input: RebookingLeadInput) {
  const { stageId } = getRebookingConfig();
  const email = input.email?.trim() || input.tour?.email?.trim();
  const sourcePhone = input.sourcePhone?.trim() || input.phone;
  return createRebookingSmartProcessItem({
    logPrefix: input.logPrefix,
    title: buildLeadTitle(input),
    comments: buildComments(input),
    stageId,
    name: input.name || 'Клиент',
    phone: input.phone,
    sourcePhone,
    email,
    opportunity: input.tour?.price,
    utm: input.utm,
  });
}

export async function submitRebookingAnnulment(input: RebookingAnnulInput) {
  const sourcePhone = input.sourcePhone?.trim() || input.phone?.trim();
  return createRebookingSmartProcessItem({
    logPrefix: input.logPrefix,
    title: buildAnnulTitle(input),
    comments: buildAnnulComments(input),
    stageId: getAnnulStageId(),
    name: input.name || 'Клиент',
    sourcePhone,
    email: input.email?.trim() || undefined,
    opportunity: input.price,
    utm: input.utm,
  });
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
  if (message.includes('INVALID_CREDENTIALS')) return 'bitrix_error';
  if (message.startsWith('bitrix_error:')) return 'bitrix_error';
  return 'bitrix_error';
}

export { clamp, normalizeLeadPhone, parseBookingPrice, parseLeadUtm };
