import Link from 'next/link';
import { buildMetadata } from '@/lib/seo';
import { loginAction } from '@/app/actions';
import { BrandLogo } from '@/components/layout/brand-logo';
import styles from '../auth.module.css';

export const metadata = buildMetadata({
  title: 'Войти',
  description: 'Войдите в аккаунт для управления бронированиями и сохранёнными турами.'
});

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.cardLogo}>
          <BrandLogo className={styles.logo} compact />
        </div>
        <div className={styles.dividerTop} />

        <h1 className={styles.formTitle}>Войдите или зарегистрируйтесь</h1>
        <p className={styles.formSub}>Введите email и пароль для входа в аккаунт</p>

        {error && <p className={styles.formError}>{error}</p>}

        <form action={loginAction} className={styles.form}>
          <div className="field">
            <label className="field-label" htmlFor="login-email">Email</label>
            <input id="login-email" className="input" name="email" placeholder="ivan@example.com" required type="email" autoComplete="email" />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="login-pass">Пароль</label>
            <input id="login-pass" className="input" name="password" placeholder="••••••••" required type="password" autoComplete="current-password" />
          </div>
          <button className="btn btn-primary btn-block btn-lg" type="submit">
            Войти в аккаунт
          </button>
        </form>

        <p className={styles.switchLink}>
          Нет аккаунта? <Link href="/auth/register">Создать аккаунт</Link>
        </p>
      </div>
    </div>
  );
}
