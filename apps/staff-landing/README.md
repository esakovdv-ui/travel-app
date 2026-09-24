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
| `src/lib/tourvisor/region-availability.ts` | Журнал наблюдённых курортов → `data/region-availability.json` |
| `src/lib/metrika.ts` | `reachGoal` воронки |
| `src/middleware.ts` | Защита маршрутов |

## Пустые курорты: почему их не прячем

Курорты, по которым «ничего не находится», скрывать нельзя — это проверено
замерами, а не рассуждениями.

**Пустота зависит от дат, а не от курорта.** Санкт-Петербург в одном окне
отдал 97 отелей, в соседнем — ноль. Статический список «пустых» соврал бы.

**Опрос заранее тоже не помогает.** Замер по России, окно +21 день: набор
курортов стоял на 9 двадцать четыре раунда догрузки подряд и прыгнул до 12 на
двадцать пятом — с Петербургом внутри. Значит, «не рос K раундов» не означает
«больше ничего нет», и опрос с любым потолком объявит живой курорт мёртвым.

**Даже исчерпывающий поиск не перечисляет все курорты.** Три прогона одного
запроса в один день: 12 курортов (25 раундов), 9 (70 раундов, выдача
исчерпана), 9 (30 раундов). Более полный прогон нашёл больше отелей и меньше
курортов — состав ответивших операторов меняется от прогона к прогону.

Отсюда то, что сделано вместо скрытия:

- **Москва/Подмосковье убрана** из справочника (`reference.ts`,
  `DEPARTURE_HOME_REGIONS`). Это единственный курорт, пустой всегда: вылет
  зашит из Москвы, тур «из Москвы в Москву» невозможен. Ноль отелей в окнах
  +14, +30, +60, +90, +120 дней.
- **Остальные курорты только сортируются.** Завершившийся поиск пишет в
  `data/region-availability.json`, какие курорты реально пришли; форма поиска
  поднимает их наверх, а остальные показывает приглушённо и кликабельно.
  Журнал только накапливает — раз курорт отдал отели, он живой навсегда, даже
  если следующий поиск его не увидит.

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
