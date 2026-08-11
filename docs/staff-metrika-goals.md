# Яндекс.Метрика — цели staff.motrip.ru

Счётчик: **109401746** (как на motrip / лендингах).  
События шлёт код через `ym(…, 'reachGoal', …)`.

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

Метрика → **Конверсии** → **Воронки** → создать воронку из шагов 2→3→4→5→6→7  
(или 1→2→3→4→5→6→7, если нужна доля отказов на входе).

Рекомендуемая воронка:
1. `staff_login_success`
2. `staff_search_submit`
3. `staff_tours_results`
4. `staff_hotel_open`
5. `staff_book_open`
6. `staff_lead_success`

## Проверка

После деплоя: DevTools → Network → фильтр `watch` / Console:

```js
ym(109401746, 'reachGoal', 'staff_login_success')
```

В Метрике цели появляются с задержкой (обычно несколько минут / до суток для отчётов).

## Переменные

Опционально в `.env.local` staff-landing:

```env
NEXT_PUBLIC_YM_COUNTER_ID=109401746
```
