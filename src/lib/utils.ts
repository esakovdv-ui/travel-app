import type { PackageFilters, TravelPackage } from '@/types/travel';

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function formatCurrency(value: number, locale = 'ru-RU') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);
}

export function formatTravelDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date(value));
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getPackageCategory(tags: string[]): string | null {
  if (tags.includes('warm')) return 'warm';
  if (tags.includes('cold')) return 'cold';
  if (tags.includes('active')) return 'active';
  return null;
}

export function filterPackages(items: TravelPackage[], filters: PackageFilters) {
  return items.filter((item) => {
    const query = filters.query?.toLowerCase().trim();
    const matchesQuery =
      !query ||
      item.title.toLowerCase().includes(query) ||
      item.destination.toLowerCase().includes(query) ||
      item.country.toLowerCase().includes(query) ||
      item.tags.some((tag) => tag.toLowerCase().includes(query));

    const matchesDestination =
      !filters.destination || item.destination.toLowerCase() === filters.destination.toLowerCase();

    const matchesMinPrice = filters.minPrice === undefined || item.priceFrom >= filters.minPrice;
    const matchesMaxPrice = filters.maxPrice === undefined || item.priceFrom <= filters.maxPrice;
    const matchesDuration = filters.duration === undefined || item.durationDays === filters.duration;

    const matchesCategory = !filters.category || item.tags.includes(filters.category);

    return matchesQuery && matchesDestination && matchesMinPrice && matchesMaxPrice && matchesDuration && matchesCategory;
  });
}
