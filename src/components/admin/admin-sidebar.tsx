'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SquaresFourIcon, SuitcaseIcon, ChatCircleIcon, ArrowSquareOutIcon, ListIcon, TagIcon } from '@/components/icons';
import styles from './admin-sidebar.module.css';

const NAV_ITEMS = [
  { label: 'Обзор',         href: '/admin',                  icon: <SquaresFourIcon weight="light" size={18} /> },
  { label: 'Туры',          href: '/admin/packages',          icon: <SuitcaseIcon    weight="light" size={18} /> },
  { label: 'Отзывы',        href: '/admin/reviews',           icon: <ChatCircleIcon  weight="light" size={18} /> },
  { label: 'Теги поиска',   href: '/admin/search-tags',       icon: <TagIcon         weight="light" size={18} /> },
  { label: 'Подборки',      href: '/admin/thematic-rows',     icon: <ListIcon        weight="light" size={18} /> },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <span className={styles.logoMark} aria-hidden="true">
          <span className={styles.sqWhite} />
          <span className={styles.sqRed} />
        </span>
        <span className={styles.logoLabel}>Admin</span>
      </div>

      <p className={styles.sectionLabel}>Управление</p>

      <nav className={styles.nav} aria-label="Навигация администратора">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.link} ${isActive ? styles.linkActive : ''}`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className={styles.divider} />

      <div className={styles.bottom}>
        <Link className={styles.link} href="/">
          <ArrowSquareOutIcon weight="light" size={18} />
          На сайт
        </Link>
      </div>
    </aside>
  );
}
