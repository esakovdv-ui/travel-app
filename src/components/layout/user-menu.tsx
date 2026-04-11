'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { UserIcon, SignOutIcon, SlidersIcon, TicketIcon } from '@/components/icons';
import { logoutAction } from '@/app/actions';
import styles from './user-menu.module.css';

export interface UserMenuUser {
  firstName: string;
  lastName: string;
  email: string;
  initials: string;
}

export function UserMenu({ initialUser }: { initialUser?: UserMenuUser | null }) {
  const [user, setUser] = useState<UserMenuUser | null>(initialUser ?? null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Обновляем при смене маршрута (логин/логаут без перезагрузки страницы)
  useEffect(() => {
    fetch('/api/me', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setUser(d.user ?? null));
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Не авторизован
  if (!user) {
    return (
      <Link className={styles.loginBtn} href="/auth/login">
        <UserIcon weight="light" size={18} aria-hidden="true" />
        <span className={styles.loginLabel}>Войти</span>
      </Link>
    );
  }

  // Авторизован
  return (
    <div className={styles.wrap} ref={ref}>
      <button className={styles.avatarBtn} onClick={() => setOpen(v => !v)} type="button" aria-label="Меню профиля">
        <span className={styles.avatar}>{user.initials}</span>
        <span className={styles.name}>{user.firstName}</span>
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <span className={styles.dropdownName}>{user.firstName} {user.lastName}</span>
            <span className={styles.dropdownEmail}>{user.email}</span>
          </div>
          <div className={styles.dropdownDivider} />
          <Link className={styles.dropdownItem} href="/account" onClick={() => setOpen(false)}>
            <TicketIcon weight="regular" size={16} />
            Личный кабинет
          </Link>
          <Link className={styles.dropdownItem} href="/account" onClick={() => setOpen(false)}>
            <SlidersIcon weight="regular" size={16} />
            Настройки
          </Link>
          <div className={styles.dropdownDivider} />
          <form action={logoutAction}>
            <button className={`${styles.dropdownItem} ${styles.dropdownLogout}`} type="submit">
              <SignOutIcon weight="regular" size={16} />
              Выйти
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
