'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Story, StoryTag } from '@/types/travel';
import styles from './stories-section.module.css';

const INITIAL_LIMIT = 8;
const MORE_LIMIT = 6;

interface Props {
  initialStories: Story[];
  total: number;
  tags: StoryTag[];
}

export function StoriesSection({ initialStories, total: initialTotal, tags }: Props) {
  const [stories, setStories]   = useState(initialStories);
  const [total, setTotal]       = useState(initialTotal);
  const [offset, setOffset]     = useState(INITIAL_LIMIT);
  const [hasMore, setHasMore]   = useState(initialTotal > INITIAL_LIMIT);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const editorial       = stories.slice(0, 4);
  const carouselStories = stories.slice(4, 8);
  const appended        = stories.slice(8);

  async function handleTagChange(slug: string | null) {
    const qs = slug ? `&tag=${slug}` : '';
    startTransition(async () => {
      const res  = await fetch(`/api/stories?offset=0&limit=${INITIAL_LIMIT}${qs}`);
      const data = await res.json();
      setStories(data.stories);
      setTotal(data.total);
      setHasMore(data.hasMore);
      setOffset(INITIAL_LIMIT);
      setActiveTag(slug);
    });
  }

  async function loadMore() {
    const qs = activeTag ? `&tag=${activeTag}` : '';
    startTransition(async () => {
      const res  = await fetch(`/api/stories?offset=${offset}&limit=${MORE_LIMIT}${qs}`);
      const data = await res.json();
      setStories((prev) => [...prev, ...data.stories]);
      setOffset((prev) => prev + MORE_LIMIT);
      setHasMore(data.hasMore);
    });
  }

  return (
    <section id="stories" className={`section ${styles.section}`}>
      <div className="shell">
        <div className={styles.header}>
          <div>
            <p className="eyebrow" style={{ marginBottom: 8 }}>Истории клиентов</p>
            <h2 className={`section-title ${styles.title}`}>Что говорят путешественники</h2>
          </div>
        </div>

        {/* Filters */}
        <div className={styles.filters}>
          <button
            onClick={() => handleTagChange(null)}
            disabled={isPending}
            className={`${styles.filterPill} ${activeTag === null ? styles.filterPillActive : ''}`}
          >
            Все
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => handleTagChange(tag.slug)}
              disabled={isPending}
              className={`${styles.filterPill} ${activeTag === tag.slug ? styles.filterPillActive : ''}`}
            >
              {tag.label}
            </button>
          ))}
        </div>

        {isPending && stories.length === 0 ? (
          <p className={styles.empty}>Загружаем истории…</p>
        ) : stories.length === 0 ? (
          <p className={styles.empty}>По этому фильтру историй пока нет.</p>
        ) : (
          <>
            {/* Editorial grid */}
            <div className={styles.editorial}>
              {editorial[0] && <HeroCard story={editorial[0]} />}
              {editorial.length > 1 && (
                <div className={styles.editorialRow}>
                  {editorial.slice(1).map((story) => (
                    <StoryCard key={story.id} story={story} />
                  ))}
                </div>
              )}
            </div>

            {/* Carousel */}
            {carouselStories.length > 0 && (
              <div className={styles.carouselSection}>
                <h3 className={styles.carouselTitle}>Ещё истории</h3>
                <div className={styles.carousel}>
                  {carouselStories.map((story) => (
                    <StoryCard key={story.id} story={story} />
                  ))}
                </div>
              </div>
            )}

            {/* Appended stories after load more */}
            {appended.length > 0 && (
              <div className={styles.appendedGrid}>
                {appended.map((story) => (
                  <StoryCard key={story.id} story={story} />
                ))}
              </div>
            )}

            {/* Load more / all shown */}
            {hasMore && (
              <div className={styles.loadMore}>
                <button
                  onClick={loadMore}
                  disabled={isPending}
                  className={styles.loadMoreBtn}
                >
                  {isPending ? 'Загружаем…' : 'Показать ещё 6 историй'}
                </button>
                <span className={styles.loadMoreHint}>
                  Показано {stories.length} из {total}
                </span>
              </div>
            )}
            {!hasMore && stories.length > INITIAL_LIMIT && (
              <p className={styles.allShown}>Все истории показаны</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function HeroCard({ story }: { story: Story }) {
  const photo = story.photos[0] ?? 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80';
  const href  = story.pubObjectUrl ?? '#';

  return (
    <article className={styles.heroCard}>
      <div className={styles.heroPhotoWrap}>
        <Image src={photo} alt={story.pubTitle ?? story.rawObject} fill style={{ objectFit: 'cover' }} sizes="(max-width: 900px) 100vw, 60vw" />
        <div className={styles.heroOverlay} />
        <span className={styles.heroObject}>{story.rawObject}</span>
        {story.pubTag && <span className={styles.heroTag}>{story.pubTag}</span>}
        <div className={styles.heroContent}>
          <h3 className={styles.heroTitle}>{story.pubTitle}</h3>
          {story.pubQuote && <p className={styles.heroQuote}>«{story.pubQuote}»</p>}
          <div className={styles.heroFooter}>
            <div className={styles.cardAuthor}>
              <div className={`${styles.cardAvatar} ${styles.heroAvatar}`}>
                {story.rawAuthorName.charAt(0).toUpperCase()}
              </div>
              <div>
                <span className={`${styles.cardAuthorName} ${styles.heroText}`}>{story.rawAuthorName}</span>
                <span className={`${styles.cardPeriod} ${styles.heroTextMuted}`}>{story.rawPeriod}</span>
              </div>
            </div>
            <Link href={href} className={styles.cardArrow} aria-label="Перейти к объекту">→</Link>
          </div>
        </div>
      </div>
      <div className={styles.heroMobileBody}>
        <div className={styles.cardBody}>
          <span className={styles.cardObject}>{story.rawObject}</span>
          <h3 className={styles.cardTitle}>{story.pubTitle}</h3>
          <p className={styles.cardQuote}>{story.pubQuote}</p>
        </div>
        <div className={styles.cardFooter}>
          <div className={styles.cardAuthor}>
            <div className={styles.cardAvatar}>{story.rawAuthorName.charAt(0).toUpperCase()}</div>
            <div>
              <span className={styles.cardAuthorName}>{story.rawAuthorName}</span>
              <span className={styles.cardPeriod}>{story.rawPeriod}</span>
            </div>
          </div>
          <Link href={href} className={styles.cardArrow} aria-label="Перейти к объекту">→</Link>
        </div>
      </div>
    </article>
  );
}

function StoryCard({ story }: { story: Story }) {
  const photo = story.photos[0] ?? 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80';
  const href  = story.pubObjectUrl ?? '#';

  return (
    <article className={styles.card}>
      <div className={styles.cardPhoto}>
        <Image src={photo} alt={story.pubTitle ?? story.rawObject} fill style={{ objectFit: 'cover' }} sizes="320px" />
        {story.pubTag && <span className={styles.cardTag}>{story.pubTag}</span>}
      </div>
      <div className={styles.cardBody}>
        <span className={styles.cardObject}>{story.rawObject}</span>
        <h3 className={styles.cardTitle}>{story.pubTitle}</h3>
        <p className={styles.cardQuote}>{story.pubQuote}</p>
      </div>
      <div className={styles.cardFooter}>
        <div className={styles.cardAuthor}>
          <div className={styles.cardAvatar}>{story.rawAuthorName.charAt(0).toUpperCase()}</div>
          <div>
            <span className={styles.cardAuthorName}>{story.rawAuthorName}</span>
            <span className={styles.cardPeriod}>{story.rawPeriod}</span>
          </div>
        </div>
        <Link href={href} className={styles.cardArrow} aria-label="Перейти к объекту">→</Link>
      </div>
    </article>
  );
}
