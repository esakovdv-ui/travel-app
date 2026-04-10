# Мои Путешествия — Travel Marketplace

## Правила работы с репозиторием

### Ветки
- `main` — продакшн, защищена. Прямой пуш запрещён
- `feature/dima` — ветка Димы
- `feature/arthur` — ветка Артура

### Процесс работы

1. **Перед началом задачи** — обновить свою ветку:
   ```bash
   git checkout feature/dima   # или feature/arthur
   git pull origin main        # подтянуть актуальный код
   ```

2. **Работаешь, сохраняешь изменения:**
   ```bash
   git add .
   git commit -m "Краткое описание что сделал"
   git push origin feature/dima
   ```

3. **Когда задача готова — создаёшь Pull Request:**
   - Заходишь на github.com/esakovdv-ui/travel-app
   - Нажимаешь **Compare & pull request**
   - Описываешь что сделал → **Create pull request**
   - Второй участник проверяет и нажимает **Merge**

4. **После мержа — деплой на сервер:**
   ```bash
   ssh root@72.56.32.183 "/home/deploy.sh"
   ```

5. **Если нужно откатиться:**
   ```bash
   ssh root@72.56.32.183
   cd /home/travel-app
   git log --oneline        # смотришь историю
   git checkout abc1234     # переключаешься на нужный коммит
   npm run build && pm2 restart travel-app
   ```

### Главные правила
- Никогда не коммитить напрямую в `main`
- Всегда подтягивать актуальный код перед началом работы (`git pull`)
- Описывать коммиты понятно: «Добавил фильтр по звёздам», а не «fix» или «update»

---

Next.js 15 + React 19 + TypeScript приложение для продажи туров и отелей через White Label API Level Travel.

---

## Стек

- **Framework:** Next.js 15 App Router
- **UI:** React 19, CSS Modules (без UI-библиотек)
- **Language:** TypeScript + Zod
- **Fonts:** Manrope (основной) + Unbounded (логотип)
- **Map:** Leaflet + react-leaflet (CartoDB Voyager тайлы)
- **Content API:** Level Travel White Label
- **PDF:** Python + reportlab (`scripts/generate_pdf.py`)

---

## Архитектура (целевая)

| Слой | Решение | Статус |
|---|---|---|
| База данных | MySQL на своём сервере (Prisma / Drizzle) | Не подключена |
| Авторизация | NextAuth Credentials | Scaffolded, не подключена |
| Платежи | Т-Банк | Не подключены |
| Поиск туров | Level Travel API (WL) | **Работает** |
| CRM | Битрикс24 | Не подключена |
| Деплой | Свой сервер | — |

---

## Флоу заказа

1. Пользователь ищет тур → `/tours` или `/hotels`
2. Кликает "Смотреть" → переходит на WL Level Travel для бронирования
3. Заказ будет забираться из WL → MySQL
4. Заказ уходит в Битрикс24
5. Отображается в ЛК пользователя (`/account`)

---

## Страницы

| Маршрут | Компонент | Описание |
|---|---|---|
| `/` | `(public)/page.tsx` | Главная: поиск, категории, карусели туров, отзывы |
| `/tours` | `(public)/tours/page.tsx` | Поиск туров (пакеты) + карта |
| `/hotels` | `(public)/hotels/page.tsx` | Поиск отелей + карта |
| `/packages/[slug]` | `(public)/packages/[slug]/page.tsx` | Детальная страница пакета |
| `/checkout` | `(public)/checkout/page.tsx` | Чекаут (не подключён к платёжке) |
| `/account` | `(public)/account/page.tsx` | Личный кабинет |
| `/auth/login` | `(public)/auth/login/page.tsx` | Вход (Airbnb-стиль) |
| `/auth/register` | `(public)/auth/register/page.tsx` | Регистрация (Airbnb-стиль) |
| `/admin` | `admin/page.tsx` | Админка (пакеты, отзывы) |

---

## Ключевые компоненты

### Layout
- **`SiteHeader`** — хедер с 3 состояниями поиска: expanded (топ страницы) → compact pill (при скролле) → search-open (клик на пилл). На мобиле — только первый сегмент поиска.
- **`ConditionalFooter`** — скрывает футер на `/tours` и `/hotels` (fullscreen-режим с картой).

### Tours / Hotels
- **`HotelCard`** — карточка отеля. Варианты: `card` (вертикальный, для главной) и `row` (горизонтальный, для страниц поиска). Хабы для hover-событий (подсветка на карте).
- **`FiltersPanel`** — сайдбар с фильтрами: цена, звёзды, рейтинг, питание, регион, линия, тип пляжа, мгновенное подтверждение.
- **`HotelMap`** — интерактивная карта (Leaflet). Маркеры — ценники (`45 000 ₽`), при наведении на карточку — подсвечиваются синим. При клике на маркер — мини-попап с фото, названием, ценой и кнопкой.

### API
- **`/api/search`** (`src/app/api/search/route.ts`) — проксирует запросы к Level Travel API. Параметр `searchType: 'package' | 'hotel'`. Возвращает отели + фильтры.

### PDF-генератор
- **`scripts/generate_pdf.py`** — генерирует путевую книгу туриста (Python + reportlab).
- **`src/app/api/generate-pdf/route.js`** — Next.js API роут для вызова генератора.
- Тест: `python3 scripts/generate_pdf.py scripts/trip_data.json /tmp/out.pdf`

---

## Структура `src/`

```
src/
├── app/
│   ├── (public)/         # Публичные страницы
│   │   ├── page.tsx      # Главная
│   │   ├── tours/        # Поиск туров
│   │   ├── hotels/       # Поиск отелей
│   │   ├── packages/     # Детальные страницы пакетов
│   │   ├── checkout/     # Чекаут
│   │   ├── account/      # Личный кабинет
│   │   └── auth/         # Login / Register
│   ├── admin/            # Панель администратора
│   ├── api/
│   │   ├── search/       # Level Travel API прокси
│   │   └── generate-pdf/ # PDF генератор
│   └── layout.tsx        # Root layout (шрифты, хедер, футер)
├── components/
│   ├── layout/           # SiteHeader, SiteFooter, ConditionalFooter
│   ├── tours/            # HotelCard, HotelMap, FiltersPanel
│   ├── ui/               # Preloader, DateRangePicker, SearchBar и др.
│   ├── forms/            # BookingForm, ReviewForm, TourSearchForm
│   └── admin/            # AdminSidebar, PackageAdminForm
├── lib/
│   ├── leveltravel.ts    # Level Travel API клиент
│   ├── repositories.ts   # Репозитории (пока mock-data)
│   ├── mock-data.ts      # Mock данные (до подключения MySQL)
│   ├── seo.ts            # Centralized metadata
│   ├── jwt.ts            # JWT helper
│   └── validation.ts     # Zod схемы
├── context/
│   └── app-context.tsx   # AppProvider (пакеты, глобальный стейт)
└── types/
    └── travel.ts         # Типы домена
```

---

## Что работает сейчас

- [x] Поиск туров и отелей через Level Travel API (реальные данные)
- [x] Интерактивная карта с маркерами-ценниками
- [x] Попап-карточка при клике на маркер
- [x] Фильтрация результатов на клиенте
- [x] Хедер с адаптивным поиском (3 состояния)
- [x] Горизонтальный layout страниц поиска (sidebar + cards + fixed map)
- [x] Скрытие футера на fullscreen-страницах
- [x] Auth страницы (UI готов)
- [x] Личный кабинет (UI готов, данные mock)
- [x] Чекаут (UI готов, платёжка не подключена)
- [x] PDF-генератор путевых документов
- [x] Админка (CRUD пакетов и отзывов, mock)

## Что не подключено

- [ ] MySQL / реальная БД
- [ ] Авторизация (JWT flow есть, провайдер не выбран)
- [ ] Платежи (Т-Банк)
- [ ] Битрикс24 (заявки)
- [ ] Синхронизация заказов из Level Travel WL
- [ ] Email-рассылка путевых документов

---

## Запуск

```bash
npm install
npm run dev
```

Для PDF-генератора:
```bash
pip3 install reportlab
python3 scripts/generate_pdf.py scripts/trip_data.json /tmp/out.pdf
```
