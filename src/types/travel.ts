export type UserRole = 'guest' | 'user' | 'admin';

export type TravelCategory = 'warm' | 'cold' | 'active';

export type TravelPackage = {
  id: string;
  slug: string;
  title: string;
  destination: string;
  country: string;
  summary: string;
  description: string;
  priceFrom: number;
  durationDays: number;
  ratingAverage: number;
  reviewCount: number;
  heroImage: string;
  gallery: string[];
  seatsLeft: number;
  tags: string[];
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TravelReviewStatus = 'pending' | 'approved' | 'rejected';

export type TravelReview = {
  id: string;
  packageId: string;
  authorName: string;
  authorEmail: string;
  rating: number;
  comment: string;
  status: TravelReviewStatus;
  createdAt: string;
};

export type Booking = {
  id: string;
  packageId: string;
  customerName: string;
  customerEmail: string;
  travelersCount: number;
  travelDate: string;
  notes: string;
  status: 'pending' | 'confirmed' | 'failed';
  createdAt: string;
};

export type AppUser = {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  createdAt: string;
};

export type PackageFilters = {
  destination?: string;
  minPrice?: number;
  maxPrice?: number;
  duration?: number;
  query?: string;
  category?: TravelCategory;
};

export type AdminPackageFormValues = {
  title: string;
  slug: string;
  destination: string;
  country: string;
  summary: string;
  description: string;
  priceFrom: number;
  durationDays: number;
  heroImage: string;
  seatsLeft: number;
  tags: string[];
  isFeatured: boolean;
};
