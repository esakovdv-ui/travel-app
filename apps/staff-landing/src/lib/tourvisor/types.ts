// ─── Справочники ────────────────────────────────────────────────────────────

export interface DepartureCity {
  id: number
  name: string
  nameGenitive: string
}

export interface Country {
  id: number
  name: string
}

export interface MealType {
  id: number
  name: string
  russianName: string
  fullName: string
  fullRussianName: string
}

// ─── Поиск ──────────────────────────────────────────────────────────────────

export interface StartSearchResponse {
  searchId: number
}

export interface SearchStatus {
  searchId: number
  status: string
  progress: number
  minPrice: number
  timePassed: number
}

export interface TourSummary {
  id: string
  name: string
  date: string
  nights: number
  adults: number
  childs: number
  price: number
  currency: string
  meal: { id: number; name: string; fullName: string }
  operator: { id: number; name: string; fullName: string; russianName: string }
  flightNights: number
  flightPlace: number
  hotelPlace: number
  isCharter: boolean
  isPromo: boolean
  placement: string
  roomId: number | null
  roomType: string
}

export interface HotelSearchResult {
  id: number
  name: string
  category: number
  rating: number
  country: { id: number; name: string }
  region: { id: number; countryId: number; name: string }
  subRegion?: { id: number; regionId: number; name: string }
  latitude: number
  longitude: number
  picturelink: string
  hasPictures: boolean
  hasDescription: boolean
  hotelDescription?: string
  hotelDescriptionLink?: string
  seaDistance?: number
  currency: string
  price: number
  tours: TourSummary[]
}

// ─── Детали тура ────────────────────────────────────────────────────────────

export interface TourDetail {
  id: string
  name: string
  date: string
  nights: number
  adults: number
  childs: number
  price: number
  currency: string
  placement: string
  roomId: number | null
  roomType: string
  isCharter: boolean
  isPromo: boolean
  flightNights: number
  flightPlace: number
  hotelPlace: number
  hotelDescription?: string
  operatorLink?: string
  picture?: string
  departure: { id: number; name: string }
  meal: { id: number; name: string; fullName: string }
  operator: { id: number; name: string }
  hotel: {
    id: number
    name: string
    category: number
    rating: number
    country: { id: number; name: string }
    region: { id: number; countryId: number; name: string }
    subRegion?: { id: number; regionId: number; name: string }
    common: { latitude: number; longitude: number }
    type: number
  }
}

// ─── Описание отеля / номера ────────────────────────────────────────────────

export interface HotelDescription {
  id: number
  name: string
  category: number
  rating: number
  type: number
  country: { id: number; name: string }
  region: { id: number; countryId: number; name: string }
  subRegion?: { id: number; regionId: number; name: string }
  images: string[]
  common: {
    latitude: number
    longitude: number
    address?: string
    build?: string
    description?: string
    phone?: string
    place?: string
    repair?: string
    site?: string
    square?: string
  }
  infrastructure: { beach?: string; territory?: string }
  meals: { description?: string; list?: string }
  roomTypes: string
  services: {
    animation?: string
    available?: string
    child?: string
    free?: string
    inRoom?: string
    servicesPay?: string
    tags: { id: number; name: string; items: { id: number; name: string }[] }[]
  }
}

export interface HotelRoom {
  id: number
  name: string
  description?: string
  comment?: string
  area?: number
  bedroomCount?: number
  roomCount?: number
  hasBalcony?: boolean
  hasKitchen?: boolean
  sleepingPlaces?: string
  location?: string
  viewDescription?: string
  services?: string
  images: string[]
}
