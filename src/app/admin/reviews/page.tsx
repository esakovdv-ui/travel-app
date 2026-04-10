import { updateReviewStatusAction } from '@/app/actions';
import { listAllReviews } from '@/lib/repositories';
import { buildMetadata } from '@/lib/seo';
import { formatTravelDate } from '@/lib/utils';
import { REVIEW_STATUS_LABELS } from '@/lib/constants';
import styles from '../admin.module.css';

export const metadata = buildMetadata({
  title: 'Модерация отзывов',
  description: 'Модерация отзывов путешественников: одобрение, отклонение, просмотр.'
});

export default async function AdminReviewsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  const reviews = await listAllReviews();
  const status = typeof resolved.status === 'string' ? resolved.status : undefined;

  const pending = reviews.filter((r) => r.status === 'pending').length;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>
          <span className={styles.pageTitleAccent} aria-hidden="true" />
          Модерация отзывов
        </h1>
        <p className={styles.pageSubtitle}>
          Всего: {reviews.length} · На модерации: {pending}
        </p>
      </div>

      {status === 'updated' && (
        <div className={`${styles.notice} ${styles.noticeSuccess}`}>Статус отзыва обновлён.</div>
      )}
      {status === 'invalid' && (
        <div className={`${styles.notice} ${styles.noticeError}`}>Не удалось обновить отзыв: некорректные данные.</div>
      )}

      <div className={styles.tablePanel}>
        <div className={styles.tablePanelHeader}>
          <h2 className={styles.tablePanelTitle}>Все отзывы</h2>
          {pending > 0 && (
            <span className="badge badge-warm">{pending} ожидают</span>
          )}
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Автор</th>
              <th>Оценка</th>
              <th>Статус</th>
              <th>Дата</th>
              <th>Комментарий</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((review) => (
              <tr key={review.id}>
                <td>
                  <strong>{review.authorName}</strong>
                  <br />
                  <span className={styles.subtleText}>{review.authorEmail}</span>
                </td>
                <td>
                  <span className={styles.ratingCell}>
                    <span className={styles.ratingStars}>{'★'.repeat(review.rating)}</span>
                    <span className={styles.subtleText}>{review.rating}/5</span>
                  </span>
                </td>
                <td>
                  <span className={styles[`status${review.status.charAt(0).toUpperCase() + review.status.slice(1)}` as keyof typeof styles]}>
                    {REVIEW_STATUS_LABELS[review.status]}
                  </span>
                </td>
                <td className={styles.subtleTextStrong}>
                  {formatTravelDate(review.createdAt)}
                </td>
                <td className={styles.commentPreview}>
                  {review.comment.slice(0, 100)}{review.comment.length > 100 ? '…' : ''}
                </td>
                <td>
                  <div className={styles.actionButtons}>
                    <form action={updateReviewStatusAction}>
                      <input name="reviewId" type="hidden" value={review.id} />
                      <input name="status" type="hidden" value="approved" />
                      <button className="btn btn-sm btn-secondary" type="submit">Одобрить</button>
                    </form>
                    <form action={updateReviewStatusAction}>
                      <input name="reviewId" type="hidden" value={review.id} />
                      <input name="status" type="hidden" value="rejected" />
                      <button className="btn btn-sm btn-ghost" type="submit">Отклонить</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
