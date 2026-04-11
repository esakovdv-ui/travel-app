import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(8, 'Пароль должен содержать минимум 8 символов'),
});

export const registrationSchema = z.object({
  firstName: z.string().min(2, 'Имя должно содержать минимум 2 символа').max(40, 'Имя слишком длинное'),
  lastName: z.string().min(2, 'Фамилия должна содержать минимум 2 символа').max(40, 'Фамилия слишком длинная'),
  email: z.string().email('Введите корректный email'),
  password: z.string().min(8, 'Пароль должен содержать минимум 8 символов'),
});

export const searchSchema = z.object({
  destination: z.string().trim().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  duration: z.coerce.number().min(1).max(30).optional(),
  query: z.string().trim().optional(),
  category: z.enum(['warm', 'cold', 'active']).optional(),
});

export const bookingSchema = z.object({
  packageId: z.string().min(1),
  customerName: z.string().min(2, 'Введите имя').max(80),
  customerEmail: z.string().email('Введите корректный email'),
  travelersCount: z.coerce.number().int().min(1, 'Минимум 1 турист').max(12, 'Максимум 12 туристов'),
  travelDate: z.string().min(1, 'Выберите дату'),
  notes: z.string().max(500, 'Комментарий слишком длинный').default(''),
});

export const reviewSchema = z.object({
  packageId: z.string().min(1),
  authorName: z.string().min(2, 'Введите имя').max(80),
  authorEmail: z.string().email('Введите корректный email'),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().min(20, 'Отзыв должен содержать минимум 20 символов').max(500, 'Отзыв слишком длинный'),
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
  isFeatured: z.boolean(),
});
