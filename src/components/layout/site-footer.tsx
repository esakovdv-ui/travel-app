import Link from 'next/link';
import { BrandLogo } from './brand-logo';
import { readSearchTags } from '@/lib/search-tags';
import { LEGAL_DOCS } from '@/lib/constants';
import styles from './site-footer.module.css';

export function SiteFooter() {
  // Направления берём из админки (/admin/search-tags) — там у каждого тега
  // лежит рабочий href вида /tours?toCountry=TR. Раньше в футере были
  // захардкоженные /tours?category=warm, которые приложение не читает,
  // и все три ссылки вели на пустой экран поиска.
  const destinations = readSearchTags()
    .filter((t) => t.enabled)
    .sort((a, b) => a.order - b.order)
    .slice(0, 5);

  return (
    <footer className={styles.footer}>
      <div className="shell">
        <div className={styles.inner}>
          <div className={styles.brand}>
            <BrandLogo className={styles.logo} inverted />
            <p className={styles.tagline}>
              Современный travel-сервис для северных, южных и активных маршрутов с акцентом на чистый выбор и крупную фотографию.
            </p>
          </div>

          <div className={styles.column}>
            <h4>Навигация</h4>
            <nav className={styles.columnLinks} aria-label="Основные разделы">
              <Link href="/tours">Подобрать тур</Link>
              <Link href="/hotels">Отели без перелёта</Link>
              <Link href="/stories">Истории путешествий</Link>
              <Link href="/about">О сервисе</Link>
            </nav>
          </div>

          <div className={styles.column}>
            <h4>Направления</h4>
            <nav className={styles.columnLinks} aria-label="Популярные направления">
              {destinations.map((tag) => (
                <Link key={tag.id} href={tag.href}>{tag.label}</Link>
              ))}
            </nav>
          </div>

          <div className={styles.column}>
            <h4>Документы</h4>
            <nav className={styles.columnLinks} aria-label="Правовые документы">
              <a href={LEGAL_DOCS.privacy.url} target="_blank" rel="noopener noreferrer">
                {LEGAL_DOCS.privacy.label}
              </a>
              <a href={LEGAL_DOCS.personalData.url} target="_blank" rel="noopener noreferrer">
                {LEGAL_DOCS.personalData.label}
              </a>
              <a href={LEGAL_DOCS.mailing.url} target="_blank" rel="noopener noreferrer">
                {LEGAL_DOCS.mailing.label}
              </a>
            </nav>
          </div>
        </div>

        <div className={styles.bottom}>
          <p className={styles.copyright}>Мои путешествия © {new Date().getFullYear()}</p>
          <div className={styles.accentLine} aria-hidden="true">
            <span className={`${styles.dot} ${styles.dotBlue}`} />
            <span className={`${styles.dot} ${styles.dotRed}`} />
            <span className={`${styles.dot} ${styles.dotYellow}`} />
          </div>
        </div>
      </div>
    </footer>
  );
}
