# Свой чекаут через Level Travel API

## Идея

Вместо редиректа пользователя на White Label (`russia.mosgortur.ru`) — реализовать полноценный чекаут внутри нашего сервиса через Level Travel Booking API.

Пользователь выбирает тур, вводит данные (или они подтягиваются из профиля), оплачивает через Т-Банк — и остаётся на нашем сайте на всём пути.

---

## Сравнение подходов

| | WL (текущий) | Свой чекаут |
|---|---|---|
| Пользователь | Уходит на чужой сайт | Остаётся у нас |
| Деньги | Через Level Travel | Напрямую нам |
| Данные клиента | Недоступны | В нашей БД |
| Дизайн | Чужой | Наш |
| Уведомления | Level Travel | Наши |
| CRM (Битрикс24) | Не интегрирован | Заявка сразу в CRM |
| Сложность | Готово | Требует разработки |

---

## Флоу бронирования

```
Поиск туров
    ↓
Выбор тура (карточка на /tours)
    ↓
Актуализация цены (Level Travel API)
    ↓
Страница чекаута /checkout
  - данные туристов (из профиля или вручную)
  - контактные данные
    ↓
Создание бронирования (Level Travel API)
    ↓
Оплата (Т-Банк)
    ↓
Подтверждение оператору (Level Travel API)
    ↓
Страница успеха + PDF путёвки
    ↓
Запись в Битрикс24 (CRM)
```

---

## API Level Travel — ключевые эндпоинты

### 1. Актуализация цены
Перед бронированием обязательно проверить актуальность цены и доступность тура.

```
GET /tours/actualize?tour_id={tour_id}
```

**Ответ:**
```json
{
  "price": 125000,
  "available": true,
  "tour_id": "...",
  "expires_at": "2026-04-10T12:00:00Z"
}
```

### 2. Создание бронирования

```
POST /bookings
Content-Type: application/json

{
  "tour_id": "...",
  "tourists": [
    {
      "first_name": "Иван",
      "last_name": "Иванов",
      "middle_name": "Иванович",
      "dob": "1990-05-12",
      "passport_number": "7712345678",
      "passport_expiry": "2030-05-12",
      "citizenship": "RU",
      "gender": "M"
    }
  ],
  "contact": {
    "phone": "+79001234567",
    "email": "user@example.com"
  }
}
```

**Ответ:**
```json
{
  "booking_id": "...",
  "status": "pending_payment",
  "price": 125000,
  "payment_url": "https://..."
}
```

### 3. Подтверждение после оплаты

```
POST /bookings/{booking_id}/confirm
```

Вызывается после успешной оплаты через Т-Банк (вебхук).

### 4. Статус бронирования

```
GET /bookings/{booking_id}
```

---

## Стек реализации

### База данных (MySQL + Prisma)

```sql
-- Таблица бронирований
bookings (
  id, user_id, lt_booking_id,
  tour_id, tour_title, destination,
  start_date, end_date, nights,
  adults, kids,
  price, currency,
  status,           -- pending_payment | paid | confirmed | cancelled
  payment_id,       -- ID транзакции Т-Банк
  created_at, updated_at
)

-- Туристы в бронировании
booking_tourists (
  id, booking_id,
  first_name, last_name, middle_name,
  dob, passport_number, passport_expiry,
  citizenship, gender
)
```

### Профили туристов (уже в ЛК)

```sql
-- Сохранённые туристы пользователя
tourists (
  id, user_id,
  first_name, last_name, middle_name,
  dob, passport_number, passport_expiry,
  citizenship, gender,
  is_main              -- основной турист (сам пользователь)
)
```

### Оплата (Т-Банк)

1. Создать платёж через Т-Банк API с суммой и `order_id = booking_id`
2. Редирект пользователя на страницу оплаты Т-Банк
3. Т-Банк присылает вебхук об успехе → `POST /api/payment/webhook`
4. Мы вызываем `/bookings/{id}/confirm` у Level Travel
5. Записываем в Битрикс24

---

## Страницы

| Страница | Описание |
|----------|----------|
| `/checkout` | Форма с данными туристов + кнопка оплатить |
| `/checkout/payment` | Редирект на Т-Банк |
| `/checkout/success` | Успех, ссылка на скачивание PDF |
| `/account` | История бронирований с PDF документами |

---

## Что нужно уточнить у Level Travel

- Доступен ли Booking API для `partner_id=1297`
- Есть ли sandbox/тестовый режим для бронирований
- Какой формат данных паспорта (серия+номер или единой строкой)
- Есть ли вебхуки от операторов при изменении статуса тура

---

## Зависимости и порядок реализации

1. **БД** — MySQL + Prisma, таблицы `users`, `tourists`, `bookings`
2. **Auth** — NextAuth credentials, чтобы привязывать бронирования к пользователю
3. **Актуализация цены** — эндпоинт `/api/actualize`
4. **Чекаут UI** — страница `/checkout` с формой туристов
5. **Т-Банк** — интеграция оплаты
6. **Вебхук оплаты** — `/api/payment/webhook`
7. **Подтверждение** — вызов Level Travel после оплаты
8. **Битрикс24** — передача заявки в CRM
9. **PDF** — генерация путёвок (генератор уже готов)
