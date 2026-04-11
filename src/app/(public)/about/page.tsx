import Link from 'next/link';
import { buildMetadata } from '@/lib/seo';
import styles from './about.module.css';

export const metadata = buildMetadata({
  title: 'О сервисе — Мои Путешествия',
  description: 'Мы помогаем найти идеальный тур по лучшей цене. Более 5000 туров, 120+ направлений, поддержка 24/7.',
});

const WHY = [
  {
    icon: '🔍',
    cls: 'whyIconBlue',
    title: 'Умный поиск',
    text: 'Мы сравниваем предложения сотен туроператоров в режиме реального времени — вы видите только актуальные цены и наличие мест.',
  },
  {
    icon: '💰',
    cls: 'whyIconRed',
    title: 'Лучшая цена',
    text: 'Прямые контракты с туроператорами позволяют предлагать цены ниже, чем в большинстве агентств. Гарантия лучшей цены на каждый тур.',
  },
  {
    icon: '🛡️',
    cls: 'whyIconYellow',
    title: 'Безопасное бронирование',
    text: 'Все туроператоры проверены и имеют действующие лицензии. Ваши деньги защищены финансовыми гарантиями.',
  },
  {
    icon: '✈️',
    cls: 'whyIconBlue',
    title: '120+ направлений',
    text: 'От пляжного отдыха в Таиланде до горных лыж в Австрии. Найдём тур под любой запрос, бюджет и сезон.',
  },
  {
    icon: '📱',
    cls: 'whyIconRed',
    title: 'Удобно на любом устройстве',
    text: 'Ищите и бронируйте туры со смартфона, планшета или компьютера. Все данные синхронизируются в личном кабинете.',
  },
  {
    icon: '🎧',
    cls: 'whyIconYellow',
    title: 'Поддержка 24/7',
    text: 'Наши менеджеры всегда на связи — по телефону, в чате или по email. Поможем с любым вопросом до и во время поездки.',
  },
];

const HOW_STEPS = [
  {
    title: 'Выберите направление и даты',
    text: 'Укажите куда хотите поехать, когда и с кем. Система подберёт все доступные варианты.',
  },
  {
    title: 'Сравните предложения',
    text: 'Фильтруйте по цене, звёздности, питанию и расстоянию до моря. Смотрите фото и отзывы.',
  },
  {
    title: 'Забронируйте онлайн',
    text: 'Оформите заявку за несколько минут. Менеджер свяжется для подтверждения и оплаты.',
  },
  {
    title: 'Отправляйтесь в путь',
    text: 'Получите все документы на email. Наша поддержка на связи в течение всей поездки.',
  },
];

const DESTINATIONS = [
  {
    name: 'Турция',
    count: '320 туров',
    img: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=600&q=80',
    href: '/tours?toCountry=TR',
  },
  {
    name: 'Таиланд',
    count: '180 туров',
    img: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=600&q=80',
    href: '/tours?toCountry=TH',
  },
  {
    name: 'ОАЭ',
    count: '140 туров',
    img: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=600&q=80',
    href: '/tours?toCountry=AE',
  },
  {
    name: 'Египет',
    count: '210 туров',
    img: 'https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?auto=format&fit=crop&w=600&q=80',
    href: '/tours?toCountry=EG',
  },
];

const REVIEWS = [
  {
    text: 'Нашли тур в Турцию за 3 дня до вылета по отличной цене. Всё прошло гладко, документы пришли мгновенно. Теперь только через Мои Путешествия!',
    name: 'Анна К.',
    meta: 'Турция, 2025',
    initials: 'АК',
  },
  {
    text: 'Очень удобный поиск — сравниваешь сразу всё в одном месте. Менеджер помог выбрать отель под наши пожелания. Рекомендую всем друзьям.',
    name: 'Михаил Р.',
    meta: 'Таиланд, 2025',
    initials: 'МР',
  },
  {
    text: 'Летали семьёй с двумя детьми. Всё организовано отлично, поддержка была на связи даже когда мы уже были на месте. Спасибо большое!',
    name: 'Елена С.',
    meta: 'ОАЭ, 2024',
    initials: 'ЕС',
  },
];

export default function AboutPage() {
  return (
    <main>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroAccent} aria-hidden="true" />
        <div className={styles.heroAccent2} aria-hidden="true" />
        <div className="shell">
          <span className={styles.heroEyebrow}>О нас</span>
          <h1 className={styles.heroTitle}>
            Ваш надёжный партнёр<br />в мире <em>путешествий</em>
          </h1>
          <p className={styles.heroSub}>
            Мы помогаем людям находить лучшие туры по честным ценам с 2020 года.
            Более 50 000 довольных путешественников выбрали нас.
          </p>
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>50 000+</span>
              <span className={styles.heroStatLabel}>туристов</span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>120+</span>
              <span className={styles.heroStatLabel}>направлений</span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>5 000+</span>
              <span className={styles.heroStatLabel}>туров</span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>4.9 ★</span>
              <span className={styles.heroStatLabel}>средний рейтинг</span>
            </div>
          </div>
        </div>
      </section>

      {/* Почему мы */}
      <section className={styles.section}>
        <div className="shell">
          <p className={styles.sectionEyebrow}>Наши преимущества</p>
          <h2 className={styles.sectionTitle}>Почему выбирают нас</h2>
          <p className={styles.sectionSub}>
            Мы не просто агрегатор туров — мы берём на себя всё,
            чтобы ваш отпуск прошёл идеально.
          </p>
          <div className={styles.whyGrid}>
            {WHY.map(item => (
              <div key={item.title} className={styles.whyCard}>
                <div className={`${styles.whyIcon} ${styles[item.cls as keyof typeof styles]}`}>
                  {item.icon}
                </div>
                <h3 className={styles.whyCardTitle}>{item.title}</h3>
                <p className={styles.whyCardText}>{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Как это работает */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className="shell">
          <div className={styles.howLayout}>
            <div>
              <p className={styles.sectionEyebrow}>Простой процесс</p>
              <h2 className={styles.sectionTitle}>Как забронировать тур</h2>
              <p className={styles.sectionSub}>
                От поиска до посадки на борт — мы сопровождаем вас на каждом шаге.
              </p>
              <div className={styles.howSteps}>
                {HOW_STEPS.map((step, i) => (
                  <div key={step.title} className={styles.howStep}>
                    <div className={styles.howNum}>{i + 1}</div>
                    <div className={styles.howStepContent}>
                      <p className={styles.howStepTitle}>{step.title}</p>
                      <p className={styles.howStepText}>{step.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.howImage}>
              <img
                src="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=800&q=80"
                alt="Путешествие"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Популярные направления */}
      <section className={styles.section}>
        <div className="shell">
          <p className={styles.sectionEyebrow}>Куда поехать</p>
          <h2 className={styles.sectionTitle}>Популярные направления</h2>
          <p className={styles.sectionSub}>
            Самые востребованные направления этого сезона по лучшим ценам.
          </p>
          <div className={styles.destGrid}>
            {DESTINATIONS.map(d => (
              <Link key={d.name} href={d.href} className={styles.destCard}>
                <img src={d.img} alt={d.name} />
                <div className={styles.destOverlay} />
                <div className={styles.destInfo}>
                  <p className={styles.destName}>{d.name}</p>
                  <p className={styles.destCount}>{d.count}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Отзывы */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className="shell">
          <p className={styles.sectionEyebrow}>Отзывы</p>
          <h2 className={styles.sectionTitle}>Что говорят наши клиенты</h2>
          <p className={styles.sectionSub}>
            Более 50 000 путешественников уже оценили наш сервис.
          </p>
          <div className={styles.reviewsGrid}>
            {REVIEWS.map(r => (
              <div key={r.name} className={styles.reviewCard}>
                <div className={styles.reviewStars}>★★★★★</div>
                <p className={styles.reviewText}>«{r.text}»</p>
                <div className={styles.reviewAuthor}>
                  <div className={styles.reviewAvatar}>{r.initials}</div>
                  <div>
                    <p className={styles.reviewName}>{r.name}</p>
                    <p className={styles.reviewMeta}>{r.meta}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.cta}>
        <div className="shell">
          <h2 className={styles.ctaTitle}>Готовы к следующему приключению?</h2>
          <p className={styles.ctaSub}>
            Найдите идеальный тур прямо сейчас — тысячи предложений ждут вас
          </p>
          <Link href="/tours" className={styles.ctaBtn}>
            Найти тур →
          </Link>
        </div>
      </section>
    </main>
  );
}
