import type { AppUser, Booking, TravelPackage, TravelReview } from '@/types/travel';

export const mockPackages: TravelPackage[] = [
  {
    id: 'pkg-bali-luxe',
    slug: 'bali-luxe-escape',
    title: 'Бали: Роскошный побег',
    destination: 'Убуд',
    country: 'Индонезия',
    summary: 'Частные виллы, ритуалы велнес и эксклюзивные впечатления острова для пар.',
    description:
      'Остановитесь на вилле у края джунглей, начинайте утра с сеансов велнес под руководством инструктора, а после обеда исследуйте водопады, рисовые террасы и пляжные клубы с личным водителем.',
    priceFrom: 1890,
    durationDays: 7,
    ratingAverage: 4.9,
    reviewCount: 38,
    heroImage: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1200&q=80'
    ],
    seatsLeft: 6,
    tags: ['warm', 'wellness', 'beach', 'couples'],
    isFeatured: true,
    createdAt: '2026-03-01T08:00:00.000Z',
    updatedAt: '2026-03-10T08:00:00.000Z'
  },
  {
    id: 'pkg-alps-premium',
    slug: 'swiss-alps-premium',
    title: 'Швейцарские Альпы: Премиум',
    destination: 'Церматт',
    country: 'Швейцария',
    summary: 'Железнодорожные приключения в горах, шале и альпийские виды открыточного качества.',
    description:
      'Премиальный маршрут, построенный вокруг живописных железнодорожных маршрутов, горных ужинов под руководством гида и гибких экскурсий как для искателей приключений, так и для неспешных путешественников.',
    priceFrom: 2390,
    durationDays: 6,
    ratingAverage: 4.8,
    reviewCount: 26,
    heroImage: 'https://images.unsplash.com/photo-1508261305436-e3f893cb0f3f?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1200&q=80'
    ],
    seatsLeft: 4,
    tags: ['cold', 'mountains', 'luxury', 'winter'],
    isFeatured: true,
    createdAt: '2026-02-18T08:00:00.000Z',
    updatedAt: '2026-03-11T08:00:00.000Z'
  },
  {
    id: 'pkg-morocco-design',
    slug: 'morocco-design-journey',
    title: 'Марокко: Дизайн-путешествие',
    destination: 'Марракеш',
    country: 'Марокко',
    summary: 'Риады, ночи в пустыне и арт-впечатления в одном маршруте.',
    description:
      'С крыш медины до глэмпинга в Сахаре — этот маршрут сочетает архитектуру, кухню и мастер-классы с местными ремесленниками с достаточным количеством свободного времени для личного исследования.',
    priceFrom: 1490,
    durationDays: 8,
    ratingAverage: 4.7,
    reviewCount: 19,
    heroImage: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1489493887464-892be6d1daae?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1518544866330-95a6eb2e5e3a?auto=format&fit=crop&w=1200&q=80'
    ],
    seatsLeft: 9,
    tags: ['warm', 'culture', 'desert', 'food'],
    isFeatured: false,
    createdAt: '2026-02-25T08:00:00.000Z',
    updatedAt: '2026-03-05T08:00:00.000Z'
  },
  {
    id: 'pkg-iceland-fire-ice',
    slug: 'iceland-fire-ice',
    title: 'Исландия: Огонь и Лёд',
    destination: 'Рейкьявик',
    country: 'Исландия',
    summary: 'Гейзеры, ледники, северное сияние и вулканические пейзажи.',
    description:
      'Откройте для себя самый суровый и завораживающий уголок планеты. Ледники, горячие источники, водопады Скоугафосс и Сельяландсфосс, чёрные пляжи и незабываемое северное сияние над бескрайними полями лавы.',
    priceFrom: 2890,
    durationDays: 8,
    ratingAverage: 4.9,
    reviewCount: 22,
    heroImage: 'https://images.unsplash.com/photo-1504829857797-ddff29c27927?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1531168586646-a736fe579ffd?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1476611338391-6f395a0ebc7b?auto=format&fit=crop&w=1200&q=80'
    ],
    seatsLeft: 8,
    tags: ['cold', 'northern-lights', 'nature', 'active'],
    isFeatured: true,
    createdAt: '2026-02-10T08:00:00.000Z',
    updatedAt: '2026-03-08T08:00:00.000Z'
  },
  {
    id: 'pkg-thailand-islands',
    slug: 'thailand-golden-islands',
    title: 'Таиланд: Золотые острова',
    destination: 'Краби',
    country: 'Таиланд',
    summary: 'Изумрудные воды, белоснежные пляжи и лучший тайский сервис.',
    description:
      'Острова Пхи-Пхи, Краби и Ко-Ланта — три жемчужины Андаманского моря в одном маршруте. Снорклинг, морские каяки, традиционная тайская кухня и закаты, которые нельзя забыть.',
    priceFrom: 1290,
    durationDays: 10,
    ratingAverage: 4.8,
    reviewCount: 45,
    heroImage: 'https://images.unsplash.com/photo-1519451241324-20b4ea2c4220?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1200&q=80'
    ],
    seatsLeft: 12,
    tags: ['warm', 'beach', 'tropical', 'islands'],
    isFeatured: false,
    createdAt: '2026-01-20T08:00:00.000Z',
    updatedAt: '2026-03-01T08:00:00.000Z'
  },
  {
    id: 'pkg-norway-fjords',
    slug: 'norway-fjords-adventure',
    title: 'Норвегия: Мир фьордов',
    destination: 'Берген',
    country: 'Норвегия',
    summary: 'Трекинг, каяки и сказочные фьорды Скандинавии.',
    description:
      'Норвегия с её грандиозными фьордами — место для тех, кто ищет природу в её первозданном виде. Трекинг на Прекестулен, каяки по Согнефьорду, панорамная железная дорога Фломсбана и уютные норвежские деревушки.',
    priceFrom: 2190,
    durationDays: 9,
    ratingAverage: 4.7,
    reviewCount: 18,
    heroImage: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80'
    ],
    seatsLeft: 6,
    tags: ['cold', 'active', 'hiking', 'fjords', 'nature'],
    isFeatured: true,
    createdAt: '2026-02-05T08:00:00.000Z',
    updatedAt: '2026-03-09T08:00:00.000Z'
  }
];

export const mockReviews: TravelReview[] = [
  {
    id: 'rev-1',
    packageId: 'pkg-bali-luxe',
    authorName: 'Светлана Р.',
    authorEmail: 'svetlana@example.com',
    rating: 5,
    comment:
      'Маршрут был отточен до мелочей — от встречи в аэропорту до последнего ужина на пляже. Никакой спешки, только удовольствие.',
    status: 'approved',
    createdAt: '2026-03-09T08:00:00.000Z'
  },
  {
    id: 'rev-2',
    packageId: 'pkg-alps-premium',
    authorName: 'Амелия Т.',
    authorEmail: 'amelia@example.com',
    rating: 5,
    comment:
      'Прекрасный темп, отличный выбор отелей, а горный ужин стал самым запоминающимся моментом путешествия.',
    status: 'approved',
    createdAt: '2026-03-11T08:00:00.000Z'
  },
  {
    id: 'rev-3',
    packageId: 'pkg-iceland-fire-ice',
    authorName: 'Александр М.',
    authorEmail: 'alex@example.com',
    rating: 5,
    comment:
      'Северное сияние в первую же ночь — это незабываемо. Тур продуман до мелочей, гид невероятно знающий.',
    status: 'approved',
    createdAt: '2026-03-07T08:00:00.000Z'
  },
  {
    id: 'rev-4',
    packageId: 'pkg-morocco-design',
    authorName: 'Мария К.',
    authorEmail: 'maria@example.com',
    rating: 5,
    comment:
      'Марокко поразило нас с первого дня. Невероятные цвета, ароматы и теплота людей. Однозначно вернусь!',
    status: 'approved',
    createdAt: '2026-03-04T08:00:00.000Z'
  },
  {
    id: 'rev-5',
    packageId: 'pkg-norway-fjords',
    authorName: 'Дмитрий В.',
    authorEmail: 'dmitri@example.com',
    rating: 4,
    comment:
      'Фьорды потрясающие, трекинг сложный но того стоит. Рекомендую брать хорошую обувь и приходить подготовленным.',
    status: 'approved',
    createdAt: '2026-03-02T08:00:00.000Z'
  },
  {
    id: 'rev-6',
    packageId: 'pkg-thailand-islands',
    authorName: 'Анна С.',
    authorEmail: 'anna@example.com',
    rating: 5,
    comment:
      'Таиланд превзошёл все ожидания. Пляжи, еда, закаты — всё было идеальным. Организация на высшем уровне.',
    status: 'pending',
    createdAt: '2026-03-14T08:00:00.000Z'
  }
];

export const mockUsers: AppUser[] = [];
export const mockBookings: Booking[] = [];
