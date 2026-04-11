'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createJwtToken } from '@/lib/jwt';
import { SESSION_COOKIE, JWT_SECRET } from '@/lib/session';
import {
  createBooking, createReview, findUserByEmail,
  registerUser, updateReviewStatus, upsertPackage,
} from '@/lib/repositories';
import { hashPassword, verifyPassword } from '@/lib/security';
import { bookingSchema, loginSchema, packageSchema, registrationSchema, reviewSchema } from '@/lib/validation';
import { AppError } from '@/lib/errors';
import type { TravelReviewStatus } from '@/types/travel';

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 дней

async function setSessionCookie(payload: Record<string, string>) {
  const token = await createJwtToken(payload, JWT_SECRET, SESSION_MAX_AGE);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
}

function buildStatusUrl(basePath: string, params: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  const separator = basePath.includes('?') ? '&' : '?';
  return `${basePath}${separator}${searchParams.toString()}`;
}

export async function registerAction(formData: FormData) {
  let redirectPath = '/account';
  try {
    const parsed = registrationSchema.parse({
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      email: formData.get('email'),
      password: formData.get('password'),
    });

    const user = await registerUser({
      id: crypto.randomUUID(),
      email: parsed.email,
      passwordHash: await hashPassword(parsed.password),
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      role: 'user',
      createdAt: new Date().toISOString(),
    });

    await setSessionCookie({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    });
  } catch (error) {
    const message = error instanceof AppError
      ? error.message
      : error instanceof Error
        ? error.message
        : 'Ошибка при регистрации';
    redirectPath = buildStatusUrl('/auth/register', { error: message });
  }
  redirect(redirectPath);
}

export async function loginAction(formData: FormData) {
  let redirectPath = '/account';
  try {
    const parsed = loginSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
    });

    const user = await findUserByEmail(parsed.email);

    if (!user || !(await verifyPassword(parsed.password, user.passwordHash))) {
      redirectPath = buildStatusUrl('/auth/login', { error: 'Неверный email или пароль' });
    } else {
      await setSessionCookie({
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка при входе';
    redirectPath = buildStatusUrl('/auth/login', { error: message });
  }
  redirect(redirectPath);
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect('/auth/login');
}

export async function createBookingAction(formData: FormData) {
  const redirectTo = String(formData.get('redirectTo') ?? '/checkout');

  try {
    const parsed = bookingSchema.parse({
      packageId: formData.get('packageId'),
      customerName: formData.get('customerName'),
      customerEmail: formData.get('customerEmail'),
      travelersCount: formData.get('travelersCount'),
      travelDate: formData.get('travelDate'),
      notes: formData.get('notes'),
    });

    await createBooking({
      id: crypto.randomUUID(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      ...parsed,
    });

    revalidatePath('/account');
    redirect(buildStatusUrl(redirectTo, { status: 'success', booking: 'created' }));
  } catch (error) {
    const message = error instanceof AppError ? error.message : 'Не удалось создать бронирование.';
    redirect(buildStatusUrl(redirectTo, { status: 'error', booking: message }));
  }
}

export async function createReviewAction(formData: FormData) {
  const redirectTo = String(formData.get('redirectTo') ?? '/tours');

  try {
    const parsed = reviewSchema.parse({
      packageId: formData.get('packageId'),
      authorName: formData.get('authorName'),
      authorEmail: formData.get('authorEmail'),
      rating: formData.get('rating'),
      comment: formData.get('comment'),
    });

    await createReview({
      id: crypto.randomUUID(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      ...parsed,
    });

    revalidatePath('/admin/reviews');
    redirect(buildStatusUrl(redirectTo, { reviewStatus: 'success' }));
  } catch (error) {
    const message = error instanceof AppError ? error.message : 'Не удалось отправить отзыв.';
    redirect(buildStatusUrl(redirectTo, { reviewStatus: 'error', reviewMessage: message }));
  }
}

export async function upsertPackageAction(formData: FormData) {
  const parsed = packageSchema.parse({
    title: formData.get('title'),
    slug: formData.get('slug'),
    destination: formData.get('destination'),
    country: formData.get('country'),
    summary: formData.get('summary'),
    description: formData.get('description'),
    priceFrom: formData.get('priceFrom'),
    durationDays: formData.get('durationDays'),
    heroImage: formData.get('heroImage'),
    seatsLeft: formData.get('seatsLeft'),
    tags: String(formData.get('tags') ?? '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    isFeatured: formData.get('isFeatured') === 'true',
  });

  await upsertPackage(parsed);
  revalidatePath('/admin');
  revalidatePath('/admin/tours');
  revalidatePath('/tours');
  redirect('/admin/tours?status=saved');
}

export async function updateReviewStatusAction(formData: FormData) {
  const reviewId = String(formData.get('reviewId') ?? '');
  const status = String(formData.get('status') ?? '') as TravelReviewStatus;

  if (!reviewId || !['approved', 'rejected', 'pending'].includes(status)) {
    redirect('/admin/reviews?status=invalid');
  }

  await updateReviewStatus(reviewId, status);
  revalidatePath('/admin');
  revalidatePath('/admin/reviews');
  redirect('/admin/reviews?status=updated');
}
