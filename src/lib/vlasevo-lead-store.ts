import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import type { CampLanding, UtmFields } from '@/lib/bitrix-camp-lead';

export const bitrixStatusSchema = z.enum(['pending', 'sent', 'failed']);
export type VlasevoLeadBitrixStatus = z.infer<typeof bitrixStatusSchema>;

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
