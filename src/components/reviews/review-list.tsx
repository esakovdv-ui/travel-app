import { formatTravelDate } from '@/lib/utils';
import type { TravelReview } from '@/types/travel';
import { StarIcon } from '@/components/icons';
import styles from './review-list.module.css';

function Stars({ rating }: { rating: number }) {
  return (
    <span className={styles.stars} aria-label={`${rating} из 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <StarIcon key={i} weight={i < rating ? 'fill' : 'light'} size={14} />
      ))}
    </span>
  );
}

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function ReviewList({ reviews }: { reviews: TravelReview[] }) {
  if (reviews.length === 0) {
    return (
      <p className={styles.empty}>
        Отзывов пока нет. Станьте первым, кто поделится впечатлениями.
      </p>
    );
  }

  return (
    <div className={styles.list}>
      {reviews.map((review) => (
        <article className={styles.card} key={review.id}>
          <div className={styles.top}>
            <div className={styles.author}>
              <div className={styles.avatar} aria-hidden="true">{initials(review.authorName)}</div>
              <div>
                <p className={styles.authorName}>{review.authorName}</p>
                <p className={styles.date}>{formatTravelDate(review.createdAt)}</p>
              </div>
            </div>
            <Stars rating={review.rating} />
          </div>
          <p className={styles.comment}>{review.comment}</p>
        </article>
      ))}
    </div>
  );
}
