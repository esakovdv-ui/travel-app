'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ThematicRowConfig } from '@/lib/thematic-rows';
import type { HotelData } from '@/components/tours/hotel-card';
import { StarIcon, ArrowRightIcon } from '@/components/icons';
import styles from '@/app/(public)/home.module.css';

function nights(n: number) {
  if (n === 1) return 'ночь';
  if (n >= 2 && n <= 4) return 'ночи';
  return 'ночей';
}

interface Props {
  collection: ThematicRowConfig & { items: HotelData[] };
}

export default function ThematicRowBlock({ collection }: Props) {
  const [items, setItems] = useState<HotelData[]>(collection.items);
  const [loading, setLoading] = useState(collection.items.length === 0);

  useEffect(() => {
    if (collection.items.length > 0) return;

    let cancelled = false;
    setLoading(true);

    fetch(`/api/thematic-rows/${encodeURIComponent(collection.id)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (!cancelled && Array.isArray(data.hotels)) {
          setItems(data.hotels);
        }
      })
      .catch(() => { /* silent — user sees empty state */ })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [collection.id, collection.items.length]);

  const wlBaseUrl = process.env.NEXT_PUBLIC_WL_BASE_URL ?? '';

  return (
    <section className={styles.thematicRow}>
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
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div className={`${styles.thematicListingCard} ${styles.thematicListingCardSkeleton}`} key={i}>
                <div className={`${styles.thematicListingImage} ${styles.skeletonBlock}`} />
                <div className={styles.thematicListingBody}>
                  <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
                  <div className={`${styles.skeletonLine} ${styles.skeletonLineMid}`} />
                  <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
                  <div className={`${styles.skeletonLine} ${styles.skeletonLineXShort}`} />
                </div>
              </div>
            ))
          : items.map((item) => {
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
                      <p className={styles.thematicListingPlace}>{item.hotel.region_name}</p>
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
            })
        }

        {!loading && (
          <Link className={styles.thematicSeeAllCard} href={collection.href}>
            <div className={styles.thematicSeeAllStack} aria-hidden="true">
              <span /><span /><span />
            </div>
            <div className={styles.thematicSeeAllFooter}>
              <span className={styles.thematicSeeAllText}>Смотреть всё</span>
              <ArrowRightIcon weight="regular" size={18} />
            </div>
          </Link>
        )}
      </div>
    </section>
  );
}
