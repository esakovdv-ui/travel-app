export const APP_NAME = 'Мои путешествия';
export const APP_DESCRIPTION =
  'Премиальная платформа для поиска путешествий по всему миру. От тропических пляжей до заснеженных вершин.';
export const DEFAULT_OG_IMAGE = '/og-travel.jpg';
export const DEFAULT_PAGE_SIZE = 9;
export const ADMIN_ROLES = ['admin'] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  warm: 'Жаркие страны',
  cold: 'Холодные страны',
  active: 'Активный отдых'
};

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает',
  confirmed: 'Подтверждён',
  failed: 'Отменён'
};

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает',
  approved: 'Одобрен',
  rejected: 'Отклонён'
};

export const HOME_THEMATIC_COLLECTIONS = [
  {
    title: 'Спокойный пляжный отдых',
    description: 'Мягкие перелёты, первая линия и сценарии, где не нужно ничего усложнять.',
    href: '/tours?query=beach',
    eyebrow: 'Море / relax',
    accent: 'red',
    image:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80'
  },
  {
    title: 'Города для длинных выходных',
    description: 'Короткие поездки с плотным впечатлением: архитектура, еда, прогулки и ритм города.',
    href: '/tours?query=europe',
    eyebrow: 'City break',
    accent: 'blue',
    image:
      'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=1400&q=80'
  },
  {
    title: 'Маршруты в прохладу',
    description: 'Север, горы, озёра и поездки, где климат сам задаёт настроение отдыха.',
    href: '/tours?category=cold',
    eyebrow: 'North / fresh air',
    accent: 'blue',
    image:
      'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1400&q=80'
  },
  {
    title: 'Активные недели',
    description: 'Трекинг, серфинг, хайкинг и сборки, где движение становится частью впечатления.',
    href: '/tours?category=active',
    eyebrow: 'Move / adventure',
    accent: 'yellow',
    image:
      'https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=1400&q=80'
  }
] as const;
