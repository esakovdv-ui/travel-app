import * as XLSX from 'xlsx';

export type ParsedStoryCandidate = {
  rawAuthorName: string;
  rawObject: string;
  rawPeriod: string;
  rawManager: string;
  rawText: string;
  sourceOrderId: string;
};

export type ImportParseResult = {
  candidates: ParsedStoryCandidate[];
  totalRows: number;
  skippedNoConsent: number;
  skippedEmptyText: number;
  skippedMissingFields: number;
};

function normalizeHeader(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function cell(row: unknown[], index: number): string {
  return index === -1 ? '' : String(row[index] ?? '').trim();
}

function findColumnIndex(headers: string[], matchers: ((h: string) => boolean)[]): number {
  for (const matcher of matchers) {
    const idx = headers.findIndex(matcher);
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Разбирает выгрузку опроса (NPS) в формате .xlsx и находит строки,
 * подходящие для импорта в качестве историй: есть согласие на публикацию
 * и заполнен текст отзыва. Поиск колонок — по ключевым словам в заголовке,
 * а не по фиксированной позиции, так как порядок столбцов может отличаться
 * между выгрузками.
 */
export function parseStoriesWorkbook(buffer: Buffer): ImportParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;

  const empty: ImportParseResult = {
    candidates: [],
    totalRows: 0,
    skippedNoConsent: 0,
    skippedEmptyText: 0,
    skippedMissingFields: 0,
  };

  if (!sheet) return empty;

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
    dateNF: 'dd.mm.yyyy',
  });

  if (rows.length < 2) return empty;

  const headers = (rows[0] as unknown[]).map(normalizeHeader);
  const dataRows = rows.slice(1);

  const colOrderId = findColumnIndex(headers, [(h) => h.includes('заявка')]);
  const colConsent = findColumnIndex(headers, [(h) => h.includes('согласие') && h.includes('публикац')]);
  const colText = findColumnIndex(headers, [(h) => h.includes('расскажите')]);
  const colCustomer = findColumnIndex(headers, [(h) => h.includes('заказчик')]);
  const colObject = findColumnIndex(headers, [
    (h) => h === 'место отдыха',
    (h) => h.includes('место отдыха') && !h.includes('тип'),
  ]);
  const colManager = findColumnIndex(headers, [(h) => h === 'сотрудник']);
  const colDateStart = findColumnIndex(headers, [(h) => h.includes('дата начала')]);
  const colDateEnd = findColumnIndex(headers, [(h) => h.includes('дата окончания')]);

  const candidates: ParsedStoryCandidate[] = [];
  let skippedNoConsent = 0;
  let skippedEmptyText = 0;
  let skippedMissingFields = 0;
  let totalRows = 0;

  for (const row of dataRows) {
    const isBlank = (row as unknown[]).every((c) => String(c ?? '').trim() === '');
    if (isBlank) continue;
    totalRows++;

    const consent = cell(row as unknown[], colConsent);
    const text = cell(row as unknown[], colText);
    const customer = cell(row as unknown[], colCustomer);
    const object = cell(row as unknown[], colObject);
    const orderId = cell(row as unknown[], colOrderId);

    if (consent !== 'Да') { skippedNoConsent++; continue; }
    if (!text) { skippedEmptyText++; continue; }
    if (!customer || !object || !orderId) { skippedMissingFields++; continue; }

    const manager = cell(row as unknown[], colManager);
    const dateStart = cell(row as unknown[], colDateStart);
    const dateEnd = cell(row as unknown[], colDateEnd);
    const rawPeriod = [dateStart, dateEnd].filter(Boolean).join(' – ');

    candidates.push({
      rawAuthorName: customer,
      rawObject: object,
      rawPeriod,
      rawManager: manager,
      rawText: text,
      sourceOrderId: orderId,
    });
  }

  return { candidates, totalRows, skippedNoConsent, skippedEmptyText, skippedMissingFields };
}
