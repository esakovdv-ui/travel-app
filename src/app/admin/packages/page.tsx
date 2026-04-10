import Link from 'next/link';
import { PackageAdminForm } from '@/components/admin/package-admin-form';
import { listAdminPackages } from '@/lib/repositories';
import { buildMetadata } from '@/lib/seo';
import { formatCurrency } from '@/lib/utils';
import styles from '../admin.module.css';

export const metadata = buildMetadata({
  title: 'Управление турами',
  description: 'Управление каталогом туров: создание, редактирование, публикация.'
});

export default async function AdminPackagesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  const packages = await listAdminPackages();
  const status = typeof resolved.status === 'string' ? resolved.status : undefined;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>
          <span className={styles.pageTitleAccent} aria-hidden="true" />
          Управление турами
        </h1>
        <p className={styles.pageSubtitle}>Создание, редактирование и публикация туров</p>
      </div>

      {status === 'saved' && (
        <div className={`${styles.notice} ${styles.noticeSuccess}`}>Тур сохранён и сразу появился в каталоге.</div>
      )}

      <div className={styles.formLayout}>
        {/* Create form */}
        <div className={styles.formPanel}>
          <h2 className={styles.formPanelTitle}>Добавить / редактировать тур</h2>
          <PackageAdminForm />
        </div>

        {/* Table */}
        <div className={styles.tablePanel}>
          <div className={styles.tablePanelHeader}>
            <h2 className={styles.tablePanelTitle}>Туры ({packages.length})</h2>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Тур</th>
                <th>Направление</th>
                <th>Цена</th>
                <th>Мест</th>
                <th>Рейтинг</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id}>
                  <td>
                    <div className={styles.packageCell}>
                      <img className={styles.packageThumb} src={pkg.heroImage} alt={pkg.title} />
                      <div className={styles.packageMeta}>
                        <p className={styles.packageName}>{pkg.title}</p>
                        {pkg.isFeatured && (
                          <span className="badge badge-warm">На главной</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{pkg.destination}, {pkg.country}</td>
                  <td>{formatCurrency(pkg.priceFrom)}</td>
                  <td>{pkg.seatsLeft}</td>
                  <td>{'★'.repeat(Math.round(pkg.ratingAverage))} {pkg.ratingAverage.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
