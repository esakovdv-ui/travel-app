import { BookingConflictError, DuplicateRegistrationError } from './errors';
import { logEvent } from './logger';
import { mockBookings, mockPackages, mockReviews } from './mock-data';
import { filterPackages, slugify } from './utils';
import { query, queryOne } from './db';
import type {
  AdminPackageFormValues,
  AppUser,
  Booking,
  PackageFilters,
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
