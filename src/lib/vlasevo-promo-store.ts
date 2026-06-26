import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';

export const DEFAULT_PROMO_ACCENT_TEXT = 'Летние смены по специальной цене';
export const DEFAULT_SPECIAL_TERMS_TEXT = 'Спецусловия до 7 июня';
export const DEFAULT_BENEFIT_LABEL = 'Специальная цена';
export const DEFAULT_BOOKING_MODE = 'direct' as const;

export const bookingModeSchema = z.enum(['direct', 'lead']);
export type VlasevoPromoBookingMode = z.infer<typeof bookingModeSchema>;

export const shiftSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  dates: z.string().min(1),
  duration: z.string().min(1),
  oldPrice: z.coerce.number().nonnegative(),
  price: z.coerce.number().nonnegative(),
  image: z.string().min(1),
  url: z.string().url(),
  promoAccentText: z.string().optional().default(DEFAULT_PROMO_ACCENT_TEXT),
  specialTermsText: z.string().optional().default(DEFAULT_SPECIAL_TERMS_TEXT),
  benefitLabel: z.string().optional().default(DEFAULT_BENEFIT_LABEL),
  promoDisplayPrice: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? null : Number(value)),
    z.number().nonnegative().nullable().optional(),
  ),
  isPromoHighlight: z.boolean().optional().default(false),
  isSoldOut: z.boolean().optional().default(false),
});

export type VlasevoPromoShift = z.infer<typeof shiftSchema>;

export const storeSchema = z.object({
  bookingMode: bookingModeSchema.default(DEFAULT_BOOKING_MODE),
  shifts: z.array(shiftSchema),
});

export type VlasevoPromoStore = z.infer<typeof storeSchema>;

const fallbackShiftsPath = path.join(process.cwd(), 'src/data/vlasevo-promo-shifts.json');
const runtimeShiftsPath = process.env.VLASEVO_PROMO_SHIFTS_PATH
  ?? path.join(process.cwd(), 'storage/vlasevo-promo-shifts.json');

function parseStorePayload(parsed: unknown): VlasevoPromoStore {
  if (Array.isArray(parsed)) {
    return {
      bookingMode: DEFAULT_BOOKING_MODE,
      shifts: z.array(shiftSchema).parse(parsed),
    };
  }
  return storeSchema.parse(parsed);
}

export async function readVlasevoPromoStore(): Promise<VlasevoPromoStore> {
  let raw: string;
  try {
    raw = await fs.readFile(runtimeShiftsPath, 'utf8');
  } catch {
    raw = await fs.readFile(fallbackShiftsPath, 'utf8');
  }
  return parseStorePayload(JSON.parse(raw));
}

export async function writeVlasevoPromoStore(store: VlasevoPromoStore) {
  const normalized = storeSchema.parse(store);
  await fs.mkdir(path.dirname(runtimeShiftsPath), { recursive: true });
  await fs.writeFile(runtimeShiftsPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}
