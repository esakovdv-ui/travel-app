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
- Заявки с `/rebooking` → `POST /api/rebooking-lead` → лид в Битрикс24 (`crm.lead.add`)
- `RADUGA_ADMIN_PASSWORD` — пароль админки смен (опционально)

### Радуга на online.mosgortur.ru (iframe)

Страница `https://online.mosgortur.ru/new/raduga` встраивает `https://motrip.ru/raduga` в iframe **без query** и с `referrerpolicy="strict-origin-when-cross-origin"`, поэтому `?shift=` из адреса mosgortur не попадает в лендинг.

На **родительской** странице mosgortur нужно подключить (в `index.html` SPA или GTM):

```html
<script src="https://motrip.ru/raduga-parent-bridge.js" defer></script>
```

Скрипт прокидывает `shift`, UTM и `clckid` в `iframe.src`. Альтернатива в их Vue-компоненте `Raduga`: динамический `:src="'https://motrip.ru/raduga' + location.search"`.

## История релизов

| Коммит | Описание |
|--------|----------|
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
