import Link from 'next/link';
import { BrandLogo } from './brand-logo';
import { TelegramLogoIcon, InstagramLogoIcon, PhoneIcon, EnvelopeIcon } from '@/components/icons';
import styles from './site-footer.module.css';

export function SiteFooter() {
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
            <nav className={styles.columnLinks} aria-label="Направления">
              <Link href="/tours">Направления</Link>
              <Link href="/tours">Путешествия</Link>
              <Link href="/tours?category=active">Активный отдых</Link>
              <Link href="/about">О сервисе</Link>
            </nav>
          </div>

          <div className={styles.column}>
            <h4>Сервис</h4>
            <nav className={styles.columnLinks} aria-label="Аккаунт">
              <Link href="/tours?category=warm">Жаркие страны</Link>
              <Link href="/tours?category=cold">Холодные страны</Link>
              <Link href="/account">Личный кабинет</Link>
            </nav>
          </div>
        </div>

        <div className={styles.bottom}>
          <p className={styles.copyright}>Мои путешествия © 2026</p>
          <div className={styles.socials}>
            <Link href="https://t.me/" className={styles.socialLink} aria-label="Telegram"><TelegramLogoIcon weight="regular" size={20} /></Link>
            <Link href="https://instagram.com/" className={styles.socialLink} aria-label="Instagram"><InstagramLogoIcon weight="regular" size={20} /></Link>
            <Link href="tel:+7" className={styles.socialLink} aria-label="Телефон"><PhoneIcon weight="regular" size={20} /></Link>
            <Link href="mailto:info@mytravel.ru" className={styles.socialLink} aria-label="Email"><EnvelopeIcon weight="regular" size={20} /></Link>
          </div>
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
