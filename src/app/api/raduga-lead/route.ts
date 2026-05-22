import { NextResponse } from 'next/server';

type UtmFields = Partial<Record<'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_content' | 'utm_term', string>>;

const DEAL_CATEGORY_ID = 12;
const DEAL_STAGE_ID = 'C12:NEW';
const ASSIGNED_BY_ID = 1;

function clamp(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return '+7' + digits.slice(1);
  }
  if (digits.length === 10) {
    return '+7' + digits;
  }
  return null;
}

async function bitrixCall<T = unknown>(method: string, payload: Record<string, unknown>) {
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
    console.error(`raduga-lead: ${method} failed`, data);
    throw new Error('bitrix_error');
  }
  return data.result as T;
}

async function findContactByPhone(phone: string): Promise<number | null> {
  const result = await bitrixCall<{ CONTACT?: number[] }>('crm.duplicate.findbycomm', {
    type: 'PHONE',
    values: [phone],
    entity_type: 'CONTACT',
  });
  const id = result?.CONTACT?.[0];
  return typeof id === 'number' ? id : null;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  if (typeof body.website === 'string' && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true });
  }

  const name = clamp(body.name, 100);
  const rawPhone = clamp(body.phone, 30);
  const shift = clamp(body.shift, 200);

  if (!name || !rawPhone || !shift) {
    return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
  }

  const phone = normalizePhone(rawPhone);
  if (!phone) {
    return NextResponse.json({ ok: false, error: 'invalid_phone' }, { status: 400 });
  }

  const utm: UtmFields = {};
  if (body.utm && typeof body.utm === 'object') {
    const raw = body.utm as Record<string, unknown>;
    (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const).forEach((key) => {
      const value = clamp(raw[key], 250);
      if (value) utm[key] = value;
    });
  }

  const commentLines = [`Смена: ${shift}`];
  const utmLines = Object.entries(utm).map(([k, v]) => `${k}: ${v}`);
  if (utmLines.length) {
    commentLines.push('', 'UTM:', ...utmLines);
  }
  const comments = commentLines.join('\n');

  try {
    let contactId = await findContactByPhone(phone);
    let contactCreated = false;
    if (!contactId) {
      contactId = await bitrixCall<number>('crm.contact.add', {
        fields: {
          NAME: name,
          PHONE: [{ VALUE: phone, VALUE_TYPE: 'WORK' }],
          SOURCE_ID: 'WEBFORM',
          ASSIGNED_BY_ID,
          OPENED: 'Y',
        },
      });
      contactCreated = true;
    }

    const dealFields: Record<string, unknown> = {
      TITLE: `Заявка с лендинга «Радуга» — ${name}`,
      CATEGORY_ID: DEAL_CATEGORY_ID,
      STAGE_ID: DEAL_STAGE_ID,
      TYPE_ID: '1',
      CONTACT_ID: contactId,
      SOURCE_ID: 'WEBFORM',
      ASSIGNED_BY_ID,
      OPENED: 'Y',
      COMMENTS: comments,
    };
    if (utm.utm_source) dealFields.UTM_SOURCE = utm.utm_source;
    if (utm.utm_medium) dealFields.UTM_MEDIUM = utm.utm_medium;
    if (utm.utm_campaign) dealFields.UTM_CAMPAIGN = utm.utm_campaign;
    if (utm.utm_content) dealFields.UTM_CONTENT = utm.utm_content;
    if (utm.utm_term) dealFields.UTM_TERM = utm.utm_term;

    const dealId = await bitrixCall<number>('crm.deal.add', { fields: dealFields });

    return NextResponse.json({ ok: true, dealId, contactId, contactCreated });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown';
    const status = message === 'misconfigured' ? 500 : 502;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
