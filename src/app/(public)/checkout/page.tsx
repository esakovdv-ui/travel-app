import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPackageBySlug } from '@/lib/repositories';
import { formatCurrency } from '@/lib/utils';
import { buildMetadata } from '@/lib/seo';
import { createBookingAction } from '@/app/actions';
import { CreditCardIcon, MonitorIcon, PhoneIcon, ShieldCheckIcon } from '@/components/icons';
import styles from './checkout.module.css';

export const metadata = buildMetadata({
  title: 'Оформление бронирования',
  description: 'Заполните данные для бронирования выбранного тура.'
});

export default async function CheckoutPage({
  searchParams
}: {
  searchParams: Promise<{ slug?: string; travelers?: string; status?: string; booking?: string }>;
}) {
  const { slug, travelers = '1', status, booking } = await searchParams;

  if (!slug) notFound();

  const pkg = await getPackageBySlug(slug);
  if (!pkg) notFound();

  const travelersCount = Math.max(1, parseInt(travelers, 10) || 1);
  const totalPrice = pkg.priceFrom * travelersCount;

  return (
    <main className={`shell ${styles.page}`}>
      <div className={styles.header}>
        <nav className={styles.breadcrumb} aria-label="Навигация">
          <Link href="/">Главная</Link> / <Link href="/packages">Туры</Link> / <Link href={`/packages/${pkg.slug}`}>{pkg.title}</Link> / Бронирование
        </nav>
        <h1 className={styles.title}>Оформление бронирования</h1>
        <p className={styles.subtitle}>Заполните данные — мы свяжемся с вами для подтверждения в течение 24 часов</p>
      </div>

      <div className={styles.layout}>
        {/* Left: forms */}
        <div>
          {/* Traveler info */}
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>
              <span className={styles.panelTitleBar} aria-hidden="true" />
              Данные путешественника
            </h2>
            {status === 'success' && (
              <div className={`${styles.notice} ${styles.noticeSuccess}`}>
                Заявка отправлена. Мы свяжемся с вами в течение 24 часов.
              </div>
            )}
            {status === 'error' && booking && (
              <div className={`${styles.notice} ${styles.noticeError}`}>{booking}</div>
            )}
            <form action={createBookingAction} className={styles.form} id="checkout-form">
              <input name="packageId" type="hidden" value={pkg.id} />
              <input name="travelersCount" type="hidden" value={travelersCount} />
              <input name="redirectTo" type="hidden" value={`/checkout?slug=${pkg.slug}&travelers=${travelersCount}`} />

              <div className={styles.formRow}>
                <div className="field">
                  <label className="field-label" htmlFor="co-name">Полное имя</label>
                  <input id="co-name" className="input" name="customerName" placeholder="Иван Иванов" required autoComplete="name" />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="co-email">Email</label>
                  <input id="co-email" className="input" name="customerEmail" placeholder="ivan@example.com" required type="email" autoComplete="email" />
                </div>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="co-date">Дата поездки</label>
                <input id="co-date" className="input" name="travelDate" required type="date" />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="co-notes">Особые пожелания</label>
                <textarea id="co-notes" className="textarea" name="notes" placeholder="Диетические предпочтения, особые требования..." rows={3} />
              </div>
            </form>
          </div>

          {/* Payment preview */}
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>
              <span className={styles.panelTitleBar} aria-hidden="true" />
              Способ оплаты
            </h2>
            <div className={styles.paymentMethods}>
              <div className={`${styles.paymentMethod} ${styles.paymentMethodActive}`}><CreditCardIcon weight="regular" size={16} /> Карта</div>
              <div className={styles.paymentMethod}><MonitorIcon weight="regular" size={16} /> Перевод</div>
              <div className={styles.paymentMethod}><PhoneIcon weight="regular" size={16} /> СБП</div>
            </div>

            <div className={styles.form}>
              <div className="field">
                <label className="field-label" htmlFor="co-card">Номер карты</label>
                <input id="co-card" className="input" placeholder="•••• •••• •••• ••••" type="text" readOnly />
              </div>
              <div className={styles.formRow}>
                <div className="field">
                  <label className="field-label" htmlFor="co-exp">Срок действия</label>
                  <input id="co-exp" className="input" placeholder="ММ/ГГ" type="text" readOnly />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="co-cvv">CVV</label>
                  <input id="co-cvv" className="input" placeholder="•••" type="text" readOnly />
                </div>
              </div>
            </div>
            <p className={styles.paymentHint}>Способ оплаты подтверждается менеджером после проверки доступности тура.</p>
          </div>

          <button className="btn btn-primary btn-block btn-lg" type="submit" form="checkout-form">
            Подтвердить бронирование
          </button>
        </div>

        {/* Right: summary */}
        <div className={styles.summary}>
          <img alt={pkg.title} className={styles.summaryImg} src={pkg.heroImage} />
          <div className={styles.summaryBody}>
            <p className={styles.summaryDest}>{pkg.destination}, {pkg.country}</p>
            <h3 className={styles.summaryTitle}>{pkg.title}</h3>

            <div className={styles.summaryMeta}>
              <div className={styles.summaryMetaRow}>
                <span>Продолжительность</span>
                <span className={styles.summaryMetaVal}>{pkg.durationDays} дней</span>
              </div>
              <div className={styles.summaryMetaRow}>
                <span>Путешественников</span>
                <span className={styles.summaryMetaVal}>{travelersCount} чел.</span>
              </div>
              <div className={styles.summaryMetaRow}>
                <span>Цена за человека</span>
                <span className={styles.summaryMetaVal}>{formatCurrency(pkg.priceFrom)}</span>
              </div>
            </div>

            <div className={styles.summaryTotal}>
              <span className={styles.summaryTotalLabel}>Итого</span>
              <span className={styles.summaryTotalPrice}>{formatCurrency(totalPrice)}</span>
            </div>

            <button className="btn btn-primary btn-block" type="submit" form="checkout-form">
              Забронировать
            </button>

            <p className={styles.trustNote}>
              <ShieldCheckIcon weight="regular" size={14} /> Безопасная оплата · Отмена без штрафа за 48 ч
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
