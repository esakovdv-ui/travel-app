import { TicketIcon, HeartIcon, StarIcon, SlidersIcon, UsersThreeIcon } from '@/components/icons';
import { buildMetadata } from '@/lib/seo';
import { listFeaturedPackages, listBookingsByUser } from '@/lib/repositories';
import { getSession } from '@/lib/session';
import { logoutAction } from '@/app/actions';
import { BOOKING_STATUS_LABELS } from '@/lib/constants';
import styles from './account.module.css';

export const metadata = buildMetadata({
  title: 'Личный кабинет',
  description: 'Управляйте бронированиями, сохранёнными турами и настройками аккаунта.'
});

export default async function AccountPage() {
  const session = await getSession();
  if (!session) return null; // middleware уже редиректит неавторизованных

  const [bookings, saved] = await Promise.all([
    listBookingsByUser(session.userId),
    listFeaturedPackages(),
  ]);

  const initials = `${session.firstName[0] ?? ''}${session.lastName[0] ?? ''}`.toUpperCase();

  return (
    <main className={`shell ${styles.page}`}>
      <div className={styles.layout}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.profileCard}>
            <div className={styles.avatar} aria-hidden="true">{initials}</div>
            <p className={styles.userName}>{session.firstName} {session.lastName}</p>
            <p className={styles.userEmail}>{session.email}</p>
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

          <form action={logoutAction} className={styles.logoutForm}>
            <button type="submit" className={styles.logoutBtn}>Выйти</button>
          </form>
        </aside>

        {/* Content */}
        <div className={styles.content}>
          {/* Bookings */}
          <div className={styles.panel}>
            <h2 className={styles.sectionTitle}>Мои бронирования</h2>
            {bookings.length === 0 ? (
              <p className={styles.emptyHint}>У вас пока нет бронирований.</p>
            ) : (
              <div className={styles.bookingList}>
                {bookings.map((booking) => {
                  const statusKey = `status${booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}` as keyof typeof styles;
                  return (
                    <div key={booking.id} className={styles.bookingCard}>
                      <div className={styles.bookingInfo}>
                        <p className={styles.bookingTitle}>Пакет #{booking.packageId}</p>
                        <p className={styles.bookingMeta}>
                          {booking.travelDate} · {booking.travelersCount} чел.
                          {booking.notes ? ` · ${booking.notes}` : ''}
                        </p>
                      </div>
                      <span className={styles[statusKey]}>
                        {BOOKING_STATUS_LABELS[booking.status] ?? booking.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Saved */}
          <div className={styles.panel}>
            <h2 className={styles.sectionTitle}>Сохранённые туры</h2>
            <div className={styles.savedGrid}>
              {saved.slice(0, 3).map((pkg) => (
                <a key={pkg.id} href={`/packages/${pkg.slug}`} className={styles.savedCard}>
                  <img src={pkg.heroImage} alt={pkg.title} className={styles.savedImage} />
                  <div className={styles.savedBody}>
                    <p className={styles.savedDestination}>{pkg.destination}</p>
                    <p className={styles.savedTitle}>{pkg.title}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Settings */}
          <div className={styles.panel}>
            <h2 className={styles.sectionTitle}>Настройки аккаунта</h2>
            <form className={styles.settingsForm}>
              <div className={styles.settingsRow}>
                <div className="field">
                  <label className="field-label" htmlFor="acc-fname">Имя</label>
                  <input id="acc-fname" className="input" defaultValue={session.firstName} name="firstName" />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="acc-lname">Фамилия</label>
                  <input id="acc-lname" className="input" defaultValue={session.lastName} name="lastName" />
                </div>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="acc-email">Email</label>
                <input id="acc-email" className="input" defaultValue={session.email} name="email" type="email" />
              </div>
              <button className="btn btn-primary" type="button">Сохранить изменения</button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
