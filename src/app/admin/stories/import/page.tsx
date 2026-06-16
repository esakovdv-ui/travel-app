import Link from 'next/link';
import { buildMetadata } from '@/lib/seo';
import { ImportStoriesForm } from '@/components/admin/import-stories-form';
import styles from '../../admin.module.css';

export const metadata = buildMetadata({
  title: 'Импорт историй из опроса',
  description: 'Загрузка отзывов из выгрузки опроса для модерации.',
});

export default function ImportStoriesPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>
          <span className={styles.pageTitleAccent} aria-hidden="true" />
          Импорт историй из опроса
        </h1>
        <p className={styles.pageSubtitle}>
          Загрузите выгрузку опроса (.xlsx) — подходящие отзывы попадут в список историй на модерацию.
        </p>
      </div>

      <Link href="/admin/stories" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>
        ← К списку историй
      </Link>

      <ImportStoriesForm />
    </div>
  );
}
