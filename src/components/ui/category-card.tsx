import Link from 'next/link';
import { ArrowRightIcon } from '@/components/icons';
import styles from './category-card.module.css';

type CategoryCardProps = {
  type: 'warm' | 'cold' | 'active';
  title: string;
  description: string;
  direction: string;
  href: string;
};

const BG_MAP = {
  warm: styles.bgWarm,
  cold: styles.bgCold,
  active: styles.bgActive
};

export function CategoryCard({ type, title, description, direction, href }: CategoryCardProps) {
  return (
    <Link href={href} className={`${styles.card} ${BG_MAP[type]}`}>
      <div className={styles.geoAccent} aria-hidden="true" />
      <div className={styles.body}>
        <p className={styles.direction}>{direction}</p>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.desc}>{description}</p>
        <span className={styles.cta}>
          Подобрать тур
          <ArrowRightIcon weight="light" size={16} aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
