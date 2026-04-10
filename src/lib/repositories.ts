import { BookingConflictError, DuplicateRegistrationError } from './errors';
import { logEvent } from './logger';
import { mockBookings, mockPackages, mockReviews, mockUsers } from './mock-data';
import { filterPackages, slugify } from './utils';
import type {
  AdminPackageFormValues,
  AppUser,
  Booking,
  PackageFilters,
  TravelReview,
  TravelReviewStatus
} from '@/types/travel';

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

export async function registerUser(user: AppUser) {
  const exists = mockUsers.some((item) => item.email.toLowerCase() === user.email.toLowerCase());
  if (exists) {
    throw new DuplicateRegistrationError();
  }

  mockUsers.push(user);
  logEvent('info', 'user.registered', { userId: user.id, email: user.email });
  return user;
}

export async function findUserByEmail(email: string) {
  return mockUsers.find((item) => item.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function createBooking(booking: Booking) {
  const pkg = mockPackages.find((item) => item.id === booking.packageId);
  if (!pkg || pkg.seatsLeft < booking.travelersCount) {
    throw new BookingConflictError();
  }

  pkg.seatsLeft -= booking.travelersCount;
  mockBookings.unshift(booking);
  logEvent('info', 'booking.created', {
    bookingId: booking.id,
    packageId: booking.packageId,
    travelersCount: booking.travelersCount
  });
  return booking;
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
    updatedAt: createdAt
  };

  mockPackages.unshift(created);
  return created;
}
