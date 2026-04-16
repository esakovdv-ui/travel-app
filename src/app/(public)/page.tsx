import Link from 'next/link';
import { listFeaturedReviews } from '@/lib/repositories';
import { buildMetadata } from '@/lib/seo';
import { APP_NAME } from '@/lib/constants';
import { readThematicRows, fetchRowHotels } from '@/lib/thematic-rows';
import { readSearchTags } from '@/lib/search-tags';
import type { HotelData } from '@/components/tours/hotel-card';
import {
  UmbrellaIcon, GlobeIcon, AirplaneTakeoffIcon, AirplaneLandingIcon,
  MapPinIcon, SuitcaseIcon, StarIcon,
} from '@/components/icons';
import ThematicRowBlock from '@/components/ThematicRowBlock';
import styles from './home.module.css';

function tagIcon(icon: string) {
  switch (icon) {
    case 'globe':            return <GlobeIcon weight="regular" size={18} />;
    case 'airplane-takeoff': return <AirplaneTakeoffIcon weight="regular" size={18} />;
    case 'airplane-landing': return <AirplaneLandingIcon weight="regular" size={18} />;
    case 'map-pin':          return <MapPinIcon weight="regular" size={18} />;
    case 'suitcase':         return <SuitcaseIcon weight="regular" size={18} />;
    case 'umbrella-duotone': return <UmbrellaIcon weight="duotone" size={18} />;
    default:                 return <UmbrellaIcon weight="regular" size={18} />;
  }
}

function tagIcon(icon: string) {
  switch (icon) {
    case 'globe':            return <GlobeIcon weight="regular" size={18} />;
    case 'airplane-takeoff': return <AirplaneTakeoffIcon weight="regular" size={18} />;
    case 'airplane-landing': return <AirplaneLandingIcon weight="regular" size={18} />;
    case 'map-pin':          return <MapPinIcon weight="regular" size={18} />;
    case 'suitcase':         return <SuitcaseIcon weight="regular" size={18} />;
    case 'umbrella-duotone': return <UmbrellaIcon weight="duotone" size={18} />;
    default:                 return <UmbrellaIcon weight="regular" size={18} />;
  }
}

export const metadata = buildMetadata({
  title: APP_NAME,
  description:
    'Современный сервис для поиска путешествий: тёплые страны, северные направления и активные маршруты в одном премиальном интерфейсе.'
});

export default async function HomePage() {
  const searchTags = readSearchTags()
    .filter(t => t.enabled)
    .sort((a, b) => a.order - b.order);

  const rowConfigs = readThematicRows()
    .filter(r => r.enabled)
    .sort((a, b) => a.order - b.order);

  // Последовательно — чтобы не словить rate-limit LT API при параллельных запросах
  const reviews = await listFeaturedReviews(3);
  const rowResults: HotelData[][] = [];
  for (const r of rowConfigs) {
    const items = await fetchRowHotels(r.id, r.search).catch((err) => {
      console.error(`[thematic-rows] Ошибка ряда "${r.id}":`, err);
      return [] as HotelData[];
    });
    rowResults.push(items);
  }

  const thematicRows = rowConfigs.map((config, i) => ({
    ...config,
    items: rowResults[i],
  }));

  return (
    <main className={styles.page}>
      <section className={styles.categorySection}>
        <div className="shell">
          <div className={styles.categoryRail}>
            {searchTags.map((item) => (
              <Link className={styles.categoryChip} href={item.href} key={item.id}>
                <span className={styles.categoryIcon}>{tagIcon(item.icon)}</span>
                <span className={styles.categoryText}>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.thematicSection}>
        {thematicRows.map((collection) => (
          <ThematicRowBlock key={collection.id} collection={collection} />
        ))}
      </section>

      <section className={styles.reviewSection}>
        <div className="shell">
          <div className={styles.reviewGrid}>
            {reviews.map((review) => (
              <blockquote className={styles.reviewCard} key={review.id}>
                <div className={styles.reviewTop}>
                  <div className={styles.reviewAvatar} aria-hidden="true">
                    {review.authorName.charAt(0)}
                  </div>
                  <div>
                    <div className={styles.reviewStars}>
                    {Array.from({ length: review.rating }, (_, i) => <StarIcon key={i} weight="fill" size={13} />)}
                  </div>
                    <footer className={styles.reviewAuthor}>{review.authorName}</footer>
                  </div>
                </div>
                <p className={styles.reviewText}>{review.comment}</p>
              </blockquote>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
