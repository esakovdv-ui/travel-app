import Link from 'next/link';
import { listFeaturedReviews } from '@/lib/repositories';
import { buildMetadata } from '@/lib/seo';
import { APP_NAME } from '@/lib/constants';
import { readThematicRows, fetchRowHotels } from '@/lib/thematic-rows';
import { readSearchTags } from '@/lib/search-tags';
import type { HotelData } from '@/components/tours/hotel-card';
import {
  UmbrellaIcon, GlobeIcon, AirplaneTakeoffIcon, AirplaneLandingIcon,
  MapPinIcon, SuitcaseIcon, StarIcon, ArrowRightIcon,
} from '@/components/icons';
import styles from './home.module.css';

function nights(n: number) {
  if (n === 1) return 'ночь';
  if (n >= 2 && n <= 4) return 'ночи';
  return 'ночей';
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

  const [reviews, ...rowResults] = await Promise.all([
    listFeaturedReviews(3),
    ...rowConfigs.map(r =>
      fetchRowHotels(r.id, r.search).catch((err) => {
        console.error(`[thematic-rows] Ошибка ряда "${r.id}":`, err);
        return [] as HotelData[];
      })
    ),
  ]);

  const thematicRows = rowConfigs.map((config, i) => ({
    ...config,
    items: rowResults[i] as HotelData[],
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
          <section className={styles.thematicRow} key={collection.title}>
            <div className={`shell ${styles.thematicRowHeader}`}>
              <div>
                <p className={styles.thematicEyebrow}>{collection.eyebrow}</p>
                <h3 className={styles.thematicRowTitle}>{collection.title}</h3>
                <p className={styles.thematicRowDescription}>{collection.description}</p>
              </div>
              <Link className={styles.thematicMore} href={collection.href}>
                Смотреть всё
              </Link>
            </div>

            <div className={styles.thematicScroller}>
              {collection.items.map((item) => {
                const wlBaseUrl = process.env.NEXT_PUBLIC_WL_BASE_URL ?? '';
                const image = item.hotel.images?.[0]?.x500;
                const price = item.min_price?.toLocaleString('ru-RU');

                return (
                  <a
                    className={styles.thematicListingCard}
                    href={`${wlBaseUrl}${item.hotel.link}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    key={`${collection.id}-${item.tour_id}`}
                  >
                    {image
                      ? <img alt={item.hotel.name} className={styles.thematicListingImage} src={image} />
                      : <div className={`${styles.thematicListingImage} ${styles.thematicListingImagePlaceholder}`} />
                    }
                    <div className={styles.thematicListingBody}>
                      <div className={styles.thematicListingTop}>
                        <p className={styles.thematicListingPlace}>
                          {item.hotel.region_name}
                        </p>
                        {item.hotel.rating > 0 && (
                          <span className={styles.thematicListingRating}>
                            <StarIcon weight="fill" size={12} /> {item.hotel.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <h4 className={styles.thematicListingTitle}>{item.hotel.name}</h4>
                      <p className={styles.thematicListingMeta}>
                        {item.min_price_nights} {nights(item.min_price_nights)}
                        {item.hotel.stars > 0 && ` · ${'★'.repeat(item.hotel.stars)}`}
                      </p>
                      <p className={styles.thematicListingPrice}>от {price} ₽</p>
                    </div>
                  </a>
                );
              })}

              <Link className={styles.thematicSeeAllCard} href={collection.href}>
                <div className={styles.thematicSeeAllStack} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <div className={styles.thematicSeeAllFooter}>
                  <span className={styles.thematicSeeAllText}>Смотреть всё</span>
                  <ArrowRightIcon weight="regular" size={18} />
                </div>
              </Link>
            </div>
          </section>
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
