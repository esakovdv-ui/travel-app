import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const payloadSchema = z.object({
  name: z.string().trim().min(1, 'Укажите имя'),
  phone: z.string().trim().min(5, 'Укажите телефон'),
  shift: z.string().trim().min(1, 'Укажите смену'),
  source: z.enum(['landing', 'popup']).optional(),
});

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+7${digits}`;
  }
  return phone.trim();
}

async function sendToBitrix24(name: string, phone: string, shift: string, source: string) {
  const webhookBase = process.env.BITRIX24_WEBHOOK_URL?.replace(/\/$/, '');
  if (!webhookBase) {
    return { ok: false as const, error: 'BITRIX24_WEBHOOK_URL не настроен на сервере.' };
  }

  const url = `${webhookBase}/crm.lead.add.json`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        TITLE: `Радуга: ${shift}`,
        NAME: name,
        PHONE: [{ VALUE: normalizePhone(phone), VALUE_TYPE: 'WORK' }],
        COMMENTS: `Смена: ${shift}\nИсточник: motrip.ru/raduga (${source})`,
      },
    }),
  });

  const data = (await response.json().catch(() => ({}))) as { result?: number; error_description?: string };

  if (!response.ok || data.error_description) {
    return {
      ok: false as const,
      error: data.error_description ?? `Bitrix24 ответил с кодом ${response.status}`,
    };
  }

  return { ok: true as const, leadId: data.result };
}

export async function POST(request: Request) {
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Проверьте заполнение формы.' },
      { status: 400 },
    );
  }

  const { name, phone, shift, source = 'landing' } = parsed.data;
  const bitrix = await sendToBitrix24(name, phone, shift, source);

  if (!bitrix.ok) {
    return NextResponse.json({ error: bitrix.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, leadId: bitrix.leadId });
}
