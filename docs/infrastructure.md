# Инфраструктура и деплой

## Сервер

- **VPS:** 72.56.32.183 (Timeweb, Ubuntu 22.04)
- **Пользователь:** root
- **Проект:** `/home/travel-app`
- **Process Manager:** PM2 (процесс `travel-app`, id=0)
- **Deploy script:** `/home/deploy.sh`

## Деплой

### Автоматический (GitHub Actions)
- Триггер: push в ветки `main` или `feature/dima-auth`
- Также: `workflow_dispatch` (ручной запуск)
- Конфиг: `.github/workflows/deploy.yml`
- Подключение: SSH на VPS, в `/home/travel-app` выполняется `git fetch` + checkout ветки из push, `npm install`, `npm run build`, `pm2 restart travel-app`, прогрев thematic-rows API
- Секрет: `SSH_PRIVATE_KEY`

### Ручной деплой
```bash
git pull origin <branch>
npm run build
pm2 restart all
```

### Известные проблемы деплоя
- На сервере ветка `main` расходилась с `feature/dima-auth` — при `git pull` возникал конфликт в `thematic-rows.ts`
- Решение: `git reset --hard origin/<branch>` + пересборка

## Переменные окружения на сервере (`/home/travel-app/.env.local`)

- `LEVEL_TRAVEL_API_KEY` — ключ для Level Travel API (серверный, не публичный)
- `NEXT_PUBLIC_WL_BASE_URL=https://russia.mosgortur.ru` — базовый URL White Label
- `FONT_DIR=./scripts/fonts` — путь к шрифтам для PDF-генератора
- `BITRIX_DOMAIN` — домен портала Bitrix24 (например `crm.mosgortur.ru`)
- `WEBHOOK_TOKEN` — часть URL вебхука после `/rest/` (например `1981/xxxxxxxx`)
- Заявки с `/raduga` → `POST /api/raduga-lead` → сделка в воронке 12 (`crm.deal.add`), не лиды
- `REBOOKING_BITRIX_DOMAIN` — домен Б24 для `/rebooking` (по умолчанию как `BITRIX_DOMAIN`)
- `REBOOKING_WEBHOOK_TOKEN` — вебхук для лидов перебронирования (`crm.lead.add`), например `1981/j9pvdbhovvem7j6c`
- Заявки с `/rebooking` → после выбора тура в ТурВизоре → `POST /api/rebooking-lead` или `GET /api/tourvisor-order-webhook` → лид в Битрикс24
- `TOURVISOR_AUTHKEY` — ключ export API ТурВизора для серверного webhook заявок
- Направления без Крыма: [`public/rebooking-destinations.json`](public/rebooking-destinations.json)
- `RADUGA_ADMIN_PASSWORD` — пароль админки смен (опционально)

### Лендинг перебронирования (`/rebooking`)

**URL:** `https://motrip.ru/rebooking?order=…&cert=…&name=…&people=…&kids=…&kid1=…&price=…&nights=…&date=…`

**Файлы:**
- [`public/rebooking.html`](../public/rebooking.html) — статическая страница (rewrite в `next.config.ts`)
- [`public/rebooking-destinations.json`](../public/rebooking-destinations.json) — направления с кодами `tv-country` (Крым не включён)
- [`src/app/api/rebooking-lead/route.ts`](../src/app/api/rebooking-lead/route.ts) — лид после заявки на тур
- [`src/app/api/tourvisor-order-webhook/route.ts`](../src/app/api/tourvisor-order-webhook/route.ts) — запасной мост от ТурВизора

**UX-поток:**
1. Карточка параметров поездки (дата, ночи, туристы, бюджет) + заявка/сертификат мелко внизу
2. Пользователь выбирает направление в селекторе
3. Модуль ТурВизора (`tv-moduleid-9978253`) инициализируется с предзаполненными атрибутами
4. После заявки на конкретный тур — лид в Битрикс (`crm.lead.add`) с `order`, `cert`, `name` + данные тура

**Маппинг URL → атрибуты ТурВизора** (на `div.tv-search-form` до `init.js`):

| Параметр | Атрибут | Формат |
|----------|---------|--------|
| `date` | `tv-flydates` | `14.07.2026,14.07.2026` |
| `nights` | `tv-nights` | `10,10` |
| adults | `tv-adults` | `2` |
| `kids` | `tv-kids` | `1` |
| `kid1..3` | `tv-kid1..3` | возраст |
| `price` | `tv-pricefrom` / `tv-priceto` | `0` / `185000` |
| направление | `tv-country` | код из JSON |

`tv-runsearch` не ставится — пользователь сам нажимает «Найти».

**Мосты в Битрикс:**
- Основной: `postMessage` от `tourvisor.ru` (события `ORDERTOUR` / `HELPTOUR`) → `POST /api/rebooking-lead`
- Запасной: webhook ТурВизора `GET /api/tourvisor-order-webhook?id=&type=` → `orders.php` + парсинг `referer` → `crm.lead.add`

Регистрация TV webhook: `https://motrip.ru/api/tourvisor-order-webhook` (нужен `TOURVISOR_AUTHKEY` в `.env.local`).

**Тестовая ссылка:**
```
/rebooking?order=МГТ-2025-04821&cert=СЕРТ-77412&name=Иванов%20Иван%20Иванович&people=3&kids=1&kid1=7&price=185000&nights=10&date=2026-07-14
```

**Матрица визуальной приёмки (375px, motrip.ru после деплоя):**
- [ ] Карточка: 14 июля 2026, 10 ночей, 3 туриста (2+1, 7 лет), 185 000 ₽; заявка/сертификат внизу
- [ ] Те же значения в фильтрах ТурВизора после выбора направления
- [ ] Крыма нет в селекторе
- [ ] Нижней формы заявки нет
- [ ] Лид в Битрикс только после заявки на тур

Коды стран в `rebooking-destinations.json` сверить с ЛК ТурВизора («Ссылки для рекламы»).


Страница `https://online.mosgortur.ru/new/raduga` встраивает `https://motrip.ru/raduga` в iframe **без query** и с `referrerpolicy="strict-origin-when-cross-origin"`, поэтому `?shift=` из адреса mosgortur не попадает в лендинг.

На **родительской** странице mosgortur нужно подключить (в `index.html` SPA или GTM):

```html
<script src="https://motrip.ru/raduga-parent-bridge.js" defer></script>
```

Скрипт прокидывает `shift`, UTM и `clckid` в `iframe.src`. Альтернатива в их Vue-компоненте `Raduga`: динамический `:src="'https://motrip.ru/raduga' + location.search"`.

## История релизов

| Коммит | Описание |
|--------|----------|
| — | Feat: `/rebooking` UX — карточка параметров, селектор направлений, предзаполнение ТурВизора |
| — | Feat: `/rebooking` — лиды в Битрикс после заявки на тур (postMessage + TV webhook) |
| — | Feat: `/rebooking` — лендинг перебронирования, ТурВизор, лиды в Битрикс24 |
| `061aca1` | Fix: thematic rows — переход на shared leveltravel.ts клиент |
| `5f2b4c5` | Fix: sequential LT API fetches + retry на 403 rate limit |
| `8c0a748` | Fix: client-side fallback для thematic rows при медленном SSR |
| `3968518` | Fix: unstable_cache не кеширует пустые результаты при таймауте |
| `e12d883` | Fix: правильная env-переменная LEVEL_TRAVEL_API_KEY на сервере |
| `767833c` | Admin panel для управления тегами поиска на главной |
| `50c06d5` | Страница «О сервисе» (/about) |
| `dacb7aa` | Fix: layout не кешируется — сессия читается заново |
| `80a8bf2` | Хедер: аватар и дропдаун для авторизованного пользователя |
| `b321578` | Fix: cookie работает по HTTP |
| `abe044e` | Подключена реальная БД PostgreSQL, авторизация и личный кабинет |
| `5be1eb3` | GitHub Actions для автодеплоя |
| `7ce932c` | Initial commit |

## Мониторинг

```bash
pm2 status          # статус процесса
pm2 logs travel-app # логи приложения
pm2 env 0           # переменные окружения
```
