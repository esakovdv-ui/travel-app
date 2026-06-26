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
| БД | PostgreSQL 14 — users, bookings, stories, tags |
| Auth | JWT в httpOnly cookie (собственная реализация) |
| Аналитика | Яндекс.Метрика (`src/components/analytics/yandex-metrika.tsx`) |
| Платежи | Т-Банк (не подключён) |
| CRM | Битрикс24 — лиды лендингов (`crm.lead.add`, `crm.deal.add`) |
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
| О сервисе | `/about` | Готова |
| Истории путешествий | `/stories` | **Работает** — editorial grid, карусель, форма, PostgreSQL |
| Страница тура/пакета | `/packages/[slug]` | Готова (mock-данные) |
| Оформление заказа | `/checkout` | UI готов, не подключён к платёжке |
| Личный кабинет | `/account` | **Работает** — реальные данные из БД, защищён middleware |
| Вход | `/auth/login` | **Работает** — JWT авторизация, cookie |
| Регистрация | `/auth/register` | **Работает** — сохранение в PostgreSQL |

### Лендинги (`/public/`)

| Лендинг | Путь | Статус |
|---------|------|--------|
| Власьево | `/vlasevo` | **Работает** — форма заявки, API смен, admin |
| Радуга | `/raduga` | **Работает** — форма заявки, API смен, admin |
| Власьево promo | `/vlasevo-promo` | **Работает** — промо-лендинг, admin |
| Перебронирование | `/rebooking` | **Работает** — виджет ТурВизора, лид в Битрикс24 |

### Админка (`src/app/admin/`)

| Страница | Путь | Статус |
|----------|------|--------|
| Дашборд | `/admin` | Готов (**не защищён паролем**) |
| Управление пакетами | `/admin/packages` | Готов (mock-данные) |
| Управление отзывами | `/admin/reviews` | Готов (mock-данные) |
| Тематические подборки | `/admin/thematic-rows` | Работает |
| Модерация историй | `/admin/stories` | **Работает** — реальная БД, публикация/отклонение |
| Модерация историй (карточка) | `/admin/stories/[id]` | **Работает** |
| Управление тегами | `/admin/story-tags` | Готов (Анна может переименовывать теги) |
| Админка Власьево | `/vlasevo-admin` | Работает |
| Админка Радуга | `/raduga-admin` | Работает |

### API (`src/app/api/`)

| Роут | Метод | Что делает |
|------|-------|-----------|
| `/api/search` | GET | Поиск туров/отелей через Level Travel API |
| `/api/me` | GET | Возвращает данные текущей сессии |
| `/api/generate-pdf` | POST | Генерация PDF путевого документа |
| `/api/stories` | GET | Список опубликованных историй с пагинацией |
| `/api/vlasevo-lead` | POST | Форма заявки Власьево |
| `/api/vlasevo-shifts` | GET | Смены Власьево |
| `/api/raduga-lead` | POST | Форма заявки Радуга |
| `/api/raduga-shifts` | GET | Смены Радуга |
| `/api/rebooking-lead` | POST | Лид перебронирования → Битрикс24 `crm.lead.add` |

---

## База данных (PostgreSQL)

**Сервер:** `72.56.32.183`, порт `5432`, БД `travel_db`, пользователь `travel_user`

**Таблицы:**

```sql
users     — id, email, password_hash, first_name, last_name, role, created_at
bookings  — id, user_id, package_id, customer_name, customer_email,
            travelers_count, travel_date, notes, status, created_at
tags      — id, slug, label, position, created_at
            (8 тегов: family, beach, mountains, wellness, active, camp, city, weekend)
stories   — id, submitted_at, status, published_at, rejected_at, rejection_reason,
            raw_author_name, raw_object, raw_period, raw_manager, raw_text, photos[],
            pub_title, pub_quote, pub_tag_id → tags.id, pub_object_url
```

**Миграции:**
- `scripts/migrate.sql` — users, bookings
- `scripts/migrate-stories.sql` — tags, stories (с seed тегов)

**Подключение в коде:**
- `src/lib/db.ts` — Pool из пакета `pg`
- `src/lib/repositories.ts` — все функции работы с данными (реальный SQL)

**Что ещё на mock-данных** (не трогать):
- Пакеты туров (`mockPackages`)
- Отзывы (`mockReviews`)
- Фото галереи (`mockGalleryPhotos`)

### Локальная разработка с БД — SSH-туннель

```bash
# Запускать в отдельном терминале
ssh -L 5432:localhost:5432 root@72.56.32.183 -N
```

`.env.local` на локальной машине:
```env
DATABASE_URL=postgresql://travel_user:VD0HxTqhtaMyI4AdOcwNu8gAo@localhost:5432/travel_db
```

---

## Авторизация и сессии

- Регистрация/вход сохраняют пользователя в PostgreSQL
- Пароль хешируется через SHA-256 (`src/lib/security.ts`)
- JWT-токен в `httpOnly` cookie `mt_session` на 30 дней
- `src/lib/session.ts` — читает и верифицирует сессию на сервере
- `src/middleware.ts` — защищает `/account`, редиректит на `/auth/login`
- `COOKIE_SECURE=true` в `.env` включает secure-флаг (нужен при HTTPS)

---

## Страница историй путешествий (`/stories`)

### Публичная часть
- **Editorial grid** — 1 hero-карточка на всю ширину + 3 карточки в ряд под ней
- **Карусель** — истории с 5-й, горизонтальный скролл
- **Фильтры** — по тегам из БД, динамические
- **Форма подачи** — поля: автор, объект (текст), история, менеджер, период, фото

### Админка модерации (`/admin/stories`)
- Очередь входящих историй со статусами `new / published / rejected`
- При публикации Анна заполняет: заголовок, цитату, тег, ссылку на объект
- Оригинальный текст клиента хранится отдельно, на сайт не выводится напрямую

### Теги (`/admin/story-tags`)
- Анна может переименовывать теги через inline-редактирование
- `slug` не меняется — только `label`
- При переименовании обновляется везде автоматически

### Дизайн
- Шрифты: Unbounded (заголовки) + Manrope (основной текст)
- Цвета и радиусы — стандартная дизайн-система проекта

---

## Инфраструктура

| Параметр | Значение |
|---|---|
| Сервер | 72.56.32.183 (Timeweb, Ubuntu 22.04) |
| Пользователь | root |
| Приложение | `/home/travel-app` |
| Скрипт деплоя | `/home/deploy.sh` |
| Деплой-команда | `ssh root@72.56.32.183 "bash /home/deploy.sh"` |
| PM2 | `pm2 list` / `pm2 restart travel-app` |
| PostgreSQL | `sudo -u postgres psql -d travel_db` |
| GitHub | github.com/esakovdv-ui/travel-app |
| CI/CD | GitHub Actions → `.github/workflows/deploy.yml` |
| Ветки | `feature/dima`, `feature/arthur` → PR → `main` |

### Скрипт деплоя `/home/deploy.sh`

```bash
git fetch origin
git checkout main
git reset --hard origin/main
npm install
npm run build
pm2 restart travel-app
# + прогрев кэша тематических блоков
```

> Важно: всегда `fetch → checkout main → reset --hard`.
> Никогда не использовать `git pull` — накапливает расхождение веток.

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

## Level Travel API (`src/lib/leveltravel.ts`)

Версия: `v3.7`. Флоу поиска:

```
enqueueSearch() → pollUntilComplete() → getHotels()
```

- Формат дат: `DD.MM.YYYY`
- `search_type`: `auto` → для РФ `hotel`, для других стран `package`
- Координаты отеля: поля `lat` и `long` (не `lon`)

---

## Переменные окружения

**На сервере** (`/home/travel-app/.env`):
```env
DATABASE_URL=postgresql://travel_user:...@localhost:5432/travel_db
JWT_SECRET=...
COOKIE_SECURE=true
NEXT_PUBLIC_LT_PARTNER_TOKEN=...
NEXT_PUBLIC_WL_BASE_URL=...
```

**Локально** (`.env.local`, не коммитить):
```env
DATABASE_URL=postgresql://travel_user:...@localhost:5432/travel_db
NEXT_PUBLIC_LT_PARTNER_TOKEN=...
```

---

## Правила работы команды

- Каждый работает в своей ветке: `feature/dima` или `feature/arthur`
- Изменения в `main` только через Pull Request
- Прямой пуш в `main` запрещён (branch protection)
- После мержа PR — деплой вручную: `ssh root@72.56.32.183 "bash /home/deploy.sh"`
- Коммиты на русском, понятно: «Добавил фильтр по тегам», а не «fix»

---

## Changelog

### Июнь 2026 — Сервис перебронирования `/rebooking`
- [x] Лендинг [`public/rebooking.html`](public/rebooking.html) — параметры из URL (заявка, сертификат, ФИО, состав, цена, даты)
- [x] Виджет ТурВизора (module `9978253`) с предзаполнением туристов/даты/ночей, без фильтра по направлению
- [x] API [`/api/rebooking-lead`](src/app/api/rebooking-lead/route.ts) → [`bitrix-rebooking-lead.ts`](src/lib/bitrix-rebooking-lead.ts) → `crm.lead.add`
- [x] Отдельный вебхук: `REBOOKING_WEBHOOK_TOKEN` (не смешивается с camp-deals)
- [x] Генератор ссылок: `node scripts/generate-rebooking-links.js`
- [x] Rewrite `/rebooking` в [`next.config.ts`](next.config.ts)

### Июнь 2026 — Истории путешествий, лендинги, инфра
- [x] Страница `/stories` — editorial grid, карусель, фильтры по тегам, галерея
- [x] Форма подачи истории с загрузкой фото
- [x] Админка модерации `/admin/stories` — очередь, публикация, отклонение
- [x] Управление тегами `/admin/story-tags` — переименование через UI
- [x] PostgreSQL: таблицы `tags` (8 тегов) и `stories`
- [x] `src/lib/repositories.ts` переведён с mock на реальный SQL
- [x] Лендинги Власьево и Радуга перенесены в `main`
- [x] Яндекс.Метрика подключена
- [x] `deploy.sh` исправлен: `fetch → checkout main → reset --hard`
- [x] Расхождение веток `feature/dima-auth` / `main` устранено

### Апрель 2026 — Авторизация, личный кабинет, страница «О сервисе»
- [x] PostgreSQL подключена (таблицы users, bookings)
- [x] Регистрация и вход с хешированием пароля и JWT cookie
- [x] Личный кабинет — реальные данные из БД, защищён middleware
- [x] Хедер с аватаром и дропдауном для авторизованного пользователя
- [x] Страница `/about`

### Март 2026 — Поиск, карта, мобильная адаптация, CI/CD
- [x] Интеграция с Level Travel API
- [x] Leaflet карта с маркерами-ценниками
- [x] Fullscreen layout на `/tours` и `/hotels`
- [x] Деплой на VPS, PM2, GitHub Actions CI/CD

---

## Roadmap

- [ ] Защита админки паролем
- [ ] Домен + SSL / HTTPS
- [ ] Email-уведомления (в т.ч. Анне при новой истории)
- [ ] Load more для историй (кнопка «Показать ещё 6»)
- [ ] Платёжная система (Т-Банк)
- [x] Интеграция с Битрикс24 (лендинги vlasevo/raduga/rebooking)
- [ ] Полная синхронизация заказов WL → Битрикс24
- [ ] Страница деталей тура с реальными данными из LT API
- [ ] Пакеты туров и отзывы — перевод с mock на PostgreSQL
- [ ] bitrix-deal-chat (Битрикс24 фича) — проверить статус и обновить
