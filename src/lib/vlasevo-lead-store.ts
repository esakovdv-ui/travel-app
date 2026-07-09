import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import type { CampLanding, CampLeadQualification, UtmFields } from '@/lib/bitrix-camp-lead';

export const bitrixStatusSchema = z.enum(['pending', 'sent', 'failed']);
export type VlasevoLeadBitrixStatus = z.infer<typeof bitrixStatusSchema>;

const qualificationStepSchema = z.enum(['contacts', 'intent', 'payment', 'documents', 'transfer', 'questions']);
const documentSchema = z.object({
  seriesNumber: z.string().optional(),
  issueDate: z.string().optional(),
  issuer: z.string().optional(),
  departmentCode: z.string().optional(),
});
const qualificationSchema = z.object({
  flow: z.enum(['ready', 'questions']).optional(),
  status: z.enum(['not_started', 'in_progress', 'completed', 'questions']).optional(),
  currentStep: qualificationStepSchema.optional(),
  completedSteps: z.array(qualificationStepSchema).optional(),
  readinessPercent: z.number().int().min(0).max(100).optional(),
  updatedAt: z.string().optional(),
  applicantFullName: z.string().optional(),
  contactPhone: z.string().optional(),
  email: z.string().optional(),
  shiftDecision: z.enum(['yes', 'no', 'changes']).optional(),
  shiftChangeRequest: z.string().optional(),
  paymentType: z.enum(['certificate', 'self']).optional(),
  childFullName: z.string().optional(),
  childBirthDate: z.string().optional(),
  childDocumentType: z.enum(['birth_certificate', 'passport']).optional(),
  applicantPassport: documentSchema.optional(),
  childDocument: documentSchema.optional(),
  transferNeeded: z.enum(['yes', 'no']).optional(),
  transferDirection: z.enum(['none', 'to_camp', 'from_camp', 'round_trip']).optional(),
  transferAddress: z.string().optional(),
  transferTrafficData: z.string().optional(),
  consultationQuestion: z.string().optional(),
  preferredContactTime: z.enum(['morning', 'day', 'evening']).optional(),
});

export const vlasevoLeadSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().min(1),
  shift: z.string().min(1),
  landing: z.enum(['vlasevo', 'vlasevo-promo']),
  bookingPrice: z.number().nonnegative().optional(),
  source: z.string().optional(),
  utm: z
    .object({
      utm_source: z.string().optional(),
      utm_medium: z.string().optional(),
      utm_campaign: z.string().optional(),
      utm_content: z.string().optional(),
      utm_term: z.string().optional(),
    })
    .optional(),
  bitrixStatus: bitrixStatusSchema,
  bitrixDealId: z.number().optional(),
  bitrixContactId: z.number().optional(),
  bitrixError: z.string().optional(),
  qualification: qualificationSchema.optional(),
});

export type VlasevoLead = z.infer<typeof vlasevoLeadSchema>;

const MAX_LEADS = 5000;
const runtimeLeadsPath =
  process.env.VLASEVO_LEADS_PATH ?? path.join(process.cwd(), 'storage/vlasevo-leads.json');

function makeLeadId() {
  return `lead-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readLeadsRaw(): Promise<VlasevoLead[]> {
  try {
    const raw = await fs.readFile(runtimeLeadsPath, 'utf8');
    return z.array(vlasevoLeadSchema).parse(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function writeLeads(leads: VlasevoLead[]) {
  await fs.mkdir(path.dirname(runtimeLeadsPath), { recursive: true });
  await fs.writeFile(runtimeLeadsPath, `${JSON.stringify(leads, null, 2)}\n`, 'utf8');
}

export type SaveVlasevoLeadInput = {
  name: string;
  phone: string;
  shift: string;
  landing: CampLanding;
  bookingPrice?: number;
  source?: string;
  utm?: UtmFields;
};

type LeadTopLevelPatch = Partial<Pick<VlasevoLead, 'name' | 'shift' | 'landing' | 'bookingPrice' | 'source' | 'utm'>>;

const DUPLICATE_WINDOW_MS = 48 * 60 * 60 * 1000;

function isRecentEnough(createdAt: string, now = Date.now()) {
  const createdAtMs = Date.parse(createdAt);
  return Number.isFinite(createdAtMs) && now - createdAtMs >= 0 && now - createdAtMs <= DUPLICATE_WINDOW_MS;
}

function preferLeadForDedup(currentBest: VlasevoLead | null, candidate: VlasevoLead): VlasevoLead {
  if (!currentBest) return candidate;
  if (candidate.bitrixDealId && !currentBest.bitrixDealId) return candidate;
  if (!candidate.bitrixDealId && currentBest.bitrixDealId) return currentBest;
  return Date.parse(candidate.createdAt) > Date.parse(currentBest.createdAt) ? candidate : currentBest;
}

export async function saveVlasevoLead(input: SaveVlasevoLeadInput): Promise<VlasevoLead> {
  const lead: VlasevoLead = vlasevoLeadSchema.parse({
    id: makeLeadId(),
    createdAt: new Date().toISOString(),
    name: input.name,
    phone: input.phone,
    shift: input.shift,
    landing: input.landing === 'vlasevo-promo' ? 'vlasevo-promo' : 'vlasevo',
    bookingPrice: input.bookingPrice,
    source: input.source,
    utm: input.utm && Object.keys(input.utm).length ? input.utm : undefined,
    bitrixStatus: 'pending',
  });

  const leads = await readLeadsRaw();
  leads.unshift(lead);
  if (leads.length > MAX_LEADS) {
    leads.length = MAX_LEADS;
  }
  await writeLeads(leads);
  return lead;
}

export async function findRecentDuplicateVlasevoLead(input: {
  phone: string;
  shift?: string;
  now?: number;
}): Promise<VlasevoLead | null> {
  const leads = await readLeadsRaw();
  const now = input.now ?? Date.now();
  let bestMatch: VlasevoLead | null = null;
  for (const lead of leads) {
    if (lead.phone !== input.phone) continue;
    if (!isRecentEnough(lead.createdAt, now)) continue;
    bestMatch = preferLeadForDedup(bestMatch, lead);
  }
  return bestMatch;
}

export async function updateVlasevoLeadBitrix(
  leadId: string,
  patch: {
    bitrixStatus: VlasevoLeadBitrixStatus;
    bitrixDealId?: number;
    bitrixContactId?: number;
    bitrixError?: string;
  }
): Promise<VlasevoLead | null> {
  const leads = await readLeadsRaw();
  const index = leads.findIndex((item) => item.id === leadId);
  if (index < 0) return null;

  leads[index] = vlasevoLeadSchema.parse({
    ...leads[index],
    ...patch,
    bitrixError: patch.bitrixError?.slice(0, 240),
  });
  await writeLeads(leads);
  return leads[index];
}

export async function getVlasevoLeadById(leadId: string): Promise<VlasevoLead | null> {
  const leads = await readLeadsRaw();
  return leads.find((item) => item.id === leadId) ?? null;
}

export async function updateVlasevoLeadTopLevel(
  leadId: string,
  patch: LeadTopLevelPatch
): Promise<VlasevoLead | null> {
  const leads = await readLeadsRaw();
  const index = leads.findIndex((item) => item.id === leadId);
  if (index < 0) return null;

  const currentLead = leads[index];
  const nextLead = vlasevoLeadSchema.parse({
    ...currentLead,
    name: patch.name || currentLead.name,
    shift: patch.shift || currentLead.shift,
    landing: patch.landing ?? currentLead.landing,
    bookingPrice: patch.bookingPrice ?? currentLead.bookingPrice,
    source: patch.source ?? currentLead.source,
    utm:
      patch.utm && Object.keys(patch.utm).length
        ? { ...(currentLead.utm ?? {}), ...patch.utm }
        : currentLead.utm,
  });

  leads[index] = nextLead;
  await writeLeads(leads);
  return nextLead;
}

function mergeDocument(
  current: CampLeadQualification['applicantPassport'],
  patch: CampLeadQualification['applicantPassport']
) {
  if (!patch) return current;
  return {
    ...(current ?? {}),
    ...patch,
  };
}

export async function updateVlasevoLeadQualification(
  leadId: string,
  patch: {
    qualification: CampLeadQualification;
  }
): Promise<VlasevoLead | null> {
  const leads = await readLeadsRaw();
  const index = leads.findIndex((item) => item.id === leadId);
  if (index < 0) return null;

  const currentQualification = leads[index].qualification ?? {};
  const nextQualification = qualificationSchema.parse({
    ...currentQualification,
    ...patch.qualification,
    applicantPassport: mergeDocument(currentQualification.applicantPassport, patch.qualification.applicantPassport),
    childDocument: mergeDocument(currentQualification.childDocument, patch.qualification.childDocument),
  });

  leads[index] = vlasevoLeadSchema.parse({
    ...leads[index],
    qualification: nextQualification,
  });
  await writeLeads(leads);
  return leads[index];
}

export async function listVlasevoLeads(options?: { landing?: CampLanding; limit?: number }) {
  let leads = await readLeadsRaw();
  if (options?.landing) {
    const landing = options.landing === 'vlasevo-promo' ? 'vlasevo-promo' : 'vlasevo';
    leads = leads.filter((lead) => lead.landing === landing);
  }
  const limit = options?.limit ?? 500;
  return leads.slice(0, limit);
}

export function isVlasevoAdminPassword(password: string): boolean {
  const vlasevoPassword = process.env.VLASEVO_ADMIN_PASSWORD ?? 'vlasevo2026';
  const promoPassword = process.env.VLASEVO_PROMO_ADMIN_PASSWORD ?? 'vlasevo-promo2026';
  return password === vlasevoPassword || password === promoPassword;
}
