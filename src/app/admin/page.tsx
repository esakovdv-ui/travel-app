import Link from 'next/link';
import { listAdminPackages, listAllReviews } from '@/lib/repositories';
import { buildMetadata } from '@/lib/seo';
import { formatCurrency } from '@/lib/utils';
import { REVIEW_STATUS_LABELS } from '@/lib/constants';
import styles from './admin.module.css';

export const metadata = buildMetadata({ title: 'Админ-панель' });

export default async function AdminDashboardPage() {
  const [packages, reviews] = await Promise.all([listAdminPackages(), listAllReviews()]);

  const pending = reviews.filter((r) => r.status === 'pending').length;
  const approved = reviews.filter((r) => r.status === 'approved').length;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>
          <span className={styles.pageTitleAccent} aria-hidden="true" />
          Обзор
        </h1>
        <p className={styles.pageSubtitle}>Сводная статистика системы управления</p>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} ${styles.statBlue}`}>
          <p className={styles.statValue}>{packages.length}</p>
          <p className={styles.statLabel}>Туров</p>
        </div>
        <div className={`${styles.statCard} ${styles.statYellow}`}>
          <p className={styles.statValue}>{pending}</p>
          <p className={styles.statLabel}>Отзывов на модерации</p>
        </div>
        <div className={`${styles.statCard} ${styles.statGreen}`}>
          <p className={styles.statValue}>{approved}</p>
          <p className={styles.statLabel}>Одобренных отзывов</p>
        </div>
        <div className={`${styles.statCard} ${styles.statRed}`}>
          <p className={styles.statValue}>{packages.filter((p) => p.isFeatured).length}</p>
          <p className={styles.statLabel}>На главной</p>
        </div>
      </div>

      <div className={styles.dashGrid}>
        {/* Recent packages */}
        <div className={styles.tablePanel}>
          <div className={styles.tablePanelHeader}>
            <h2 className={styles.tablePanelTitle}>Последние туры</h2>
            <Link className="btn btn-secondary btn-sm" href="/admin/packages">Все туры →</Link>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Тур</th>
                <th>Цена от</th>
                <th>Мест</th>
              </tr>
            </thead>
            <tbody>
              {packages.slice(0, 5).map((pkg) => (
                <tr key={pkg.id}>
                  <td>
                    <span className={styles.packageName}>{pkg.title}</span>
                    <br />
                    <span className={styles.subtleText}>{pkg.destination}</span>
                  </td>
                  <td>{formatCurrency(pkg.priceFrom)}</td>
                  <td>{pkg.seatsLeft}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recent reviews */}
        <div className={styles.tablePanel}>
          <div className={styles.tablePanelHeader}>
            <h2 className={styles.tablePanelTitle}>Последние отзывы</h2>
            <Link className="btn btn-secondary btn-sm" href="/admin/reviews">Все отзывы →</Link>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Автор</th>
                <th>Оценка</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {reviews.slice(0, 5).map((review) => (
                <tr key={review.id}>
                  <td>{review.authorName}</td>
                  <td>{'★'.repeat(review.rating)}</td>
                  <td>
                    <span className={styles[`status${review.status.charAt(0).toUpperCase() + review.status.slice(1)}` as keyof typeof styles]}>
                      {REVIEW_STATUS_LABELS[review.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
