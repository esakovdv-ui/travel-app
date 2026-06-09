import Link from 'next/link';
import Image from 'next/image';
import { buildMetadata } from '@/lib/seo';
import { listStoriesPaginated, listTags, getGalleryPhotos, getPublishedManagers } from '@/lib/repositories';
import { STORIES_RAFFLE_ENABLED, STORIES_RAFFLE_CONFIG } from '@/lib/constants';
import { StoriesSection } from '@/components/stories/stories-section';
import { StoryForm } from '@/components/stories/story-form';
import styles from './stories.module.css';

export const metadata = buildMetadata({
  title: 'Истории путешествий',
  description: 'Живые впечатления клиентов Мои путешествия — отзывы, фото и истории, которые помогают выбрать отдых.',
});

export default async function StoriesPage() {
  const [{ stories: initialStories, total }, gallery, managers, tags] = await Promise.all([
    Promise.resolve(listStoriesPaginated({ offset: 0, limit: 8 })),
    Promise.resolve(getGalleryPhotos()),
    Promise.resolve(getPublishedManagers()),
    Promise.resolve(listTags({ onlyWithStories: true })),
  ]);

  return (
    <main>
      {/* ─── Hero ─── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={`shell ${styles.heroContent}`}>
          <span className={styles.heroBadge}>Истории путешествий</span>
          <h1 className={styles.heroTitle}>Живые впечатления клиентов</h1>
          <p className={styles.heroSubtitle}>
            Отзывы, фото и маленькие истории, которые помогают выбрать отдых
            глазами тех, кто уже съездил.
          </p>
          <div className={styles.heroCtas}>
            <Link href="#stories" className={`btn btn-red btn-lg ${styles.heroBtn}`}>
              Смотреть истории
            </Link>
            <Link href="#form" className={`btn btn-lg ${styles.heroBtnGhost}`}>
              Рассказать свою историю
            </Link>
          </div>
          <div className={styles.heroStat}>
            <span className={styles.heroStatNum}>2 400+</span>
            <span className={styles.heroStatLabel}>счастливых путешествий</span>
          </div>
        </div>
      </section>

      {/* ─── Mini-strip ─── */}
      <section className={styles.strip}>
        <div className={`shell ${styles.stripGrid}`}>
          <div className={styles.stripItem}>
            <span className={styles.stripIcon}>⭐</span>
            <strong className={styles.stripTitle}>Реальные отзывы</strong>
            <p className={styles.stripText}>Только от клиентов с согласием на публикацию</p>
          </div>
          <div className={styles.stripDivider} />
          <div className={styles.stripItem}>
            <span className={styles.stripIcon}>🏨</span>
            <strong className={styles.stripTitle}>Связь с объектом</strong>
            <p className={styles.stripText}>Каждая история ведёт к карточке объекта</p>
          </div>
          <div className={styles.stripDivider} />
          <div className={styles.stripItem}>
            <span className={styles.stripIcon}>🎁</span>
            <strong className={styles.stripTitle}>Бонус за доверие</strong>
            <p className={styles.stripText}>Участвуйте в ежемесячном розыгрыше</p>
          </div>
        </div>
      </section>

      {/* ─── Stories section (client, with load more) ─── */}
      <StoriesSection initialStories={initialStories} total={total} tags={tags} />

      {/* ─── Managers ─── */}
      {managers.length > 0 && (
        <section className={`section ${styles.managersSection}`}>
          <div className="shell">
            <p className="eyebrow" style={{ marginBottom: 8 }}>Команда Мои путешествия</p>
            <h2 className={`section-title ${styles.managersTitle}`}>Кто помог организовать поездку</h2>
            <div className={styles.managersGrid}>
              {managers.map((m, i) => (
                <div key={i} className={styles.managerCard}>
                  <div className={styles.managerAvatar}>
                    {m.managerName.charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.managerInfo}>
                    <strong className={styles.managerName}>{m.managerName}</strong>
                    <span className={styles.managerRole}>Менеджер по туризму</span>
                  </div>
                  {m.quote && (
                    <p className={styles.managerQuote}>«{m.quote}»</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Gallery ─── */}
      <section className={styles.gallery}>
        <div className="shell">
          <p className="eyebrow" style={{ marginBottom: 8, color: 'rgba(255,255,255,0.6)' }}>
            Фото из поездок
          </p>
          <h2 className={`section-title ${styles.galleryTitle}`}>Моменты, которые остаются</h2>
          <div className={styles.galleryGrid}>
            {gallery.map((photo, i) => (
              <div
                key={i}
                className={styles.galleryItem}
                style={{
                  gridColumn: `span ${photo.span}`,
                  height: photo.height,
                }}
              >
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  style={{ objectFit: 'cover' }}
                  sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Trust / Raffle ─── */}
      {STORIES_RAFFLE_ENABLED && (
        <section className={`section ${styles.trustSection}`}>
          <div className="shell">
            <div className={styles.trustCard}>
              <div className={styles.trustLeft}>
                <span className={styles.trustTag}>Мои путешествия.Доверие</span>
                <h2 className={styles.trustTitle}>
                  Поделитесь историей — участвуйте в розыгрыше
                </h2>
                <p className={styles.trustDesc}>
                  Каждый клиент, опубликовавший историю путешествия, автоматически
                  участвует в ежемесячном розыгрыше призов. Победители определяются
                  случайным образом среди всех авторов месяца.
                </p>
                <div className={styles.trustChips}>
                  {STORIES_RAFFLE_CONFIG.chips.map((chip) => (
                    <span key={chip} className={styles.trustChip}>{chip}</span>
                  ))}
                </div>
                <Link href="#form" className={`btn btn-red ${styles.trustCta}`}>
                  Рассказать свою историю
                </Link>
              </div>
              <div className={styles.trustPrize}>
                <span className={styles.trustPrizeEmoji}>{STORIES_RAFFLE_CONFIG.emoji}</span>
                <strong className={styles.trustPrizeName}>{STORIES_RAFFLE_CONFIG.prizeName}</strong>
                <span className={styles.trustPrizeDate}>Розыгрыш {STORIES_RAFFLE_CONFIG.drawDate}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── Form (client) ─── */}
      <StoryForm />
    </main>
  );
}
