import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';

export const podborUtmSchema = z.object({
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_content: z.string().optional(),
  utm_term: z.string().optional(),
});

export const podborAnswersSchema = z.object({
  adults: z.number().int().min(1).max(6).optional(),
  kids: z.number().int().min(0).max(4).optional(),
  kidsAges: z.array(z.number().int().min(0).max(17)).optional(),
  budget: z.number().int().positive().optional(),
  budgetCustom: z.boolean().optional(),
  format: z.enum(['tour', 'hotel']).nullable().optional(),
  region: z
    .enum([
      'sea',
      'podmos',
      'spb',
      'kaliningrad',
      'kazan',
      'other',
      'any',
      'karelia',
      'kaluga',
      'altai',
      'yaroslavl',
      'nnovgorod',
      'vladimir',
    ])
    .nullable()
    .optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  nights: z.number().int().positive().optional(),
  handoffUrl: z.string().optional(),
  /** Имя с формы контакта — без телефона в хранилище. */
  contactName: z.string().max(100).optional(),
  /** Маска телефона, например +7***1234 */
  phoneMasked: z.string().max(20).optional(),
  bitrixDealId: z.number().int().positive().optional(),
});

export const podborEventSchema = z.object({
  at: z.string().min(1),
  type: z.enum(['start', 'step', 'handoff', 'lead_submit']),
  step: z.string().optional(),
  answers: podborAnswersSchema.optional(),
});

export const podborSessionSchema = z.object({
  id: z.string().min(1),
  startedAt: z.string().min(1),
  updatedAt: z.string().min(1),
  completedAt: z.string().optional(),
  status: z.enum(['started', 'in_progress', 'completed']),
  embedded: z.boolean().optional(),
  utm: podborUtmSchema.optional(),
  referer: z.string().optional(),
  userAgent: z.string().optional(),
  answers: podborAnswersSchema,
  events: z.array(podborEventSchema),
});

export type PodborSession = z.infer<typeof podborSessionSchema>;
export type PodborAnswers = z.infer<typeof podborAnswersSchema>;

const MAX_SESSIONS = 10000;
const runtimePath =
  process.env.PODBOR_RESPONSES_PATH ?? path.join(process.cwd(), 'storage/podbor-responses.json');

async function readSessionsRaw(): Promise<PodborSession[]> {
  try {
    const raw = await fs.readFile(runtimePath, 'utf8');
    return z.array(podborSessionSchema).parse(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function writeSessions(sessions: PodborSession[]) {
  await fs.mkdir(path.dirname(runtimePath), { recursive: true });
  await fs.writeFile(runtimePath, `${JSON.stringify(sessions, null, 2)}\n`, 'utf8');
}

function mergeAnswers(current: PodborAnswers, patch?: PodborAnswers): PodborAnswers {
  if (!patch) return current;
  const merged: PodborAnswers = { ...current };
  for (const [key, value] of Object.entries(patch) as [keyof PodborAnswers, PodborAnswers[keyof PodborAnswers]][]) {
    if (value !== null && value !== undefined) {
      merged[key] = value;
    }
  }
  return podborAnswersSchema.parse(merged);
}

export function isPodborAdminPassword(password: string): boolean {
  return password === (process.env.PODBOR_ADMIN_PASSWORD ?? 'podbor2026');
}

export type TrackPodborInput = {
  sessionId: string;
  type: 'start' | 'step' | 'handoff' | 'lead_submit';
  step?: string;
  answers?: PodborAnswers;
  embedded?: boolean;
  utm?: z.infer<typeof podborUtmSchema>;
  referer?: string;
  userAgent?: string;
};

export async function trackPodborSession(input: TrackPodborInput): Promise<PodborSession> {
  const now = new Date().toISOString();
  const sessions = await readSessionsRaw();
  const index = sessions.findIndex((item) => item.id === input.sessionId);

  const event = podborEventSchema.parse({
    at: now,
    type: input.type,
    step: input.step,
    answers: input.answers,
  });

  if (index < 0) {
    const session = podborSessionSchema.parse({
      id: input.sessionId,
      startedAt: now,
      updatedAt: now,
      completedAt: input.type === 'handoff' ? now : undefined,
      status: input.type === 'handoff' ? 'completed' : input.type === 'start' ? 'started' : 'in_progress',
      embedded: input.embedded,
      utm: input.utm && Object.values(input.utm).some(Boolean) ? input.utm : undefined,
      referer: input.referer?.slice(0, 500),
      userAgent: input.userAgent?.slice(0, 500),
      answers: mergeAnswers({}, input.answers),
      events: [event],
    });
    sessions.unshift(session);
    if (sessions.length > MAX_SESSIONS) sessions.length = MAX_SESSIONS;
    await writeSessions(sessions);
    return session;
  }

  const current = sessions[index];
  const nextAnswers = mergeAnswers(current.answers, input.answers);
  const nextStatus =
    input.type === 'handoff'
      ? 'completed'
      : current.status === 'started' && input.type === 'step'
        ? 'in_progress'
        : current.status;

  sessions[index] = podborSessionSchema.parse({
    ...current,
    updatedAt: now,
    completedAt: input.type === 'handoff' ? now : current.completedAt,
    status: nextStatus,
    embedded: input.embedded ?? current.embedded,
    utm: current.utm || (input.utm && Object.values(input.utm).some(Boolean) ? input.utm : undefined),
    referer: current.referer || input.referer?.slice(0, 500),
    userAgent: current.userAgent || input.userAgent?.slice(0, 500),
    answers: nextAnswers,
    events: [...current.events, event].slice(-30),
  });

  await writeSessions(sessions);
  return sessions[index];
}

export async function listPodborSessions(options?: {
  from?: string;
  to?: string;
  status?: 'started' | 'in_progress' | 'completed' | 'all';
  limit?: number;
}) {
  let sessions = await readSessionsRaw();
  const status = options?.status ?? 'all';
  if (status !== 'all') {
    sessions = sessions.filter((item) => item.status === status);
  }

  const fromTs = options?.from ? Date.parse(`${options.from}T00:00:00+03:00`) : NaN;
  const toTs = options?.to ? Date.parse(`${options.to}T23:59:59+03:00`) : NaN;
  if (Number.isFinite(fromTs)) {
    sessions = sessions.filter((item) => Date.parse(item.startedAt) >= fromTs);
  }
  if (Number.isFinite(toTs)) {
    sessions = sessions.filter((item) => Date.parse(item.startedAt) <= toTs);
  }

  const limit = options?.limit ?? 5000;
  return sessions.slice(0, limit);
}

export function podborSessionsToTsv(sessions: PodborSession[]): string {
  const header = [
    'session_id',
    'started_at',
    'updated_at',
    'completed_at',
    'status',
    'embedded',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'adults',
    'kids',
    'kids_ages',
    'budget',
    'budget_custom',
    'format',
    'region',
    'check_in',
    'check_out',
    'nights',
    'handoff_url',
    'contact_name',
    'phone_masked',
    'bitrix_deal_id',
    'referer',
  ].join('\t');

  const rows = sessions.map((s) =>
    [
      s.id,
      s.startedAt,
      s.updatedAt,
      s.completedAt ?? '',
      s.status,
      s.embedded ? '1' : '0',
      s.utm?.utm_source ?? '',
      s.utm?.utm_medium ?? '',
      s.utm?.utm_campaign ?? '',
      s.answers.adults ?? '',
      s.answers.kids ?? '',
      (s.answers.kidsAges ?? []).join(','),
      s.answers.budget ?? '',
      s.answers.budgetCustom ? '1' : '0',
      s.answers.format ?? '',
      s.answers.region ?? '',
      s.answers.checkIn ?? '',
      s.answers.checkOut ?? '',
      s.answers.nights ?? '',
      s.answers.handoffUrl ?? '',
      s.answers.contactName ?? '',
      s.answers.phoneMasked ?? '',
      s.answers.bitrixDealId ?? '',
      s.referer ?? '',
    ].join('\t')
  );

  return [header, ...rows].join('\n');
}
