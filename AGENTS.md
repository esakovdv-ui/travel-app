# Инструкции для ИИ / агента на сервере

Работай из `/home/travel-app` (основной сайт) или `/var/www/staff-landing` (портал сотрудников).

## Обязательно прочитай

1. `docs/README.md` — индекс документации  
2. `PROJECT.md` — архитектура и статус  
3. `docs/infrastructure.md` — деплой и сервер  
4. Для staff: `apps/staff-landing/README.md` и `docs/staff-metrika-goals.md`

## Правила

- Изменения в код — через git-ветки и PR, не править прод «вживую» без коммита.
- После правок staff: `bash /home/travel-app/scripts/deploy-staff-landing.sh`
- После правок travel-app: `bash /home/deploy.sh` или Actions **Deploy to production**
- Не коммитить `.env`, `.env.local`, пароли, токены.

## Полезные команды

```bash
pm2 list
pm2 logs travel-app --lines 100
pm2 logs staff-landing --lines 100
ls /home/travel-app/docs
ls /var/www/staff-landing/docs
```
