import Link from 'next/link';
import { formatCurrency, getPackageCategory } from '@/lib/utils';
import type { TravelPackage } from '@/types/travel';
import { CATEGORY_LABELS } from '@/lib/constants';
import { StarIcon } from '@/components/icons';
import styles from './package-card.module.css';

function StarRating({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <span className={styles.stars} aria-label={`Рейтинг ${value} из 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <StarIcon key={i} weight={i < full ? 'fill' : 'light'} size={13} />
      ))}
    </span>
  );
}

function getCategoryBadgeClass(category: string | null) {
  if (category === 'warm') return 'badge badge-warm';
  if (category === 'cold') return 'badge badge-cold';
  if (category === 'active') return 'badge badge-active';
  return 'badge badge-neutral';
}

export function PackageCard({ item }: { item: TravelPackage }) {
  const category = getPackageCategory(item.tags);

  return (
    <article className={styles.card}>
      <div className={styles.imageWrapper}>
        <img alt={item.title} className={styles.image} src={item.heroImage} loading="lazy" />
        {category && (
          <span className={`${styles.categoryTag} ${getCategoryBadgeClass(category)}`}>
            {CATEGORY_LABELS[category]}
          </span>
        )}
      </div>

      <div className={styles.body}>
        <p className={styles.eyebrow}>
          {item.destination}, {item.country}
        </p>
        <h3 className={styles.title}>{item.title}</h3>
        <p className={styles.summary}>{item.summary}</p>

        <div className={styles.meta}>
          <span className={styles.metaItem}>{item.durationDays} дней</span>
          <span className={styles.sep}>·</span>
          <span className={styles.metaItem}>
            <StarRating value={item.ratingAverage} />
            <span className={styles.ratingText}>{item.ratingAverage.toFixed(1)}</span>
          </span>
          <span className={styles.sep}>·</span>
          <span className={styles.metaItem}>{item.reviewCount} отзывов</span>
        </div>

        <div className={styles.footer}>
          <div className={styles.priceBlock}>
            <span className={styles.priceLabel}>от</span>
            <span className={styles.price}>{formatCurrency(item.priceFrom)}</span>
          </div>
          <Link className="btn btn-primary btn-sm" href={`/packages/${item.slug}`}>
            Смотреть тур
          </Link>
        </div>
      </div>
    </article>
  );
}
