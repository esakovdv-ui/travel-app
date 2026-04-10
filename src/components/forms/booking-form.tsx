import { createBookingAction } from '@/app/actions';
import styles from './booking-form.module.css';

export function BookingForm({ packageId, redirectTo }: { packageId: string; redirectTo?: string }) {
  return (
    <form action={createBookingAction} className={styles.form}>
      <input name="packageId" type="hidden" value={packageId} />
      <input name="redirectTo" type="hidden" value={redirectTo ?? '/packages'} />

      <div className={styles.row}>
        <div className="field">
          <label className="field-label" htmlFor="bf-name">Полное имя</label>
          <input id="bf-name" className="input" name="customerName" placeholder="Иван Иванов" required />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="bf-email">Email</label>
          <input id="bf-email" className="input" name="customerEmail" placeholder="ivan@example.com" required type="email" />
        </div>
      </div>

      <div className={styles.row}>
        <div className="field">
          <label className="field-label" htmlFor="bf-travelers">Путешественников</label>
          <input id="bf-travelers" className="input" max="12" min="1" name="travelersCount" placeholder="1" required type="number" />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="bf-date">Дата поездки</label>
          <input id="bf-date" className="input" name="travelDate" required type="date" />
        </div>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="bf-notes">Пожелания</label>
        <textarea id="bf-notes" className="textarea" name="notes" placeholder="Особые пожелания или вопросы..." rows={3} />
      </div>

      <button className={`btn btn-primary btn-block btn-lg ${styles.submitBtn}`} type="submit">
        Отправить заявку
      </button>
      <p className={styles.note}>Мы свяжемся с вами в течение 24 часов для подтверждения.</p>
    </form>
  );
}
