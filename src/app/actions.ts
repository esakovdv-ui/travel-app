'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { createJwtToken } from '@/lib/jwt';
import { SESSION_COOKIE, JWT_SECRET } from '@/lib/session';
import {
  createBooking, createReview, createStory, findUserByEmail, importStories,
  publishStory, rejectStory, revertStory, registerUser, updateReviewStatus, upsertPackage,
} from '@/lib/repositories';
import { hashPassword, verifyPassword } from '@/lib/security';
import { bookingSchema, loginSchema, packageSchema, registrationSchema, reviewSchema } from '@/lib/validation';
import { AppError } from '@/lib/errors';
import { parseStoriesWorkbook } from '@/lib/story-import';
import { ZodError } from 'zod';
import type { TravelReviewStatus } from '@/types/travel';

function getErrorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return error.errors[0]?.message ?? 'Ошибка валидации';
  }
  if (error instanceof AppError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Произошла ошибка, попробуйте снова';
}

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 дней

async function setSessionCookie(payload: Record<string, string>) {
  const token = await createJwtToken(payload, JWT_SECRET, SESSION_MAX_AGE);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
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
    redirectPath = buildStatusUrl('/auth/register', { error: getErrorMessage(error) });
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
    redirectPath = buildStatusUrl('/auth/login', { error: getErrorMessage(error) });
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

// ─── Stories ─────────────────────────────────────────────────────────────────

async function saveUploadedPhotos(files: File[]): Promise<string[]> {
  const paths: string[] = [];
  const dir = path.join(process.cwd(), 'public', 'uploads', 'stories');
  await mkdir(dir, { recursive: true });
  for (const file of files) {
    if (!file.size) continue;
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
    const name = `${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, name), buffer);
    paths.push(`/uploads/stories/${name}`);
  }
  return paths;
}

export type StoryFormState = { success: true } | { success: false; error: string } | null;

export async function submitStoryAction(
  _prev: StoryFormState,
  formData: FormData
): Promise<StoryFormState> {
  try {
    const authorName = String(formData.get('authorName') ?? '').trim();
    const object = String(formData.get('object') ?? '').trim();
    const text = String(formData.get('text') ?? '').trim();

    if (!authorName || !object || !text) {
      return { success: false, error: 'Заполните обязательные поля: имя, объект и историю.' };
    }
    if (text.length < 30) {
      return { success: false, error: 'История слишком короткая — напишите хотя бы несколько предложений.' };
    }

    const files = formData.getAll('photos') as File[];
    const photos = await saveUploadedPhotos(files);

    await createStory({
      id: crypto.randomUUID(),
      submittedAt: new Date().toISOString(),
      status: 'new',
      publishedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      rawAuthorName: authorName,
      rawObject: object,
      rawPeriod: String(formData.get('period') ?? '').trim(),
      rawManager: String(formData.get('manager') ?? '').trim(),
      rawText: text,
      photos,
      pubTitle: null,
      pubQuote: null,
      pubTag: null,
      pubTagId: null,
      pubObjectUrl: null,
    });

    revalidatePath('/admin/stories');
    return { success: true };
  } catch {
    return { success: false, error: 'Не удалось отправить историю. Попробуйте позже.' };
  }
}

export async function publishStoryAction(formData: FormData) {
  const id = String(formData.get('storyId') ?? '');
  const pubTitle = String(formData.get('pubTitle') ?? '').trim();
  const pubQuote = String(formData.get('pubQuote') ?? '').trim();
  const pubTagId = String(formData.get('pubTagId') ?? '').trim();
  const pubObjectUrl = String(formData.get('pubObjectUrl') ?? '').trim();

  if (!id || !pubTitle || !pubQuote || !pubTagId) {
    redirect(`/admin/stories/${id}?status=invalid`);
  }

  await publishStory(id, { pubTitle, pubQuote, pubTagId, pubObjectUrl });
  revalidatePath('/admin/stories');
  revalidatePath('/stories');
  redirect(`/admin/stories/${id}?status=published`);
}

export async function renameTagAction(
  formData: FormData
): Promise<{ error?: string }> {
  const id = String(formData.get('tagId') ?? '').trim();
  const label = String(formData.get('label') ?? '').trim();

  if (!id || !label || label.length > 40) {
    return { error: 'Название тега не может быть пустым или длиннее 40 символов' };
  }

  const { updateTagLabel } = await import('@/lib/repositories');
  const tag = await updateTagLabel(id, label);
  if (!tag) return { error: 'Тег не найден' };

  revalidatePath('/admin/story-tags');
  revalidatePath('/stories');
  return {};
}

export type ImportStoriesState =
  | null
  | {
      success: true;
      stats: {
        totalRows: number;
        qualified: number;
        imported: number;
        duplicates: number;
        skippedNoConsent: number;
        skippedEmptyText: number;
        skippedMissingFields: number;
      };
    }
  | { success: false; error: string };

export async function importStoriesAction(
  _prev: ImportStoriesState,
  formData: FormData
): Promise<ImportStoriesState> {
  const file = formData.get('file') as File | null;

  if (!file || !file.size) {
    return { success: false, error: 'Выберите файл Excel (.xlsx) с данными опроса.' };
  }
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return { success: false, error: 'Поддерживается только формат .xlsx.' };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseStoriesWorkbook(buffer);

    if (parsed.candidates.length === 0) {
      return {
        success: false,
        error: 'В файле не найдено подходящих строк (согласие на публикацию = «Есть» и заполненный отзыв).',
      };
    }

    const { imported, duplicates } = await importStories(parsed.candidates);

    revalidatePath('/admin/stories');

    return {
      success: true,
      stats: {
        totalRows: parsed.totalRows,
        qualified: parsed.candidates.length,
        imported,
        duplicates,
        skippedNoConsent: parsed.skippedNoConsent,
        skippedEmptyText: parsed.skippedEmptyText,
        skippedMissingFields: parsed.skippedMissingFields,
      },
    };
  } catch {
    return { success: false, error: 'Не удалось разобрать файл. Проверьте, что это корректный экспорт опроса.' };
  }
}

export async function rejectStoryAction(formData: FormData) {
  const id = String(formData.get('storyId') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();

  if (!id) redirect('/admin/stories?status=invalid');

  await rejectStory(id, reason || undefined);
  revalidatePath('/admin/stories');
  redirect(`/admin/stories/${id}?status=rejected`);
}

export async function revertStoryAction(formData: FormData) {
  const id = String(formData.get('storyId') ?? '');
  if (!id) redirect('/admin/stories?status=invalid');

  await revertStory(id);
  revalidatePath('/admin/stories');
  revalidatePath('/stories');
  redirect(`/admin/stories/${id}?status=reverted`);
}
