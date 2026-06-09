'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { STORY_TAGS } from '@/lib/constants';
import type { Story } from '@/types/travel';
import styles from './stories-section.module.css';

interface Props {
  stories: Story[];
}

export function StoriesSection({ stories }: Props) {
  const [activeTag, setActiveTag] = useState('Все');

  const filtered = activeTag === 'Все'
    ? stories
    : stories.filter((s) => s.pubTag === activeTag);

  return (
    <section id="stories" className={`section ${styles.section}`}>
      <div className="shell">
        <div className={styles.header}>
          <div>
            <p className="eyebrow" style={{ marginBottom: 8 }}>Истории клиентов</p>
            <h2 className={`section-title ${styles.title}`}>Что говорят путешественники</h2>
          </div>
        </div>

        <div className={styles.filters}>
          {STORY_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`${styles.filterPill} ${activeTag === tag ? styles.filterPillActive : ''}`}
            >
              {tag}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className={styles.empty}>По этому фильтру историй пока нет.</p>
        ) : (
          <div className={styles.carousel}>
            {filtered.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function StoryCard({ story }: { story: Story }) {
  const photo = story.photos[0] ?? 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80';
  const href = story.pubObjectUrl ?? '#';

  return (
    <article className={styles.card}>
      <div className={styles.cardPhoto}>
        <Image
          src={photo}
          alt={story.pubTitle ?? story.rawObject}
          fill
          style={{ objectFit: 'cover' }}
          sizes="320px"
        />
        {story.pubTag && (
          <span className={styles.cardTag}>{story.pubTag}</span>
        )}
      </div>
      <div className={styles.cardBody}>
        <span className={styles.cardObject}>{story.rawObject}</span>
        <h3 className={styles.cardTitle}>{story.pubTitle}</h3>
        <p className={styles.cardQuote}>{story.pubQuote}</p>
      </div>
      <div className={styles.cardFooter}>
        <div className={styles.cardAuthor}>
          <div className={styles.cardAvatar}>
            {story.rawAuthorName.charAt(0).toUpperCase()}
          </div>
          <div>
            <span className={styles.cardAuthorName}>{story.rawAuthorName}</span>
            <span className={styles.cardPeriod}>{story.rawPeriod}</span>
          </div>
        </div>
        <Link href={href} className={styles.cardArrow} aria-label="Перейти к объекту">
          →
        </Link>
      </div>
    </article>
  );
}
