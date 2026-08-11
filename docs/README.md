# Документация проекта (для людей и ИИ)

Корень приложения на сервере: `/home/travel-app`  
Портал сотрудников: `/var/www/staff-landing` (код из `apps/staff-landing`)

## С чего начать

| Файл | Содержание |
|------|------------|
| [`../PROJECT.md`](../PROJECT.md) | Обзор продукта, стек, страницы, БД, auth, changelog, roadmap |
| [`../README.md`](../README.md) | Git-flow, запуск, структура `src/` |
| [`infrastructure.md`](./infrastructure.md) | VPS, деплой, PM2, env, Bitrix |
| [`staff-metrika-goals.md`](./staff-metrika-goals.md) | Цели Яндекс.Метрики для staff.motrip.ru |
| [`../apps/staff-landing/README.md`](../apps/staff-landing/README.md) | Портал сотрудников: auth, админка, деплой |

## Остальные docs/

| Файл | Тема |
|------|------|
| `checkout-api-plan.md` | План своего чекаута через Level Travel |
| `podbor-wizard-landing.md` | Лендинг «подбор тура» |
| `rebooking-landing.md` | Ребукинг |
| `rebooking-email-campaign.md` | Email-кампания ребукинга |
| `rebooking-bitrix-campaign-import.md` | Импорт кампании в Bitrix |

## Важно для правок на сервере

1. **Не коммитить в `main` напрямую** — ветка `feature/dima` / `feature/arthur` → PR → merge.
2. **travel-app:** после merge деплой GitHub Actions или `bash /home/deploy.sh`.
3. **staff-landing:** `bash /home/travel-app/scripts/deploy-staff-landing.sh` (или workflow Deploy staff-landing).
4. Секреты только в `.env.local`, не в git.
5. Админка журнала входов staff: `https://staff.motrip.ru/admin` (пароль в `.env.local` → `STAFF_ADMIN_PASSWORD`).

## Где лежит код

```
/home/travel-app/                 # основной Next.js (motrip)
  PROJECT.md, README.md, docs/
  apps/staff-landing/             # исходники staff (синхронизируются на деплое)
  scripts/deploy-staff-landing.sh

/var/www/staff-landing/           # прод staff.motrip.ru (PM2 staff-landing)
  .env.local
  data/staff-access-log.json      # журнал входов
  docs/                           # копия ключевых MD (если задеплоено)
```
