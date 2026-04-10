import { describe, expect, it } from '@jest/globals';
import { mockPackages } from '@/lib/mock-data';
import { filterPackages, slugify } from '@/lib/utils';

describe('travel utils', () => {
  it('slugifies human-readable titles', () => {
    expect(slugify(' Swiss Alps Premium ')).toBe('swiss-alps-premium');
  });

  it('filters packages by destination and price', () => {
    const result = filterPackages(mockPackages, { destination: 'Ubud', maxPrice: 2000 });
    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe('bali-luxe-escape');
  });
});
