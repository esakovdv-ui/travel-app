# staff-landing — портал для сотрудников (staff.motrip.ru)

Отдельное Next.js-приложение внутри монорепо `travel-app`.

## Быстрый старт (локально)

```bash
cd apps/staff-landing
cp .env.example .env.local
# заполнить STAFF_SESSION_SECRET, STAFF_ADMIN_PASSWORD, TOURVISOR_TOKEN
npm install
npm run dev   # http://localhost:3001
```

## Доступ

- Пользовательский вход: в поле «Пароль» корпоративная почта `*@culture.mos.ru` (проверка только на сервере).
- Админка журнала: `/admin`, пароль `STAFF_ADMIN_PASSWORD`.
- Сессия: httpOnly cookie / JWT; middleware защищает `/tours`, `/api/tourvisor/*`, `/api/lead`.

## Ключевые файлы

| Путь | Назначение |
|------|------------|
| `src/app/page.tsx` | Gate + поиск на главной |
| `src/app/tours/page.tsx` | Результаты, отель, заявка |
| `src/app/admin/page.tsx` | Журнал попыток входа |
| `src/lib/staff-access.ts` | Проверка `@culture.mos.ru` |
| `src/lib/staff-session.ts` | Подпись сессии |
| `src/lib/access-log.ts` | Лог входов → `data/staff-access-log.json` |
| `src/lib/metrika.ts` | `reachGoal` воронки |
| `src/middleware.ts` | Защита маршрутов |

## Env (прод: `/var/www/staff-landing/.env.local`)

```env
STAFF_SESSION_SECRET=...
STAFF_ADMIN_PASSWORD=...
COOKIE_SECURE=true
TOURVISOR_TOKEN=...
# NEXT_PUBLIC_YM_COUNTER_ID=109401746
# STAFF_EMAIL_DOMAIN=culture.mos.ru
```

## Деплой

Из корня монорепо на VPS:

```bash
bash /home/travel-app/scripts/deploy-staff-landing.sh
```

Или GitHub Actions: workflow **Deploy staff-landing** (push в `main` при изменениях в `apps/staff-landing/**`).

`rsync` **не** затирает `.env.local` и каталог `data/` (журнал).

## Документация проекта

См. также:

- `/home/travel-app/PROJECT.md`
- `/home/travel-app/docs/README.md`
- `/home/travel-app/docs/staff-metrika-goals.md`
- `/home/travel-app/docs/infrastructure.md`
