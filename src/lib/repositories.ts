import { BookingConflictError, DuplicateRegistrationError } from './errors';
import { logEvent } from './logger';
import { mockBookings, mockGalleryPhotos, mockPackages, mockReviews } from './mock-data';
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

// ─── Story tags (PostgreSQL) ─────────────────────────────────────────────────

interface TagRow {
  id: string;
  slug: string;
  label: string;
  position: number;
  stories_count: string;
}

function rowToTag(row: TagRow): StoryTag {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    position: row.position,
    storiesCount: Number(row.stories_count),
  };
}

const TAG_SELECT = `
  SELECT t.id, t.slug, t.label, t.position,
         COUNT(s.id) FILTER (WHERE s.status = 'published') AS stories_count
  FROM tags t
  LEFT JOIN stories s ON s.pub_tag_id = t.id
`;

export async function listTags(opts?: { onlyWithStories?: boolean }): Promise<StoryTag[]> {
  const rows = await query<TagRow>(`${TAG_SELECT} GROUP BY t.id ORDER BY t.position ASC`);
  const tags = rows.map(rowToTag);
  return opts?.onlyWithStories ? tags.filter((t) => t.storiesCount > 0) : tags;
}

export async function getTagById(id: string): Promise<StoryTag | null> {
  const row = await queryOne<TagRow>(`${TAG_SELECT} WHERE t.id = $1 GROUP BY t.id`, [id]);
  return row ? rowToTag(row) : null;
}

export async function getTagBySlug(slug: string): Promise<StoryTag | null> {
  const row = await queryOne<TagRow>(`${TAG_SELECT} WHERE t.slug = $1 GROUP BY t.id`, [slug]);
  return row ? rowToTag(row) : null;
}

export async function updateTagLabel(id: string, label: string): Promise<StoryTag | null> {
  const row = await queryOne<TagRow>(
    `UPDATE tags SET label = $2 WHERE id = $1
     RETURNING id, slug, label, position,
       (SELECT COUNT(*) FROM stories WHERE pub_tag_id = $1 AND status = 'published') AS stories_count`,
    [id, label]
  );
  return row ? rowToTag(row) : null;
}

// ─── Stories (PostgreSQL) ────────────────────────────────────────────────────

interface StoryRow {
  id: string;
  submitted_at: Date;
  status: string;
  published_at: Date | null;
  rejected_at: Date | null;
  rejection_reason: string | null;
  raw_author_name: string;
  raw_object: string;
  raw_period: string | null;
  raw_manager: string | null;
  raw_text: string;
  photos: string[];
  pub_title: string | null;
  pub_quote: string | null;
  pub_tag_id: string | null;
  pub_object_url: string | null;
  tag_label: string | null;
}

function rowToStory(row: StoryRow): Story {
  return {
    id: row.id,
    submittedAt: row.submitted_at instanceof Date ? row.submitted_at.toISOString() : String(row.submitted_at),
    status: row.status as StoryStatus,
    publishedAt: row.published_at ? row.published_at.toISOString() : null,
    rejectedAt: row.rejected_at ? row.rejected_at.toISOString() : null,
    rejectionReason: row.rejection_reason,
    rawAuthorName: row.raw_author_name,
    rawObject: row.raw_object,
    rawPeriod: row.raw_period ?? '',
    rawManager: row.raw_manager ?? '',
    rawText: row.raw_text,
    photos: row.photos ?? [],
    pubTitle: row.pub_title,
    pubQuote: row.pub_quote,
    pubTagId: row.pub_tag_id,
    pubTag: row.tag_label,
    pubObjectUrl: row.pub_object_url,
  };
}

const STORY_SELECT = `
  SELECT s.*, t.label AS tag_label
  FROM stories s
  LEFT JOIN tags t ON s.pub_tag_id = t.id
`;

export async function listStoriesPaginated(opts: {
  offset: number;
  limit: number;
  tagSlug?: string;
  status?: StoryStatus;
}): Promise<{ stories: Story[]; total: number; hasMore: boolean }> {
  const status = opts.status ?? 'published';
  const params: unknown[] = [status, opts.limit, opts.offset];
  let where = 'WHERE s.status = $1';

  if (opts.tagSlug) {
    where += ' AND t.slug = $4';
    params.push(opts.tagSlug);
  }

  const [rows, countRows] = await Promise.all([
    query<StoryRow>(
      `${STORY_SELECT} ${where} ORDER BY s.submitted_at DESC LIMIT $2 OFFSET $3`,
      params
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM stories s LEFT JOIN tags t ON s.pub_tag_id = t.id ${where}`,
      [status, ...(opts.tagSlug ? [opts.tagSlug] : [])]
    ),
  ]);

  const total = Number(countRows[0]?.count ?? 0);
  return { stories: rows.map(rowToStory), total, hasMore: opts.offset + opts.limit < total };
}

export async function listAllStories(): Promise<Story[]> {
  const rows = await query<StoryRow>(`${STORY_SELECT} ORDER BY s.submitted_at DESC`);
  return rows.map(rowToStory);
}

export async function getStoryById(id: string): Promise<Story | null> {
  const row = await queryOne<StoryRow>(`${STORY_SELECT} WHERE s.id = $1`, [id]);
  return row ? rowToStory(row) : null;
}

export async function createStory(story: Story): Promise<Story> {
  await query(
    `INSERT INTO stories
       (id, status, raw_author_name, raw_object, raw_period, raw_manager, raw_text, photos)
     VALUES ($1, 'new', $2, $3, $4, $5, $6, $7)`,
    [
      story.id,
      story.rawAuthorName,
      story.rawObject,
      story.rawPeriod || null,
      story.rawManager || null,
      story.rawText,
      story.photos,
    ]
  );
  logEvent('info', 'story.submitted', { storyId: story.id, object: story.rawObject });
  return story;
}

export async function publishStory(
  id: string,
  fields: { pubTitle: string; pubQuote: string; pubTagId: string; pubObjectUrl: string }
): Promise<Story | null> {
  const row = await queryOne<StoryRow>(
    `UPDATE stories SET
       status = 'published',
       published_at = now(),
       pub_title = $2,
       pub_quote = $3,
       pub_tag_id = $4,
       pub_object_url = NULLIF($5, '')
     WHERE id = $1
     RETURNING *`,
    [id, fields.pubTitle, fields.pubQuote, fields.pubTagId, fields.pubObjectUrl]
  );
  if (!row) return null;
  const tag = await queryOne<{ label: string }>('SELECT label FROM tags WHERE id = $1', [fields.pubTagId]);
  logEvent('info', 'story.published', { storyId: id });
  return rowToStory({ ...row, tag_label: tag?.label ?? null });
}

export async function importStories(
  candidates: {
    rawAuthorName: string;
    rawObject: string;
    rawPeriod: string;
    rawManager: string;
    rawText: string;
    sourceOrderId: string;
  }[]
): Promise<{ imported: number; duplicates: number }> {
  let imported = 0;

  for (const c of candidates) {
    const row = await queryOne<{ id: string }>(
      `INSERT INTO stories
         (id, status, raw_author_name, raw_object, raw_period, raw_manager, raw_text, photos, source_order_id)
       VALUES (gen_random_uuid()::text, 'new', $1, $2, $3, $4, $5, '{}', $6)
       ON CONFLICT (source_order_id) WHERE source_order_id IS NOT NULL DO NOTHING
       RETURNING id`,
      [c.rawAuthorName, c.rawObject, c.rawPeriod || null, c.rawManager || null, c.rawText, c.sourceOrderId]
    );
    if (row) imported++;
  }

  const duplicates = candidates.length - imported;
  if (imported > 0) logEvent('info', 'stories.imported', { imported, duplicates });
  return { imported, duplicates };
}

export async function rejectStory(id: string, reason?: string): Promise<Story | null> {
  const row = await queryOne<StoryRow>(
    `UPDATE stories SET
       status = 'rejected',
       rejected_at = now(),
       rejection_reason = NULLIF($2, '')
     WHERE id = $1
     RETURNING *`,
    [id, reason ?? '']
  );
  if (!row) return null;
  logEvent('info', 'story.rejected', { storyId: id });
  return rowToStory({ ...row, tag_label: null });
}

export async function revertStory(id: string): Promise<Story | null> {
  const row = await queryOne<StoryRow>(
    `UPDATE stories SET status = 'new', published_at = NULL, rejected_at = NULL, rejection_reason = NULL
     WHERE id = $1 RETURNING *`,
    [id]
  );
  if (!row) return null;
  logEvent('info', 'story.reverted', { storyId: id });
  return rowToStory({ ...row, tag_label: null });
}

export function getGalleryPhotos() {
  return mockGalleryPhotos;
}

export async function getPublishedManagers(): Promise<{ managerName: string; objectName: string; quote: string }[]> {
  const rows = await query<{ raw_manager: string; raw_object: string; pub_quote: string | null }>(
    `SELECT raw_manager, raw_object, pub_quote
     FROM stories
     WHERE status = 'published' AND raw_manager IS NOT NULL AND raw_manager != ''
     ORDER BY published_at DESC`
  );
  return rows.map((r) => ({
    managerName: r.raw_manager,
    objectName: r.raw_object,
    quote: r.pub_quote ?? '',
  }));
}
