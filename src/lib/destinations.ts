export interface City {
  nameRu: string;
  nameEn: string; // to_city для API
  aliases?: string[];
}

export interface Country {
  nameRu: string;
  iso2: string; // to_country для API
  category: 'mass' | 'growing' | 'premium';
  cities: City[];
}

export const DESTINATIONS: Country[] = [
  // --- Массовые ---
  {
    nameRu: 'Турция',
    iso2: 'TR',
    category: 'mass',
    cities: [
      { nameRu: 'Анталья',         nameEn: 'Antalya' },
      { nameRu: 'Кемер',           nameEn: 'Kemer' },
      { nameRu: 'Алания',          nameEn: 'Alanya' },
      { nameRu: 'Белек',           nameEn: 'Belek' },
      { nameRu: 'Сиде',            nameEn: 'Side' },
      { nameRu: 'Бодрум',          nameEn: 'Bodrum' },
      { nameRu: 'Мармарис',        nameEn: 'Marmaris' },
      { nameRu: 'Стамбул',         nameEn: 'Istanbul', aliases: ['Константинополь'] },
    ],
  },
  {
    nameRu: 'Египет',
    iso2: 'EG',
    category: 'mass',
    cities: [
      { nameRu: 'Хургада',         nameEn: 'Hurghada' },
      { nameRu: 'Шарм-эль-Шейх',  nameEn: 'Sharm el-Sheikh', aliases: ['Шарм эш Шейх'] },
      { nameRu: 'Марса-Алам',      nameEn: 'Marsa Alam' },
    ],
  },
  {
    nameRu: 'Таиланд',
    iso2: 'TH',
    category: 'mass',
    cities: [
      { nameRu: 'Пхукет',          nameEn: 'Phuket' },
      { nameRu: 'Паттайя',         nameEn: 'Pattaya' },
      { nameRu: 'Самуи',           nameEn: 'Koh Samui' },
      { nameRu: 'Бангкок',         nameEn: 'Bangkok' },
    ],
  },
  {
    nameRu: 'ОАЭ',
    iso2: 'AE',
    category: 'mass',
    cities: [
      { nameRu: 'Дубай',           nameEn: 'Dubai' },
      { nameRu: 'Абу-Даби',        nameEn: 'Abu Dhabi' },
      { nameRu: 'Рас-эль-Хайма',   nameEn: 'Ras Al Khaimah' },
    ],
  },
  {
    nameRu: 'Китай',
    iso2: 'CN',
    category: 'mass',
    cities: [
      { nameRu: 'Хайнань (Санья)', nameEn: 'Sanya' },
      { nameRu: 'Пекин',           nameEn: 'Beijing' },
      { nameRu: 'Шанхай',          nameEn: 'Shanghai' },
    ],
  },

  {
    nameRu: 'Россия',
    iso2: 'RU',
    category: 'mass',
    cities: [
      { nameRu: 'Сочи',            nameEn: 'Sochi' },
      { nameRu: 'Краснодарский край', nameEn: 'Krasnodar' },
      { nameRu: 'Санкт-Петербург', nameEn: 'Saint Petersburg', aliases: ['Питер', 'СПб', 'Санкт Петербург'] },
      { nameRu: 'Казань',          nameEn: 'Kazan' },
      { nameRu: 'Москва',          nameEn: 'Moscow' },
    ],
  },

  // --- Растущие ---
  {
    nameRu: 'Вьетнам',
    iso2: 'VN',
    category: 'growing',
    cities: [
      { nameRu: 'Нячанг',          nameEn: 'Nha Trang' },
      { nameRu: 'Фукуок',          nameEn: 'Phu Quoc' },
      { nameRu: 'Дананг',          nameEn: 'Da Nang' },
    ],
  },
  {
    nameRu: 'Индонезия (Бали)',
    iso2: 'ID',
    category: 'growing',
    cities: [
      { nameRu: 'Бали',            nameEn: 'Bali' },
      { nameRu: 'Кута',            nameEn: 'Kuta' },
      { nameRu: 'Убуд',            nameEn: 'Ubud' },
    ],
  },
  {
    nameRu: 'Япония',
    iso2: 'JP',
    category: 'growing',
    cities: [
      { nameRu: 'Токио',           nameEn: 'Tokyo' },
      { nameRu: 'Осака',           nameEn: 'Osaka' },
      { nameRu: 'Киото',           nameEn: 'Kyoto' },
    ],
  },

  // --- Премиум ---
  {
    nameRu: 'Мальдивы',
    iso2: 'MV',
    category: 'premium',
    cities: [
      { nameRu: 'Мале',            nameEn: 'Male' },
      { nameRu: 'Атолл Ари',       nameEn: 'Ari Atoll' },
      { nameRu: 'Атолл Баа',       nameEn: 'Baa Atoll' },
    ],
  },
  {
    nameRu: 'Сейшелы',
    iso2: 'SC',
    category: 'premium',
    cities: [
      { nameRu: 'Маэ',             nameEn: 'Mahe' },
      { nameRu: 'Праслен',         nameEn: 'Praslin' },
      { nameRu: 'Ла-Диг',         nameEn: 'La Digue' },
    ],
  },
  {
    nameRu: 'Маврикий',
    iso2: 'MU',
    category: 'premium',
    cities: [
      { nameRu: 'Порт-Луи',        nameEn: 'Port Louis' },
      { nameRu: 'Гранд-Бэ',        nameEn: 'Grand Baie' },
      { nameRu: 'Флик-ан-Флак',    nameEn: 'Flic en Flac' },
    ],
  },
  {
    nameRu: 'Оман',
    iso2: 'OM',
    category: 'premium',
    cities: [
      { nameRu: 'Маскат',          nameEn: 'Muscat' },
      { nameRu: 'Салала',          nameEn: 'Salalah' },
    ],
  },
];

// Плоский список для автокомплита
export interface DestinationOption {
  label: string;       // "Кемер, Турция"
  labelShort: string;  // "Кемер"
  toCountry: string;   // "TR"
  toCity: string;      // "Kemer"
  aliases?: string[];
  category: 'mass' | 'growing' | 'premium' | 'catalog';
}

export const DESTINATION_OPTIONS: DestinationOption[] = DESTINATIONS.flatMap(country =>
  country.cities.map(city => ({
    label: `${city.nameRu}, ${country.nameRu}`,
    labelShort: city.nameRu,
    toCountry: country.iso2,
    toCity: city.nameEn,
    aliases: city.aliases,
    category: country.category,
  }))
);

// Только страны (для простого select)
export const COUNTRY_OPTIONS = DESTINATIONS.map(c => ({
  nameRu: c.nameRu,
  iso2: c.iso2,
  category: c.category,
}));

export function normalizeDestination(text: string) {
  return text.toLowerCase().replace(/ё/g, 'е').replace(/[\s.,–—-]+/g, ' ').trim();
}

export function initialDestination(country?: string, city?: string): DestinationOption | null {
  const known = DESTINATION_OPTIONS.find(d => d.toCountry === country && (!city || d.toCity === city));
  if (known) return known;
  if (!country) return null;
  const countryLabel = COUNTRY_OPTIONS.find(c => c.iso2 === country)?.nameRu ?? country;
  return {
    label: city ? `${city}, ${countryLabel}` : countryLabel,
    labelShort: city ?? countryLabel,
    toCountry: country,
    toCity: city ?? '',
    category: 'catalog',
  };
}
