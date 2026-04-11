import Link from 'next/link';
import { buildMetadata } from '@/lib/seo';
import { registerAction } from '@/app/actions';
import { BrandLogo } from '@/components/layout/brand-logo';
import styles from '../auth.module.css';

export const metadata = buildMetadata({
  title: 'Регистрация',
  description: 'Создайте аккаунт для бронирования туров, отзывов и сохранения любимых направлений.'
});

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.cardLogo}>
          <BrandLogo className={styles.logo} compact />
        </div>
        <div className={styles.dividerTop} />

        <h1 className={styles.formTitle}>Создайте аккаунт</h1>
        <p className={styles.formSub}>Заполните форму, чтобы начать путешествовать</p>

        {error && <p className={styles.formError}>{error}</p>}

        <form action={registerAction} className={styles.form}>
          <div className={styles.formRow}>
            <div className="field">
              <label className="field-label" htmlFor="reg-fname">Имя</label>
              <input id="reg-fname" className="input" name="firstName" placeholder="Иван" required autoComplete="given-name" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="reg-lname">Фамилия</label>
              <input id="reg-lname" className="input" name="lastName" placeholder="Иванов" required autoComplete="family-name" />
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="reg-email">Email</label>
            <input id="reg-email" className="input" name="email" placeholder="ivan@example.com" required type="email" autoComplete="email" />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="reg-pass">Пароль</label>
            <input id="reg-pass" className="input" name="password" placeholder="Минимум 8 символов" required type="password" autoComplete="new-password" minLength={8} />
          </div>
          <button className="btn btn-primary btn-block btn-lg" type="submit">
            Создать аккаунт
          </button>
        </form>

        <p className={styles.switchLink}>
          Уже есть аккаунт? <Link href="/auth/login">Войти</Link>
        </p>
      </div>
    </div>
  );
}
