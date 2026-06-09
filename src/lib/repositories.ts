import { BookingConflictError, DuplicateRegistrationError } from './errors';
import { logEvent } from './logger';
import { mockBookings, mockGalleryPhotos, mockPackages, mockReviews, mockStories, mockStoryTags } from './mock-data';
import { filterPackages, slugify } from './utils';
import { query, queryOne } from './db';
import type {
  AdminPackageFormValues,
  AppUser,
  Booking,
  PackageFilters,
  Story,
  StoryStatus,
  StoryTag,
  TravelReview,
  TravelReviewStatus
} from '@/types/travel';

// ─── Packages (mock) ────────────────────────────────────────────────────────

export async function listPackages(filters: PackageFilters = {}) {
  return filterPackages(mockPackages, filters);
}

export async function listFeaturedPackages() {
  return mockPackages.slice(0, 10);
}

export async function getPackageBySlug(slug: string) {
  return mockPackages.find((item) => item.slug === slug) ?? null;
}

export async function listDestinations() {
  return [...new Set(mockPackages.map((item) => item.destination))].sort();
}

export async function listAdminPackages() {
  return [...mockPackages].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function upsertPackage(input: AdminPackageFormValues) {
  const normalizedSlug = slugify(input.slug);
  const existing = mockPackages.find((item) => item.slug === normalizedSlug);

  if (existing) {
    existing.title = input.title;
    existing.destination = input.destination;
    existing.country = input.country;
    existing.summary = input.summary;
    existing.description = input.description;
    existing.priceFrom = input.priceFrom;
    existing.durationDays = input.durationDays;
    existing.heroImage = input.heroImage;
    existing.seatsLeft = input.seatsLeft;
    existing.tags = input.tags;
    existing.isFeatured = input.isFeatured;
    existing.updatedAt = new Date().toISOString();
    return existing;
  }

  const createdAt = new Date().toISOString();
  const created = {
    id: crypto.randomUUID(),
    slug: normalizedSlug,
    title: input.title,
    destination: input.destination,
    country: input.country,
    summary: input.summary,
    description: input.description,
    priceFrom: input.priceFrom,
    durationDays: input.durationDays,
    ratingAverage: 0,
    reviewCount: 0,
    heroImage: input.heroImage,
    gallery: [input.heroImage],
    seatsLeft: input.seatsLeft,
    tags: input.tags,
    isFeatured: input.isFeatured,
    createdAt,
    updatedAt: createdAt,
  };

  mockPackages.unshift(created);
  return created;
}

// ─── Reviews (mock) ──────────────────────────────────────────────────────────

export async function listApprovedReviews(packageId: string) {
  return mockReviews.filter((item) => item.packageId === packageId && item.status === 'approved');
}

export async function listAllReviews() {
  return [...mockReviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listFeaturedReviews(limit = 3) {
  return mockReviews.filter((item) => item.status === 'approved').slice(0, limit);
}

export async function createReview(review: TravelReview) {
  mockReviews.unshift(review);
  logEvent('info', 'review.created', { reviewId: review.id, packageId: review.packageId });
  return review;
}

export async function updateReviewStatus(reviewId: string, status: TravelReviewStatus) {
  const review = mockReviews.find((item) => item.id === reviewId);
  if (!review) return null;
  review.status = status;
  return review;
}

// ─── Users (PostgreSQL) ──────────────────────────────────────────────────────

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: string;
  created_at: string;
}

function rowToUser(row: UserRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role as AppUser['role'],
    createdAt: row.created_at,
  };
}

export async function registerUser(user: AppUser): Promise<AppUser> {
  const exists = await queryOne<{ id: string }>(
    'SELECT id FROM users WHERE lower(email) = lower($1)',
    [user.email]
  );
  if (exists) throw new DuplicateRegistrationError();

  await query(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, role, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [user.id, user.email, user.passwordHash, user.firstName, user.lastName, user.role, user.createdAt]
  );

  logEvent('info', 'user.registered', { userId: user.id, email: user.email });
  return user;
}

export async function findUserByEmail(email: string): Promise<AppUser | null> {
  const row = await queryOne<UserRow>(
    'SELECT * FROM users WHERE lower(email) = lower($1)',
    [email]
  );
  return row ? rowToUser(row) : null;
}

export async function findUserById(id: string): Promise<AppUser | null> {
  const row = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
  return row ? rowToUser(row) : null;
}

export async function updateUser(
  id: string,
  data: { firstName?: string; lastName?: string; email?: string }
): Promise<AppUser | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (data.firstName !== undefined) { sets.push(`first_name = $${idx++}`); params.push(data.firstName); }
  if (data.lastName !== undefined)  { sets.push(`last_name = $${idx++}`);  params.push(data.lastName); }
  if (data.email !== undefined)     { sets.push(`email = $${idx++}`);      params.push(data.email); }

  if (sets.length === 0) return findUserById(id);

  params.push(id);
  const row = await queryOne<UserRow>(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  return row ? rowToUser(row) : null;
}

// ─── Bookings (PostgreSQL) ───────────────────────────────────────────────────

interface BookingRow {
  id: string;
  user_id: string | null;
  package_id: string;
  customer_name: string;
  customer_email: string;
  travelers_count: number;
  travel_date: string;
  notes: string;
  status: string;
  created_at: string;
}

function rowToBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    packageId: row.package_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    travelersCount: row.travelers_count,
    travelDate: row.travel_date,
    notes: row.notes,
    status: row.status as Booking['status'],
    createdAt: row.created_at,
  };
}

export async function createBooking(booking: Booking & { userId?: string }): Promise<Booking> {
  const pkg = mockPackages.find((item) => item.id === booking.packageId);
  if (!pkg || pkg.seatsLeft < booking.travelersCount) {
    throw new BookingConflictError();
  }

  pkg.seatsLeft -= booking.travelersCount;

  await query(
    `INSERT INTO bookings (id, user_id, package_id, customer_name, customer_email, travelers_count, travel_date, notes, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      booking.id,
      booking.userId ?? null,
      booking.packageId,
      booking.customerName,
      booking.customerEmail,
      booking.travelersCount,
      booking.travelDate,
      booking.notes,
      booking.status,
      booking.createdAt,
    ]
  );

  logEvent('info', 'booking.created', { bookingId: booking.id, packageId: booking.packageId });
  return booking;
}

export async function listBookingsByUser(userId: string): Promise<Booking[]> {
  const rows = await query<BookingRow>(
    'SELECT * FROM bookings WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return rows.map(rowToBooking);
}

export async function listBookingsByEmail(email: string): Promise<Booking[]> {
  const rows = await query<BookingRow>(
    'SELECT * FROM bookings WHERE lower(customer_email) = lower($1) ORDER BY created_at DESC',
    [email]
  );
  return rows.map(rowToBooking);
}

// Устаревшая функция — оставлена для совместимости
export async function listAllBookings(): Promise<Booking[]> {
  const rows = await query<BookingRow>('SELECT * FROM bookings ORDER BY created_at DESC');
  return rows.map(rowToBooking);
}

// mock для обратной совместимости (использовался в старом коде)
export { mockBookings };

// ─── Story tags (mock) ───────────────────────────────────────────────────────

function resolveStoryTag(story: Story): Story {
  if (!story.pubTagId) return story;
  const tag = mockStoryTags.find((t) => t.id === story.pubTagId);
  return tag ? { ...story, pubTag: tag.label } : story;
}

export function listTags(opts?: { onlyWithStories?: boolean }): StoryTag[] {
  const tags = mockStoryTags.map((t) => ({
    ...t,
    storiesCount: mockStories.filter((s) => s.status === 'published' && s.pubTagId === t.id).length,
  })).sort((a, b) => a.position - b.position);
  return opts?.onlyWithStories ? tags.filter((t) => t.storiesCount > 0) : tags;
}

export function getTagById(id: string): StoryTag | null {
  const t = mockStoryTags.find((t) => t.id === id);
  if (!t) return null;
  return { ...t, storiesCount: mockStories.filter((s) => s.status === 'published' && s.pubTagId === t.id).length };
}

export function getTagBySlug(slug: string): StoryTag | null {
  const t = mockStoryTags.find((t) => t.slug === slug);
  if (!t) return null;
  return { ...t, storiesCount: mockStories.filter((s) => s.status === 'published' && s.pubTagId === t.id).length };
}

export function updateTagLabel(id: string, label: string): StoryTag | null {
  const t = mockStoryTags.find((t) => t.id === id);
  if (!t) return null;
  t.label = label;
  mockStories.forEach((s) => {
    if (s.pubTagId === id) s.pubTag = label;
  });
  return getTagById(id);
}

// ─── Stories (mock) ──────────────────────────────────────────────────────────

export async function listPublishedStories(tag?: string): Promise<Story[]> {
  const published = mockStories.filter((s) => s.status === 'published').map(resolveStoryTag);
  if (!tag || tag === 'Все') return published;
  return published.filter((s) => s.pubTag === tag);
}

export function listStoriesPaginated(opts: {
  offset: number;
  limit: number;
  tagSlug?: string;
  status?: StoryStatus;
}): { stories: Story[]; total: number; hasMore: boolean } {
  const status = opts.status ?? 'published';
  let pool = mockStories.filter((s) => s.status === status).map(resolveStoryTag);
  if (opts.tagSlug) {
    const tag = mockStoryTags.find((t) => t.slug === opts.tagSlug);
    if (tag) pool = pool.filter((s) => s.pubTagId === tag.id);
    else pool = [];
  }
  const total = pool.length;
  const stories = pool.slice(opts.offset, opts.offset + opts.limit);
  return { stories, total, hasMore: opts.offset + opts.limit < total };
}

export async function listAllStories(): Promise<Story[]> {
  return [...mockStories].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export async function getStoryById(id: string): Promise<Story | null> {
  return mockStories.find((s) => s.id === id) ?? null;
}

export async function createStory(story: Story): Promise<Story> {
  mockStories.unshift(story);
  logEvent('info', 'story.submitted', { storyId: story.id, object: story.rawObject });
  return story;
}

export async function publishStory(
  id: string,
  fields: { pubTitle: string; pubQuote: string; pubTagId: string; pubObjectUrl: string }
): Promise<Story | null> {
  const story = mockStories.find((s) => s.id === id);
  if (!story) return null;
  const tag = mockStoryTags.find((t) => t.id === fields.pubTagId);
  story.status = 'published';
  story.publishedAt = new Date().toISOString();
  story.pubTitle = fields.pubTitle;
  story.pubQuote = fields.pubQuote;
  story.pubTagId = fields.pubTagId;
  story.pubTag = tag?.label ?? null;
  story.pubObjectUrl = fields.pubObjectUrl || null;
  logEvent('info', 'story.published', { storyId: id });
  return story;
}

export async function rejectStory(id: string, reason?: string): Promise<Story | null> {
  const story = mockStories.find((s) => s.id === id);
  if (!story) return null;
  story.status = 'rejected';
  story.rejectedAt = new Date().toISOString();
  story.rejectionReason = reason ?? null;
  logEvent('info', 'story.rejected', { storyId: id });
  return story;
}

export function getGalleryPhotos() {
  return mockGalleryPhotos;
}

export function getPublishedManagers(): { managerName: string; objectName: string; quote: string }[] {
  return mockStories
    .filter((s) => s.status === 'published' && s.rawManager)
    .map((s) => ({
      managerName: s.rawManager,
      objectName: s.rawObject,
      quote: s.pubQuote ?? '',
    }));
}
