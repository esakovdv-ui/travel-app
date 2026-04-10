import { upsertPackageAction } from '@/app/actions';
import styles from './package-admin-form.module.css';

export function PackageAdminForm() {
  return (
    <form action={upsertPackageAction} className={styles.form}>
      <p className={styles.section}>Основное</p>

      <div className={styles.row}>
        <div className="field">
          <label className="field-label" htmlFor="af-title">Название тура</label>
          <input id="af-title" className="input" name="title" placeholder="Бали: Роскошный побег" required />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="af-slug">Slug (URL)</label>
          <input id="af-slug" className="input" name="slug" placeholder="bali-luxe-escape" required />
        </div>
      </div>

      <div className={styles.row}>
        <div className="field">
          <label className="field-label" htmlFor="af-dest">Направление</label>
          <input id="af-dest" className="input" name="destination" placeholder="Убуд" required />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="af-country">Страна</label>
          <input id="af-country" className="input" name="country" placeholder="Индонезия" required />
        </div>
      </div>

      <p className={styles.section}>Детали</p>

      <div className={styles.row}>
        <div className="field">
          <label className="field-label" htmlFor="af-price">Цена от ($)</label>
          <input id="af-price" className="input" min="100" name="priceFrom" placeholder="1890" required type="number" />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="af-days">Дней</label>
          <input id="af-days" className="input" min="1" name="durationDays" placeholder="7" required type="number" />
        </div>
      </div>

      <div className={styles.row}>
        <div className="field">
          <label className="field-label" htmlFor="af-seats">Мест осталось</label>
          <input id="af-seats" className="input" min="0" name="seatsLeft" placeholder="10" required type="number" />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="af-tags">Теги (через запятую)</label>
          <input id="af-tags" className="input" name="tags" placeholder="warm, beach, couples" required />
        </div>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="af-hero">URL изображения</label>
        <input id="af-hero" className="input" name="heroImage" placeholder="https://images.unsplash.com/..." required type="url" />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="af-summary">Краткое описание</label>
        <input id="af-summary" className="input" name="summary" placeholder="Частные виллы и велнес-ритуалы..." required />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="af-desc">Полное описание</label>
        <textarea id="af-desc" className="textarea" name="description" placeholder="Подробное описание маршрута..." required rows={5} />
      </div>

      <label className={styles.checkRow}>
        <input name="isFeatured" type="checkbox" value="true" />
        Показать на главной странице
      </label>

      <button className="btn btn-primary btn-block" type="submit">
        Сохранить тур
      </button>
    </form>
  );
}
