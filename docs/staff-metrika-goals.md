# Яндекс.Метрика — цели staff.motrip.ru

Счётчик: **109401746** (как на motrip / лендингах).  
События шлёт код через `ym(…, 'reachGoal', …)`.

## Созданные цели (Management API)

| ID | Идентификатор | Название |
|---|---|---|
| 595717534 | `staff_login_attempt` | Staff: попытка входа |
| 595717535 | `staff_login_success` | Staff: успешный вход |
| 595717536 | `staff_login_fail` | Staff: отказ во входе |
| 595717537 | `staff_search_submit` | Staff: поиск туров |
| 595717538 | `staff_tours_results` | Staff: результаты поиска |
| 595717539 | `staff_hotel_open` | Staff: открытие отеля |
| 595717540 | `staff_book_open` | Staff: форма заявки |
| 595717541 | `staff_lead_success` | Staff: заявка отправлена |
| 595717542 | `staff_lead_fail` | Staff: ошибка заявки |

**Составная цель (воронка, max 5 шагов в API):** ID **595717880** — «Staff: воронка до заявки»  
Шаги: вход → поиск → результаты → отель → заявка (`staff_book_open` — отдельная цель между отелем и заявкой).

Смотреть: Метрика → счётчик **109401746** → **Цели** → «Staff: воронка до заявки».

## Воронка

```
Визит / (просмотр страницы Метрики)
    ↓
staff_login_attempt     — нажал «Войти»
    ↓
staff_login_success     — вход разрешён (@culture.mos.ru)
    ✗ staff_login_fail  — отказ
    ↓
staff_search_submit     — отправил поиск тура
    ↓
staff_tours_results     — поиск завершён, показаны отели
    ↓
staff_hotel_open        — открыл карточку отеля
    ↓
staff_book_open         — открыл форму заявки
    ↓
staff_lead_success      — заявка отправлена в Bitrix
    ✗ staff_lead_fail   — ошибка отправки
```

## Как создать цели в интерфейсе Метрики

1. Метрика → счётчик **109401746** → **Цели** → **Добавить цель**
2. Тип: **JavaScript-событие**
3. Идентификатор цели = имя из таблицы ниже (точно, без пробелов)
4. Сохранить

| Идентификатор | Название в отчётах | Шаг воронки |
|---|---|---|
| `staff_login_attempt` | Staff: попытка входа | 1 |
| `staff_login_success` | Staff: успешный вход | 2 |
| `staff_login_fail` | Staff: отказ во входе | — |
| `staff_search_submit` | Staff: поиск туров | 3 |
| `staff_tours_results` | Staff: результаты поиска | 4 |
| `staff_hotel_open` | Staff: открытие отеля | 5 |
| `staff_book_open` | Staff: форма заявки | 6 |
| `staff_lead_success` | Staff: заявка отправлена | 7 (конверсия) |
| `staff_lead_fail` | Staff: ошибка заявки | — |

## Отчёт «Воронка»

**Составная цель (5 шагов):** уже настроена — ID **595717880**, смотреть в **Цели → Staff: воронка до заявки**.

**Полная воронка (6 шагов, с формой заявки):** Метрика → **Отчёты** → **Создать отчёт** → **Воронка** → шаги:

1. `staff_login_success`
2. `staff_search_submit`
3. `staff_tours_results`
4. `staff_hotel_open`
5. `staff_book_open`
6. `staff_lead_success`

Сегментация по разделу: фильтр **URL** содержит `staff.motrip.ru` или параметры целей (`country`, `hotel` — передаются из `reachGoal`).

Рекомендуемая воронка (если нужна короче):
1. `staff_login_success`
2. `staff_search_submit`
3. `staff_tours_results`
4. `staff_hotel_open`
5. `staff_book_open`
6. `staff_lead_success`

## Google Sheet — отчётность

Таблица обновляется каждый час (GitHub Actions **Sync staff funnel sheet**).

Листы:

| Лист | Что внутри |
|------|------------|
| **Воронка** | Этапы строками: посетители, сессии, целевые действия (reaches), CR |
| **По неделям** | Те же этапы, недели колонками, числа = посетители |
| **Справочник** | ID целей, фильтр URL, поля Битрикса |

Этапы: заход на `staff.motrip.ru` → попытка входа → успешный вход → поиск → выдача → отель → форма заявки → заявка (Метрика) → сделки в Битриксе (category 22, `SOURCE_ID=UC_58Z62L`). «Не пустили» и «ошибка отправки» — боковые ветки, в CR-цепочку не входят.

Счётчик **109401746** общий с motrip.ru: визиты фильтруются `ym:s:startURL=@'staff.motrip.ru'`. Цели `staff_*` уникальны.

Обновление:

```bash
npm run staff:funnel-sync          # Metrika + Bitrix → Google Sheet
npm run staff:funnel-sync -- --dry-run
```

Переменные: `YANDEX_METRIKA_TOKEN`, `GOOGLE_SERVICE_ACCOUNT_JSON`, опционально `STAFF_SHEET_ID`, `STAFF_FUNNEL_START` (по умолчанию `2026-08-12`).

Secrets workflow те же, что у воронки подбора. Email сервис-аккаунта Google должен быть редактором таблицы.

## Проверка

После деплоя: `curl -sL https://staff.motrip.ru/ | grep 109401746` — в HTML должно быть число **109401746**, не ошибка Next.js.

DevTools → Network → фильтр `watch` / Console:

```js
ym(109401746, 'reachGoal', 'staff_login_success')
```

В Метрике цели появляются с задержкой (обычно несколько минут / до суток для отчётов).

## Код

- `apps/staff-landing/src/lib/metrika-config.ts` — ID счётчика (server-safe)
- `apps/staff-landing/src/lib/metrika.ts` — `reachGoal()` (client)
- `apps/staff-landing/src/components/YandexMetrika.tsx` — сниппет счётчика (server)

## Переменные

Опционально в `.env.local` staff-landing:

```env
NEXT_PUBLIC_YM_COUNTER_ID=109401746
```
