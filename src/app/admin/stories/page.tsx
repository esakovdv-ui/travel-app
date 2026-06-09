import Link from 'next/link';
import { listAllStories } from '@/lib/repositories';
import { buildMetadata } from '@/lib/seo';
import { STORY_STATUS_LABELS, STORY_TAGS } from '@/lib/constants';
import styles from '../admin.module.css';
import pageStyles from './stories-admin.module.css';

export const metadata = buildMetadata({
  title: 'Истории путешествий — модерация',
  description: 'Модерация историй клиентов МосГорТур.'
});

export default async function AdminStoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const filterStatus = params.status;
  const stories = await listAllStories();

  const displayed = filterStatus && filterStatus !== 'all'
    ? stories.filter((s) => s.status === filterStatus)
    : stories;

  const counts = {
    all: stories.length,
    new: stories.filter((s) => s.status === 'new').length,
    published: stories.filter((s) => s.status === 'published').length,
    rejected: stories.filter((s) => s.status === 'rejected').length,
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>
          <span className={styles.pageTitleAccent} aria-hidden="true" />
          Истории путешествий
        </h1>
        <p className={styles.pageSubtitle}>
          Всего: {counts.all} · На модерации: {counts.new}
        </p>
      </div>

      {/* Status tabs */}
      <div className={pageStyles.tabs}>
        {[
          { key: undefined, label: 'Все', count: counts.all },
          { key: 'new', label: 'Новые', count: counts.new },
          { key: 'published', label: 'Опубликованные', count: counts.published },
          { key: 'rejected', label: 'Отклонённые', count: counts.rejected },
        ].map(({ key, label, count }) => (
          <Link
            key={label}
            href={key ? `/admin/stories?status=${key}` : '/admin/stories'}
            className={`${pageStyles.tab} ${(!filterStatus && !key) || filterStatus === key ? pageStyles.tabActive : ''}`}
          >
            {label}
            {count > 0 && <span className={pageStyles.tabCount}>{count}</span>}
          </Link>
        ))}
      </div>

      <div className={styles.tablePanel}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Дата подачи</th>
              <th>Автор</th>
              <th>Объект</th>
              <th>Период</th>
              <th>Менеджер</th>
              <th>Фото</th>
              <th>Тег</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 && (
              <tr>
                <td colSpan={9} className={styles.subtleText} style={{ textAlign: 'center', padding: '32px 0' }}>
                  Историй нет
                </td>
              </tr>
            )}
            {displayed.map((story) => (
              <tr key={story.id}>
                <td className={styles.subtleTextStrong}>
                  {new Date(story.submittedAt).toLocaleDateString('ru-RU', {
                    day: '2-digit', month: '2-digit', year: '2-digit',
                  })}
                  <br />
                  <span className={styles.subtleText}>
                    {new Date(story.submittedAt).toLocaleTimeString('ru-RU', {
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </td>
                <td><strong>{story.rawAuthorName}</strong></td>
                <td className={styles.commentPreview}>{story.rawObject}</td>
                <td className={styles.subtleText}>{story.rawPeriod || '—'}</td>
                <td className={styles.subtleText}>{story.rawManager || '—'}</td>
                <td>
                  {story.photos.length > 0
                    ? <span className={pageStyles.photoYes}>📷 {story.photos.length}</span>
                    : <span className={styles.subtleText}>—</span>
                  }
                </td>
                <td>
                  {story.pubTag
                    ? <span className="badge">{story.pubTag}</span>
                    : <span className={styles.subtleText}>—</span>
                  }
                </td>
                <td>
                  <span className={styles[`status${story.status.charAt(0).toUpperCase() + story.status.slice(1)}` as keyof typeof styles]}>
                    {STORY_STATUS_LABELS[story.status]}
                  </span>
                </td>
                <td>
                  <Link
                    href={`/admin/stories/${story.id}`}
                    className="btn btn-sm btn-secondary"
                  >
                    Просмотр
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
