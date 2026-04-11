# Мои Путешествия — Обзор проекта

Туристический маркетплейс на базе white-label платформы Level Travel.
Пользователь ищет тур → нажимает «Смотреть» → уходит на WL Level Travel для бронирования.

---

## Стек

| Слой | Технология |
|------|-----------|
| Фреймворк | Next.js 15 (App Router) |
| UI | React 19, CSS Modules |
| Типизация | TypeScript + Zod |
| Иконки | Phosphor Icons |
| Шрифты | Manrope (основной) + Unbounded (логотип) |
| Карта | Leaflet + react-leaflet (тайлы CartoDB Voyager) |
| PDF | Python 3 + ReportLab |
| БД | PostgreSQL (подключена, таблицы users + bookings) |
| Auth | JWT в httpOnly cookie (собственная реализация) |
| Платежи | Т-Банк (не подключён) |
| CRM | Битрикс24 (не подключён) |
| Контент | Level Travel API v3.7 |
| Деплой | VPS Timeweb, Ubuntu 22.04, IP 72.56.32.183 |

---

## Страницы

### Публичные (`src/app/(public)/`)

| Страница | Путь | Статус |
|----------|------|--------|
| Главная | `/` | Работает — тематические подборки из LT API |
| Поиск туров | `/tours` | Работает — реальные данные LT API, карта, фильтры |
| Поиск отелей | `/hotels` | Работает — реальные данные LT API, карта, фильтры |
| О сервисе | `/about` | Готова — hero, преимущества, как работает, направления, отзывы |
| Страница тура/пакета | `/packages/[slug]` | Готова (mock-данные) |
| Оформление заказа | `/checkout` | UI готов, не подключён к платёжке |
| Личный кабинет | `/account` | **Работает** — реальные данные из БД, защищён middleware |
| Вход | `/auth/login` | **Работает** — JWT авторизация, cookie |
| Регистрация | `/auth/register` | **Работает** — сохранение в PostgreSQL |

### Админка (`src/app/admin/`)

| Страница | Путь | Статус |
|----------|------|--------|
| Дашборд | `/admin` | Готов (mock-данные, **не защищён паролем**) |
| Управление пакетами | `/admin/packages` | Готов (mock-данные) |
| Управление отзывами | `/admin/reviews` | Готов (mock-данные) |
| Тематические подборки | `/admin/thematic-rows` | Готов |

### API (`src/app/api/`)

| Роут | Метод | Что делает |
|------|-------|-----------|
| `/api/search` | GET | Поиск туров/отелей через Level Travel API |
| `/api/me` | GET | Возвращает данные текущей сессии (force-dynamic) |
| `/api/generate-pdf` | POST | Генерация PDF путевого документа |

---

## Авторизация и сессии

- Регистрация/вход сохраняют пользователя в PostgreSQL
- Пароль хешируется через SHA-256 (`src/lib/security.ts`)
- После входа создаётся JWT-токен, сохраняется в `httpOnly` cookie `mt_session` на 30 дней
- `src/lib/session.ts` — читает и верифицирует сессию на сервере
- `src/middleware.ts` — защищает `/account`, редиректит на `/auth/login` без сессии
- `src/components/layout/user-menu.tsx` — компонент в хедере: аватар + дропдаун (кабинет, настройки, выйти)
- Сессия передаётся с сервера через `layout.tsx` → `SiteHeader` → `UserMenu` (без мигания)
- `COOKIE_SECURE=true` в `.env` включает secure-флаг (нужен при HTTPS)

---

## База данных (PostgreSQL)

**Сервер:** localhost:5432, БД `travel_db`, пользователь `travel_user`

**Таблицы:**

```sql
users     — id, email, password_hash, first_name, last_name, role, created_at
bookings  — id, user_id, package_id, customer_name, customer_email,
            travelers_count, travel_date, notes, status, created_at
```

**Миграция:** `scripts/migrate.sql` — запускать при первом деплое или смене схемы.

---

## Ключевые компоненты

### Layout
- **SiteHeader** — фиксированный хедер с 3 состояниями: expanded (поиск развёрнут), compact pill (при скролле), nav (прочие страницы). Читает сессию серверно и передаёт в `UserMenu`.
- **UserMenu** — показывает кнопку «Войти» или аватар с дропдауном в зависимости от сессии. Получает `initialUser` с сервера.
- **SiteFooter / ConditionalFooter** — скрывает футер на `/tours` и `/hotels` (fullscreen-режим с картой).

### Поиск
- **SearchBar** — единый компонент строки поиска. Два таба: «Отели» и «Туры» (с полем Откуда).
- **DestinationSearch** — автокомплит по статической базе направлений
- **DateRangePicker** — двойной календарь с диапазоном дат и гибкостью (±1 / ±2 дня). На мобиле — один месяц.

### Страницы результатов (`/tours`, `/hotels`)
- Fullscreen layout: сайдбар фильтров | список карточек | фиксированная карта
- **HotelCard** — карточки `card` (вертикальные) и `row` (горизонтальные, Яндекс-стиль)
- **FiltersPanel** — фильтры: цена, звёзды, рейтинг, питание, регион, пляж, мгновенное подтверждение
- **HotelMap** — Leaflet карта с маркерами-ценниками, попапом по клику, FitBounds

---

## Level Travel API (`src/lib/leveltravel.ts`)

Версия: `v3.7`. Флоу поиска:

```
enqueueSearch() → pollUntilComplete() → getHotels()
```

- Формат дат: `DD.MM.YYYY`
- `search_type`: `auto` → для РФ `hotel`, для других стран `package`
- Координаты отеля: поля `lat` и `long` (не `lon`)

---

## Дизайн-система (`src/app/globals.css`)

```css
--c-red:    #e8272a   /* CTA-кнопки, акценты */
--c-blue:   #0c2461   /* основной бренд */
--c-yellow: #f4a102   /* третичный акцент */
--c-bg:     #f5f1e8   /* бежевый фон */

--radius-pill: 999px  /* кнопки, строка поиска */
--radius-xl:   24px   /* карточки, поповеры */
--radius-card: 14px   /* карточки туров */
```

---

## Инфраструктура

| Параметр | Значение |
|---|---|
| Сервер | 72.56.32.183 (Timeweb, Ubuntu 22.04) |
| Пользователь | root |
| Приложение | `/home/travel-app` |
| Скрипт деплоя | `/home/deploy.sh` |
| PM2 | `pm2 list` / `pm2 restart travel-app` |
| PostgreSQL | `sudo -u postgres psql -d travel_db` |
| GitHub | github.com/esakovdv-ui/travel-app |
| CI/CD | GitHub Actions → `.github/workflows/deploy.yml` |
| Ветки | `feature/dima`, `feature/arthur` → PR → `main` |

---

## Переменные окружения (`.env`)

```env
DATABASE_URL=postgresql://travel_user:...@localhost:5432/travel_db
JWT_SECRET=...                        # минимум 32 символа
COOKIE_SECURE=true                    # включить при HTTPS
NEXT_PUBLIC_LT_PARTNER_TOKEN=...      # API-ключ Level Travel
NEXT_PUBLIC_WL_BASE_URL=...           # Базовый URL white-label
```

---

## Правила работы команды

- Каждый работает в своей ветке: `feature/dima` или `feature/arthur`
- Изменения попадают в `main` только через Pull Request
- Прямой пуш в `main` запрещён (branch protection)
- После мержа PR GitHub Actions автоматически деплоит на сервер

---

## Changelog

### Апрель 2026 — Авторизация, личный кабинет, страница «О сервисе»
- [x] PostgreSQL подключена (таблицы users, bookings)
- [x] Регистрация и вход с хешированием пароля и JWT cookie
- [x] Личный кабинет показывает реальные данные пользователя и бронирования
- [x] Middleware защищает `/account` — редирект на логин без сессии
- [x] Хедер показывает аватар и дропдаун для авторизованного пользователя
- [x] Сессия передаётся с сервера (без мигания кнопки «Войти»)
- [x] Все ошибки валидации и авторизации на русском языке
- [x] Кнопка «Выйти» в кабинете и в дропдауне хедера
- [x] Создана страница `/about` — hero, преимущества, как работает, направления, отзывы, CTA

### Март 2026 — Поиск, карта, мобильная адаптация, CI/CD
- [x] Интеграция с Level Travel API — реальные данные на `/tours` и `/hotels`
- [x] Фильтрация результатов на клиенте (цена, звёзды, рейтинг, питание, регион, пляж)
- [x] Leaflet карта с маркерами-ценниками, FitBounds, попап при клике
- [x] Fullscreen layout на `/tours` и `/hotels`
- [x] Мобильная адаптация поиска: одна строка, один месяц в календаре
- [x] Деплой на VPS, Nginx + PM2, GitHub Actions CI/CD
- [x] Ветки и PR-процесс, защита main

---

## Roadmap (не реализовано)

- [ ] Защита админки паролем (сейчас открыта всем)
- [ ] Домен + SSL / HTTPS
- [ ] Кнопки категорий на главной (Жаркие страны, Пляжи и т.д.) — реальный поиск по странам
- [ ] Платёжная система (Т-Банк)
- [ ] Интеграция с Битрикс24
- [ ] Email-уведомления
- [ ] PDF путевого документа — триггер из кабинета или по статусу брони
- [ ] Страница деталей тура с реальными данными из LT API
