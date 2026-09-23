# Задача в Битрикс (текст для копирования)

**Название:** Обновить лендинг раннего бронирования под сезон 2027  
**Карточка:** https://crm.mosgortur.ru/workgroups/group/99/tasks/task/view/36930/

---

### 1. ЦЕЛЬ

Заменить просроченный лендинг `https://online.mosgortur.ru/early-booking/` (даты 17.11–25.12.2025, предоплата 5 000 ₽, PDF правил 2025) на страницу сезона 2027. Канонический текст и вёрстка живут на `https://motrip.ru/early-booking`. Сайт МГТ эту страницу показывает, а не хранит вторую копию с прошлогодними датами.

---

### 2. КАК ДЕЛАЕМ СЕЙЧАС — AS-IS

• `https://online.mosgortur.ru/early-booking/` открыт с условиями акции 2025 года.  
• Отдельный таплинк с нуля не нужен: URL уже есть.  
• На motrip уже так же отдаются промо: `/vlasevo` → `public/vlasevo.html`, `/podbor` → `public/podbor.html`.  
• Подбор `/new/podbor` в воронку этой акции не входит.

---

### 3. КАК ВЫ ВИДИТЕ РЕЗУЛЬТАТ — TO-BE

#### 3.1. Страница на motrip

Уже собрана в репозитории Travel_app:

- файл `public/early-booking.html`
- реврайт `/early-booking` → `/early-booking.html` в `next.config.ts`
- после выкладки открывается `https://motrip.ru/early-booking`

На странице: черновая плашка «даты до согласования маркетинга», сроки, предоплата 5 000 ₽, вкладки Туры / Отели / Лагеря (Радуга, Власьево, лагеря на море), как оплатить, FAQ. PDF правил 2027 нет — заглушка в блоке «Правила», файл 2025 не подставлять.

Кнопки ведут в каталог, не в подбор:

| Кнопка | URL |
|--------|-----|
| Туры | `https://online.mosgortur.ru/tours/?utm_source=motrip&utm_medium=landing&utm_campaign=early_booking_2027&utm_content=tours` |
| Туры с ж/д | тот же раздел, `utm_content=rail` |
| Отели | `https://online.mosgortur.ru/new/russia-hotels?utm_source=motrip&utm_medium=landing&utm_campaign=early_booking_2027&utm_content=hotels` |
| Радуга | `https://online.mosgortur.ru/new/raduga?utm_source=motrip&utm_medium=landing&utm_campaign=early_booking_2027&utm_content=raduga` |
| Власьево | `https://motrip.ru/vlasevo?utm_source=motrip&utm_medium=landing&utm_campaign=early_booking_2027&utm_content=vlasevo` |
| Лагеря | `https://online.mosgortur.ru/kids?utm_source=motrip&utm_medium=landing&utm_campaign=early_booking_2027&utm_content=camps` |

Черновик условий (сдвиг сезона 2026, не финал):

- прогрев с 02.11.2026
- старт 17.11.2026
- конец 25.12.2026
- предоплата 5 000 ₽
- отдых с сертификатом 28.03.2027–15.11.2027
- без сертификата до 31.12.2027

#### 3.2. Что сделать на online.mosgortur.ru

`https://online.mosgortur.ru/early-booking/` больше не отдаёт вёрстку 2025 года.

Вариант: iframe на `https://motrip.ru/early-booking` (как ` /new/raduga` встраивает `motrip.ru/raduga`) или редирект на этот URL. Даты 2025 и PDF правил 2025 с этой страницы убрать.

---

### 4. КРИТЕРИИ ГОТОВНОСТИ

• `https://motrip.ru/early-booking` открывает новую страницу.  
• `https://online.mosgortur.ru/early-booking/` показывает её же и не содержит дат 17.11–25.12.2025.  
• Кнопки ведут в каталог с UTM `utm_campaign=early_booking_2027`.  
• Ссылки на `/new/podbor` на лендинге нет.  
• PDF 2025 не приложен.

---

### 5. ОБОСНОВАНИЕ ПРИОРИТЕТА

Страница с прошлогодними датами уже в индексе. Пока маркетинг не утвердит финал, на проде МГТ лучше показать черновик с явной плашкой, чем условия 2025 года.
