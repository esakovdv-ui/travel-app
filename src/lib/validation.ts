import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const registrationSchema = loginSchema.extend({
  firstName: z.string().min(2).max(40),
  lastName: z.string().min(2).max(40)
});

export const searchSchema = z.object({
  destination: z.string().trim().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  duration: z.coerce.number().min(1).max(30).optional(),
  query: z.string().trim().optional(),
  category: z.enum(['warm', 'cold', 'active']).optional()
});

export const bookingSchema = z.object({
  packageId: z.string().min(1),
  customerName: z.string().min(2).max(80),
  customerEmail: z.string().email(),
  travelersCount: z.coerce.number().int().min(1).max(12),
  travelDate: z.string().min(1),
  notes: z.string().max(500).default('')
});

export const reviewSchema = z.object({
  packageId: z.string().min(1),
  authorName: z.string().min(2).max(80),
  authorEmail: z.string().email(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().min(20).max(500)
});

export const packageSchema = z.object({
  title: z.string().min(3).max(80),
  slug: z.string().min(3).max(80),
  destination: z.string().min(2).max(80),
  country: z.string().min(2).max(80),
  summary: z.string().min(10).max(180),
  description: z.string().min(40).max(3000),
  priceFrom: z.coerce.number().min(100),
  durationDays: z.coerce.number().int().min(1).max(30),
  heroImage: z.string().url(),
  seatsLeft: z.coerce.number().int().min(0).max(100),
  tags: z.array(z.string().min(2).max(30)).min(1).max(8),
  isFeatured: z.boolean()
});
