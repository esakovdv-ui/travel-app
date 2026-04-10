import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookingForm } from '@/components/forms/booking-form';
import { ReviewForm } from '@/components/forms/review-form';
import { ReviewList } from '@/components/reviews/review-list';
import { PackageCard } from '@/components/packages/package-card';
import { formatCurrency, getPackageCategory } from '@/lib/utils';
import { getPackageBySlug, listApprovedReviews, listFeaturedPackages } from '@/lib/repositories';
import { buildMetadata } from '@/lib/seo';
import { CATEGORY_LABELS } from '@/lib/constants';
import { CalendarBlankIcon, StarIcon, UsersThreeIcon, CheckIcon, XIcon } from '@/components/icons';
import styles from './detail.module.css';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pkg = await getPackageBySlug(slug);
  if (!pkg) return buildMetadata({ title: 'Тур не найден' });
  return buildMetadata({ title: pkg.title, description: pkg.summary, path: `/packages/${pkg.slug}` });
}

const MOCK_ITINERARY = [
  'Прилёт, трансфер в отель, знакомство с направлением',
  'Экскурсия по главным достопримечательностям',
  'Свободное время, опциональные активности',
  'Гастрономический тур и местные рынки',
  'Природный маршрут: горы, побережье или парки',
  'Культурная программа, мастер-классы',
  'Отдых, шопинг, вылет домой'
];

const MOCK_INCLUDED = ['Авиаперелёт туда-обратно', 'Трансфер аэропорт — отель', 'Проживание (двойной номер)', 'Завтраки ежедневно', 'Услуги гида'];
const MOCK_NOT_INCLUDED = ['Обеды и ужины', 'Личные расходы', 'Страховка', 'Дополнительные экскурсии'];

export default async function PackageDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const resolvedSearch = await searchParams;
  const [pkg, similar] = await Promise.all([getPackageBySlug(slug), listFeaturedPackages()]);

  if (!pkg) notFound();

  const reviews = await listApprovedReviews(pkg.id);
  const category = getPackageCategory(pkg.tags);
  const similarPackages = similar.filter((p) => p.id !== pkg.id).slice(0, 3);
  const bookingStatus = typeof resolvedSearch.status === 'string' ? resolvedSearch.status : undefined;
  const bookingMessage = typeof resolvedSearch.booking === 'string' ? resolvedSearch.booking : undefined;
  const reviewStatus = typeof resolvedSearch.reviewStatus === 'string' ? resolvedSearch.reviewStatus : undefined;
  const reviewMessage = typeof resolvedSearch.reviewMessage === 'string' ? resolvedSearch.reviewMessage : undefined;

  return (
    <main className={`shell ${styles.page}`}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb} aria-label="Навигация">
        <Link href="/">Главная</Link>
        <span aria-hidden="true">›</span>
        <Link href="/packages">Туры</Link>
        <span aria-hidden="true">›</span>
        <span>{pkg.title}</span>
      </nav>

      {/* Hero: image + booking widget */}
      <div className={styles.heroGrid}>
        <div>
          <div className={styles.titleSection}>
            <p className={styles.destination}>
              {pkg.destination}, {pkg.country}
              {category && (
                <span className={`badge badge-${category} ${styles.categoryBadge}`}>
                  {CATEGORY_LABELS[category]}
                </span>
              )}
            </p>
            <h1 className={styles.title}>{pkg.title}</h1>

            <div className={styles.highlights}>
              <span className={styles.highlight}><span className={styles.highlightIcon}><CalendarBlankIcon weight="regular" size={15} /></span>{pkg.durationDays} дней</span>
              <span className={styles.highlight}><span className={styles.highlightIcon}><StarIcon weight="fill" size={15} /></span>{pkg.ratingAverage.toFixed(1)} ({pkg.reviewCount} отзывов)</span>
              <span className={styles.highlight}><span className={styles.highlightIcon}><UsersThreeIcon weight="regular" size={15} /></span>{pkg.seatsLeft} мест</span>
            </div>
          </div>

          <img alt={pkg.title} className={styles.heroImage} src={pkg.heroImage} />

          {pkg.gallery.length > 0 && (
            <div className={styles.gallery}>
              {pkg.gallery.slice(0, 2).map((img) => (
                <img key={img} alt={`${pkg.title} галерея`} className={styles.galleryImg} src={img} />
              ))}
            </div>
          )}
        </div>

        {/* Booking widget */}
        <div className={styles.bookingWidget}>
          <div className={styles.widgetPriceRow}>
            <span className={styles.widgetPriceLabel}>от</span>
            <span className={styles.widgetPrice}>{formatCurrency(pkg.priceFrom)}</span>
          </div>
          <p className={styles.widgetTitle}>Забронировать тур</p>
          {bookingStatus === 'success' && (
            <div className={`${styles.feedback} ${styles.feedbackSuccess}`}>Заявка отправлена. Мы скоро свяжемся с вами.</div>
          )}
          {bookingStatus === 'error' && bookingMessage && (
            <div className={`${styles.feedback} ${styles.feedbackError}`}>{bookingMessage}</div>
          )}
          <BookingForm packageId={pkg.id} redirectTo={`/packages/${pkg.slug}`} />
        </div>
      </div>

      {/* Content */}
      <div className={styles.contentGrid}>
        <div className={styles.content}>

          {/* Overview */}
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>
              <span className={styles.panelTitleAccent} aria-hidden="true" />
              Обзор
            </h2>
            <p className={styles.description}>{pkg.description}</p>
          </div>

          {/* Itinerary */}
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>
              <span className={styles.panelTitleAccent} aria-hidden="true" />
              Маршрут по дням
            </h2>
            <div className={styles.itinerary}>
              {MOCK_ITINERARY.slice(0, pkg.durationDays).map((day, i) => (
                <div key={i} className={styles.dayItem}>
                  <span className={styles.dayNum}>{i + 1}</span>
                  <p className={styles.dayText}>{day}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Included */}
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>
              <span className={styles.panelTitleAccent} aria-hidden="true" />
              Включено / Не включено
            </h2>
            <div className={styles.includedGrid}>
              <div className={styles.includeList}>
                <p className={styles.includeHeading}>Включено</p>
                {MOCK_INCLUDED.map((item) => (
                  <div key={item} className={styles.includeItem}>
                    <CheckIcon weight="bold" size={14} color="var(--c-green, #16a34a)" aria-hidden="true" />
                    {item}
                  </div>
                ))}
              </div>
              <div className={styles.includeList}>
                <p className={styles.includeHeading}>Не включено</p>
                {MOCK_NOT_INCLUDED.map((item) => (
                  <div key={item} className={styles.includeItem}>
                    <XIcon weight="bold" size={14} color="var(--c-red)" aria-hidden="true" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Reviews */}
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>
              <span className={styles.panelTitleAccent} aria-hidden="true" />
              Отзывы ({reviews.length})
            </h2>
            <ReviewList reviews={reviews} />
          </div>

          {/* Review form */}
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>
              <span className={styles.panelTitleAccent} aria-hidden="true" />
              Оставить отзыв
            </h2>
            {reviewStatus === 'success' && (
              <div className={`${styles.feedback} ${styles.feedbackSuccess}`}>Спасибо. Отзыв отправлен на модерацию.</div>
            )}
            {reviewStatus === 'error' && reviewMessage && (
              <div className={`${styles.feedback} ${styles.feedbackError}`}>{reviewMessage}</div>
            )}
            <ReviewForm packageId={pkg.id} redirectTo={`/packages/${pkg.slug}`} />
          </div>
        </div>

        {/* Empty sidebar placeholder on desktop */}
        <div />
      </div>

      {/* Similar packages */}
      {similarPackages.length > 0 && (
        <section className={styles.similarSection}>
          <h2 className={styles.similarTitle}>
            <span className="accent-bar accent-bar-red" aria-hidden="true" />
            Похожие туры
          </h2>
          <div className="grid-3">
            {similarPackages.map((item) => (
              <PackageCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
