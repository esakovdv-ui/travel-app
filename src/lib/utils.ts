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

/**
 * Русское склонение по числу: plural(53, 'тур', 'тура', 'туров') → 'тура'.
 * Учитывает исключение 11–14 («11 туров», а не «11 тур»).
 */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  if (abs >= 11 && abs <= 14) return many;
  const last = abs % 10;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

/** «53 тура», «11 туров», «1 тур» */
export function toursLabel(n: number): string {
  return `${n} ${plural(n, 'тур', 'тура', 'туров')}`;
}

/** «53 отеля», «11 отелей», «1 отель» */
export function hotelsLabel(n: number): string {
  return `${n} ${plural(n, 'отель', 'отеля', 'отелей')}`;
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
