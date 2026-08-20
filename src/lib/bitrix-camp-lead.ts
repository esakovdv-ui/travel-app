export type UtmFields = Partial<
  Record<'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_content' | 'utm_term', string>
>;

export type CampLanding = 'raduga' | 'vlasevo' | 'vlasevo-promo';
export type QualificationStep =
  | 'contacts'
  | 'intent'
  | 'payment'
  | 'documents'
  | 'transfer'
  | 'questions';
export type QualificationFlow = 'ready' | 'questions';
export type ShiftDecision = 'yes' | 'no' | 'changes';
export type PaymentType = 'certificate' | 'self';
export type TransferNeed = 'yes' | 'no';
export type TransferDirection = 'none' | 'to_camp' | 'from_camp' | 'round_trip';
export type ChildDocumentType = 'birth_certificate' | 'passport';
export type PreferredContactTime = 'morning' | 'day' | 'evening';

export type CampLeadDocument = {
  seriesNumber?: string;
  issueDate?: string;
  issuer?: string;
  departmentCode?: string;
};

export type CampLeadQualification = {
  flow?: QualificationFlow;
  status?: 'not_started' | 'in_progress' | 'completed' | 'questions';
  currentStep?: QualificationStep;
  completedSteps?: QualificationStep[];
  readinessPercent?: number;
  updatedAt?: string;
  applicantFullName?: string;
  contactPhone?: string;
  email?: string;
  shiftDecision?: ShiftDecision;
  shiftChangeRequest?: string;
  paymentType?: PaymentType;
  childFullName?: string;
  childBirthDate?: string;
  childDocumentType?: ChildDocumentType;
  applicantPassport?: CampLeadDocument;
  childDocument?: CampLeadDocument;
  transferNeeded?: TransferNeed;
  transferDirection?: TransferDirection;
  transferAddress?: string;
  transferTrafficData?: string;
  consultationQuestion?: string;
  preferredContactTime?: PreferredContactTime;
};

const DEAL_CATEGORY_ID = 12;
const DEAL_STAGE_ID = 'C12:NEW';
const ASSIGNED_BY_ID = 1;
export const CAMP_LEAD_DUPLICATE_WINDOW_MS = 48 * 60 * 60 * 1000;

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

export function normalizeShiftKey(shift: string): string {
  return shift
    .toLowerCase()
    .replace(/[·•]/g, ' ')
    .replace(/[—–-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isVlasevoDealText(title: string, comments: string): boolean {
  const text = `${title} ${comments}`.toLowerCase();
  return text.includes('власьево');
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
    console.warn(`${logPrefix}: contact list lookup failed for ${phone}`, error);
    return [];
  }
}

async function findContactByPhone(logPrefix: string, phone: string): Promise<number | null> {
  const ids = await findContactIdsByPhone(logPrefix, phone);
  return ids[0] ?? null;
}

async function findRecentOpenCampDeal(
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
          COMMENTS?: string;
          STAGE_SEMANTIC_ID?: string;
          DATE_CREATE?: string;
        }>
      >(logPrefix, 'crm.deal.list', {
        filter: { CONTACT_ID: contactId, CATEGORY_ID: DEAL_CATEGORY_ID },
        select: ['ID', 'TITLE', 'COMMENTS', 'STAGE_SEMANTIC_ID', 'DATE_CREATE'],
        order: { DATE_CREATE: 'DESC' },
      });

      for (const deal of result ?? []) {
        if (!isVlasevoDealText(deal.TITLE ?? '', deal.COMMENTS ?? '')) continue;
        const semantic = deal.STAGE_SEMANTIC_ID ?? '';
        if (semantic === 'S' || semantic === 'F') continue;

        const createdAt = Date.parse(deal.DATE_CREATE ?? '');
        if (!Number.isFinite(createdAt) || now - createdAt > CAMP_LEAD_DUPLICATE_WINDOW_MS) continue;

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
  bookingPrice?: number;
  source?: string;
  utm?: UtmFields;
  qualification?: CampLeadQualification;
};

export type UpdateCampLeadInput = {
  logPrefix: string;
  dealId: number;
  landing: CampLanding;
  name: string;
  phone: string;
  shift: string;
  bookingPrice?: number;
  source?: string;
  utm?: UtmFields;
  qualification?: CampLeadQualification;
};

export type SyncCampLeadInput = SubmitCampLeadInput & {
  dealId?: number;
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

function normalizeQualificationStep(step: string): string {
  const labels: Record<QualificationStep, string> = {
    contacts: 'Контакты',
    intent: 'Подтверждение смены',
    payment: 'Оплата',
    documents: 'Документы',
    transfer: 'Трансфер',
    questions: 'Вопросы',
  };
  return labels[step as QualificationStep] ?? step;
}

function normalizePreferredContactTime(value: PreferredContactTime | string | undefined): string | undefined {
  if (value === 'morning') return 'утром';
  if (value === 'day') return 'днём';
  if (value === 'evening') return 'вечером';
  return undefined;
}

function normalizeShiftDecision(value: ShiftDecision | string | undefined): string | undefined {
  if (value === 'yes') return 'да, готовы бронировать выбранные даты';
  if (value === 'no') return 'нет';
  if (value === 'changes') return 'нужны изменения';
  return undefined;
}

function normalizePaymentType(value: PaymentType | string | undefined): string | undefined {
  if (value === 'certificate') return 'по сертификату';
  if (value === 'self') return 'за собственные средства';
  return undefined;
}

function normalizeDocumentType(value: ChildDocumentType | string | undefined): string | undefined {
  if (value === 'birth_certificate') return 'свидетельство о рождении';
  if (value === 'passport') return 'паспорт';
  return undefined;
}


function getTransferSurcharge(direction: TransferDirection | string | undefined): number | undefined {
  if (direction === 'to_camp' || direction === 'from_camp') return 1500;
  if (direction === 'round_trip') return 3000;
  return undefined;
}

function normalizeTransferDirection(
  direction: TransferDirection | string | undefined,
  legacyNeeded?: TransferNeed | string
): string | undefined {
  if (direction === 'none') return 'не нужен';
  if (direction === 'to_camp') return 'только туда (+1 500 ₽ к стоимости)';
  if (direction === 'from_camp') return 'только обратно (+1 500 ₽ к стоимости)';
  if (direction === 'round_trip') return 'туда и обратно (+3 000 ₽ к стоимости)';
  if (legacyNeeded === 'yes') return 'нужен (направление не указано)';
  if (legacyNeeded === 'no') return 'не нужен';
  return undefined;
}

function pushDocumentLines(lines: string[], title: string, document?: CampLeadDocument) {
  if (!document) return;
  const docLines = [
    document.seriesNumber ? `серия и номер: ${document.seriesNumber}` : '',
    document.issueDate ? `дата выдачи: ${document.issueDate}` : '',
    document.issuer ? `кем выдан: ${document.issuer}` : '',
    document.departmentCode ? `код подразделения: ${document.departmentCode}` : '',
  ].filter(Boolean);
  if (docLines.length) {
    lines.push(`${title}:`, ...docLines.map((line) => `  - ${line}`));
  }
}

export function buildCampLeadComments({
  landing,
  shift,
  bookingPrice,
  source,
  utm = {},
  qualification,
}: Pick<SubmitCampLeadInput, 'landing' | 'shift' | 'bookingPrice' | 'source' | 'utm' | 'qualification'>) {
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

  if (qualification && qualification.status && qualification.status !== 'not_started') {
    commentLines.push('', 'Ускоренная заявка:');
    if (qualification.flow === 'questions') {
      commentLines.push('Формат: есть вопросы');
      const preferredTime = normalizePreferredContactTime(qualification.preferredContactTime);
      if (preferredTime) commentLines.push(`Когда связаться: ${preferredTime}`);
      if (qualification.consultationQuestion) {
        commentLines.push(`Вопрос клиента: ${qualification.consultationQuestion}`);
      }
    } else {
      commentLines.push('Формат: готов(а) бронировать');
      if (qualification.status === 'completed') {
        commentLines.push('Статус анкеты: заполнена');
      } else if (qualification.currentStep) {
        commentLines.push(`Статус анкеты: в процессе, последний шаг «${normalizeQualificationStep(qualification.currentStep)}»`);
      } else {
        commentLines.push('Статус анкеты: в процессе');
      }
      if (typeof qualification.readinessPercent === 'number') {
        commentLines.push(`Готовность: ${qualification.readinessPercent}%`);
      }
      if (qualification.applicantFullName) commentLines.push(`ФИО заявителя: ${qualification.applicantFullName}`);
      if (qualification.contactPhone) commentLines.push(`Телефон для связи: ${qualification.contactPhone}`);
      if (qualification.email) commentLines.push(`Email: ${qualification.email}`);
      const shiftDecision = normalizeShiftDecision(qualification.shiftDecision);
      if (shiftDecision) commentLines.push(`Подтверждение по смене: ${shiftDecision}`);
      if (qualification.shiftChangeRequest) commentLines.push(`Нужны изменения: ${qualification.shiftChangeRequest}`);
      const paymentType = normalizePaymentType(qualification.paymentType);
      if (paymentType) commentLines.push(`Оплата: ${paymentType}`);
      if (qualification.childFullName) commentLines.push(`ФИО ребёнка: ${qualification.childFullName}`);
      if (qualification.childBirthDate) commentLines.push(`Дата рождения ребёнка: ${qualification.childBirthDate}`);
      const documentType = normalizeDocumentType(qualification.childDocumentType);
      if (documentType) commentLines.push(`Документ ребёнка: ${documentType}`);
      pushDocumentLines(commentLines, 'Паспорт заявителя', qualification.applicantPassport);
      pushDocumentLines(commentLines, 'Документ ребёнка', qualification.childDocument);
      const transferLabel = normalizeTransferDirection(
        qualification.transferDirection,
        qualification.transferNeeded
      );
      if (transferLabel) commentLines.push(`Трансфер: ${transferLabel}`);
      const transferSurcharge = getTransferSurcharge(qualification.transferDirection);
      if (transferSurcharge) {
        commentLines.push(`Доплата за трансфер: ${transferSurcharge.toLocaleString('ru-RU')} ₽`);
      }
      if (qualification.transferAddress) commentLines.push(`Адрес прописки: ${qualification.transferAddress}`);
      if (
        qualification.transferDirection &&
        qualification.transferDirection !== 'none'
      ) {
        commentLines.push('Важно: данные по трансферу можно дополнить за 3-5 дней до выезда.');
      }
    }
  }

  const utmLines = Object.entries(utm).map(([key, value]) => `${key}: ${value}`);
  if (utmLines.length) {
    commentLines.push('', 'UTM:', ...utmLines);
  }
  return commentLines.join('\n');
}

function buildCampDealFields({
  landing,
  name,
  phone,
  shift,
  bookingPrice,
  source,
  utm = {},
  qualification,
}: Pick<SubmitCampLeadInput, 'landing' | 'name' | 'phone' | 'shift' | 'bookingPrice' | 'source' | 'utm' | 'qualification'>) {
  const comments = buildCampLeadComments({
    landing,
    shift,
    bookingPrice,
    source,
    utm,
    qualification,
  });
  const landingTitle = LANDING_TITLES[landing] ?? LANDING_TITLES.vlasevo;
  const fields: Record<string, unknown> = {
    TITLE: `Заявка с лендинга «${landingTitle}» — ${name}`,
    COMMENTS: comments,
    UTM_SOURCE: utm.utm_source ?? '',
    UTM_MEDIUM: utm.utm_medium ?? '',
    UTM_CAMPAIGN: utm.utm_campaign ?? '',
    UTM_CONTENT: utm.utm_content ?? '',
    UTM_TERM: utm.utm_term ?? '',
  };
  return fields;
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
  qualification,
}: SubmitCampLeadInput) {
  const { contactId, contactCreated } = await resolveContactId(logPrefix, name, phone);

  const dealFields: Record<string, unknown> = {
    ...buildCampDealFields({
      landing,
      name,
      phone,
      shift,
      bookingPrice,
      source,
      utm,
      qualification,
    }),
    CATEGORY_ID: DEAL_CATEGORY_ID,
    STAGE_ID: DEAL_STAGE_ID,
    TYPE_ID: '1',
    CONTACT_ID: contactId,
    SOURCE_ID: 'WEBFORM',
    ASSIGNED_BY_ID,
  };

  const dealId = await bitrixCall<number>(logPrefix, 'crm.deal.add', { fields: dealFields });

  return { dealId, contactId, contactCreated };
}

export async function updateCampLead({
  logPrefix,
  dealId,
  landing,
  name,
  phone,
  shift,
  bookingPrice,
  source,
  utm = {},
  qualification,
}: UpdateCampLeadInput) {
  await bitrixCall(logPrefix, 'crm.deal.update', {
    id: dealId,
    fields: buildCampDealFields({
      landing,
      name,
      phone,
      shift,
      bookingPrice,
      source,
      utm,
      qualification,
    }),
  });
  const contactId = await findContactByPhone(logPrefix, phone);
  return { dealId, contactId };
}

export async function syncCampLead({
  dealId,
  ...input
}: SyncCampLeadInput) {
  const resolvedDealId = dealId ?? (await findRecentOpenCampDeal(input.logPrefix, input.phone));
  if (resolvedDealId) {
    return updateCampLead({
      ...input,
      dealId: resolvedDealId,
    });
  }
  return submitCampLead(input);
}

export { clamp };

export function mapCampLeadError(message: string): string {
  if (message === 'misconfigured') return message;
  if (message.includes('INVALID_CREDENTIALS')) return 'misconfigured';
  if (message.startsWith('bitrix_error:')) return 'bitrix_error';
  return 'bitrix_error';
}
