import { createReviewAction } from '@/app/actions';
import styles from './review-form.module.css';

export function ReviewForm({ packageId, redirectTo }: { packageId: string; redirectTo?: string }) {
  return (
    <form action={createReviewAction} className={styles.form}>
      <input name="packageId" type="hidden" value={packageId} />
      <input name="redirectTo" type="hidden" value={redirectTo ?? '/packages'} />

      <div className={styles.row}>
        <div className="field">
          <label className="field-label" htmlFor="rf-name">Ваше имя</label>
          <input id="rf-name" className="input" name="authorName" placeholder="Иван Иванов" required />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="rf-email">Email</label>
          <input id="rf-email" className="input" name="authorEmail" placeholder="ivan@example.com" required type="email" />
        </div>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="rf-rating">Оценка (1–5)</label>
        <input id="rf-rating" className={`input ${styles.ratingInput}`} max="5" min="1" name="rating" placeholder="5" required type="number" />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="rf-comment">Отзыв</label>
        <textarea id="rf-comment" className="textarea" name="comment" placeholder="Поделитесь впечатлениями о поездке..." required rows={5} />
      </div>

      <button className="btn btn-secondary btn-block" type="submit">
        Оставить отзыв
      </button>
    </form>
  );
}
