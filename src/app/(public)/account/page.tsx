import Link from 'next/link';
import { TicketIcon, HeartIcon, StarIcon, SlidersIcon, UsersThreeIcon } from '@/components/icons';
import { buildMetadata } from '@/lib/seo';
import { listFeaturedPackages } from '@/lib/repositories';
import { BOOKING_STATUS_LABELS } from '@/lib/constants';
import styles from './account.module.css';

export const metadata = buildMetadata({
  title: 'Личный кабинет',
  description: 'Управляйте бронированиями, сохранёнными турами и настройками аккаунта.'
});

const MOCK_TOURISTS = [
  { id: 't1', firstName: 'Демо', lastName: 'Аккаунт', middleName: 'Иванович', dob: '1990-05-12', passport: '7712 345678', passportExpiry: '2030-05-12', citizenship: 'Россия', gender: 'М' },
  { id: 't2', firstName: 'Мария', lastName: 'Аккаунт', middleName: 'Ивановна', dob: '1992-09-23', passport: '4521 987654', passportExpiry: '2029-09-23', citizenship: 'Россия', gender: 'Ж' },
];

const MOCK_BOOKINGS = [
  { id: 'b1', title: 'Бали: Роскошный побег', destination: 'Убуд, Индонезия', date: '2026-06-15', travelers: 2, status: 'confirmed' as const },
  { id: 'b2', title: 'Исландия: Огонь и Лёд', destination: 'Рейкьявик, Исландия', date: '2026-08-20', travelers: 1, status: 'pending' as const }
];

export default async function AccountPage() {
  const saved = await listFeaturedPackages();

  return (
    <main className={`shell ${styles.page}`}>
      <div className={styles.layout}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.profileCard}>
            <div className={styles.avatar} aria-hidden="true">ДА</div>
            <p className={styles.userName}>Демо Аккаунт</p>
            <p className={styles.userEmail}>demo@mytravel.ru</p>
            <span className={styles.userRole}>Путешественник</span>
          </div>

          <nav className={styles.sideNav} aria-label="Меню кабинета">
            <div className={`${styles.sideNavItem} ${styles.sideNavItemActive}`}>
              <TicketIcon weight="regular" size={18} /> Мои бронирования
            </div>
            <div className={styles.sideNavItem}><UsersThreeIcon weight="regular" size={18} /> Туристы</div>
            <div className={styles.sideNavItem}><HeartIcon weight="regular" size={18} /> Сохранённые</div>
            <div className={styles.sideNavItem}><StarIcon weight="regular" size={18} /> Мои отзывы</div>
            <div className={styles.sideNavItem}><SlidersIcon weight="regular" size={18} /> Настройки</div>
          </nav>
        </aside>

        {/* Content */}
        <div className={styles.content}>
          {/* Bookings */}
          <div className={styles.panel}>
            <h2 className={styles.sectionTitle}>
Мои бронирования
            </h2>
            <div className={styles.bookingList}>
              {MOCK_BOOKINGS.map((booking) => (
                <div key={booking.id} className={styles.bookingCard}>
                  <div className={styles.bookingInfo}>
                    <p className={styles.bookingTitle}>{booking.title}</p>
                    <p className={styles.bookingMeta}>{booking.destination} · {booking.date} · {booking.travelers} чел.</p>
                  </div>
                  <span className={styles[`status${booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}` as keyof typeof styles]}>
                    {BOOKING_STATUS_LABELS[booking.status]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Tourists */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.sectionTitle}>Туристы</h2>
              <button className={styles.addBtn} type="button">+ Добавить</button>
            </div>
            <div className={styles.touristList}>
              {MOCK_TOURISTS.map(t => (
                <div key={t.id} className={styles.touristCard}>
                  <div className={styles.touristAvatar}>{t.firstName[0]}{t.lastName[0]}</div>
                  <div className={styles.touristInfo}>
                    <p className={styles.touristName}>{t.lastName} {t.firstName} {t.middleName}</p>
                    <p className={styles.touristMeta}>
                      {t.dob} · паспорт {t.passport} · до {t.passportExpiry}
                    </p>
                    <p className={styles.touristMeta}>{t.citizenship} · {t.gender}</p>
                  </div>
                  <button className={styles.editBtn} type="button">Изменить</button>
                </div>
              ))}
            </div>
          </div>

          {/* Saved */}
          <div className={styles.panel}>
            <h2 className={styles.sectionTitle}>
Сохранённые туры
            </h2>
            <div className={styles.savedGrid}>
              {saved.slice(0, 3).map((pkg) => (
                <Link key={pkg.id} href={`/packages/${pkg.slug}`} className={styles.savedCard}>
                  <img src={pkg.heroImage} alt={pkg.title} className={styles.savedImage} />
                  <div className={styles.savedBody}>
                    <p className={styles.savedDestination}>{pkg.destination}</p>
                    <p className={styles.savedTitle}>{pkg.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Settings */}
          <div className={styles.panel}>
            <h2 className={styles.sectionTitle}>
Настройки аккаунта
            </h2>
            <form className={styles.settingsForm}>
              <div className={styles.settingsRow}>
                <div className="field">
                  <label className="field-label" htmlFor="acc-fname">Имя</label>
                  <input id="acc-fname" className="input" defaultValue="Демо" name="firstName" />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="acc-lname">Фамилия</label>
                  <input id="acc-lname" className="input" defaultValue="Аккаунт" name="lastName" />
                </div>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="acc-email">Email</label>
                <input id="acc-email" className="input" defaultValue="demo@mytravel.ru" name="email" type="email" />
              </div>
              <button className="btn btn-primary" type="button">Сохранить изменения</button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
