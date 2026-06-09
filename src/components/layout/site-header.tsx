'use client';

import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BrandLogo } from './brand-logo';
import {
  MagnifyingGlassIcon, ListIcon, XIcon,
  BuildingsIcon, AirplaneTakeoffIcon,
} from '@/components/icons';
import { SearchBar, SearchBarValues, SearchBarSnapshot, SearchTab } from '@/components/ui/search-bar';
import { UserMenu, UserMenuUser } from './user-menu';
import styles from './site-header.module.css';

const NAV_LINKS = [
  { href: '/tours',  label: 'Направления' },
  { href: '/tours',  label: 'Путешествия' },
  { href: '/tours',  label: 'Активный отдых' },
  { href: '/about',                  label: 'О сервисе' },
];

const SEARCH_PILLS = ['Популярно: Япония', 'На майские', 'С детьми', 'До 7 дней'];

const HEADER_TABS = [
  { id: 'stays'       as SearchTab, label: 'Отели', hint: 'Без перелёта',        icon: <BuildingsIcon weight="light" size={16} /> },
  { id: 'experiences' as SearchTab, label: 'Туры',  hint: 'Проживание + перелёт', icon: <AirplaneTakeoffIcon weight="light" size={16} /> },
];

// Читает URL-параметры и инициализирует SearchBar с ними (для страниц /tours и /hotels)
function SearchBarFromURL({
  tab, onTabChange, onSearch, onValuesChange,
}: {
  tab: SearchTab;
  onTabChange: (t: SearchTab) => void;
  onSearch: (v: SearchBarValues) => void;
  onValuesChange: (s: SearchBarSnapshot) => void;
}) {
  const searchParams = useSearchParams();
  const initialValues = {
    toCountry:     searchParams.get('toCountry')     ?? undefined,
    toCity:        searchParams.get('toCity')        ?? undefined,
    startDateFrom: searchParams.get('startDateFrom') ?? undefined,
    startDateTill: searchParams.get('startDateTill') ?? undefined,
    endDateFrom:   searchParams.get('endDateFrom')   ?? undefined,
    endDateTill:   searchParams.get('endDateTill')   ?? undefined,
    adults:        Number(searchParams.get('adults') ?? 2),
    kids:          Number(searchParams.get('kids')   ?? 0),
    fromCity:      searchParams.get('fromCity')      ?? 'Moscow',
  };
  return (
    <SearchBar
      key={searchParams.toString()}
      tab={tab}
      onTabChange={onTabChange}
      onSearch={onSearch}
      onValuesChange={onValuesChange}
      initialValues={initialValues}
    />
  );
}

export function SiteHeader({ initialUser }: { initialUser?: UserMenuUser | null }) {
  const pathname = usePathname();
  const router   = useRouter();
  const isHome     = pathname === '/';
  const isTours    = pathname === '/tours';
  const isHotels   = pathname === '/hotels';
  const isSearchPage = isTours || isHotels;

  const [isMenuOpen,   setIsMenuOpen]   = useState(false);
  const [scrolled,     setScrolled]     = useState(false);
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [headerHeight, setHeaderHeight] = useState(72);
  const [activeTab,    setActiveTab]    = useState<SearchTab>('stays');

  const [pillSnap, setPillSnap] = useState<SearchBarSnapshot>({
    destinationLabel: '',
    whenLabel: '',
    guestsLabel: '',
  });

  const searchRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  // Sync tab with current route
  useEffect(() => {
    if (isTours)  setActiveTab('experiences');
    else if (isHotels) setActiveTab('stays');
  }, [isTours, isHotels]);

  useEffect(() => { setIsMenuOpen(false); }, [pathname]);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeaderHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scrolledRef = useRef(false);

  useEffect(() => {
    if (!isHome) return;

    // Use IntersectionObserver instead of scroll events — immune to iOS Chrome
    // viewport flicker when the address bar collapses/expands during scroll.
    const sentinel = document.createElement('div');
    sentinel.style.cssText = 'position:absolute;top:80px;height:1px;width:1px;pointer-events:none;';
    document.body.prepend(sentinel);

    const observer = new IntersectionObserver(([entry]) => {
      const visible = entry.isIntersecting;
      if (!visible && !scrolledRef.current) {
        scrolledRef.current = true;
        setScrolled(true);
      } else if (visible && scrolledRef.current) {
        scrolledRef.current = false;
        setScrolled(false);
        setSearchOpen(false);
      }
    }, { threshold: 0 });

    observer.observe(sentinel);
    return () => { observer.disconnect(); sentinel.remove(); };
  }, [isHome]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        if (searchOpen) setSearchOpen(false);
      }
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [searchOpen]);

  function handleSearch(v: SearchBarValues) {
    const params = new URLSearchParams({
      toCountry:     v.toCountry,
      startDateFrom: v.startDateFrom,
      startDateTill: v.startDateTill,
      endDateFrom:   v.endDateFrom,
      endDateTill:   v.endDateTill,
      adults:        String(v.adults),
      fromCity:      v.fromCity,
      ...(v.toCity  && { toCity: v.toCity }),
      ...(v.kids > 0 && { kids: String(v.kids), kidsAges: v.kidsAges.join(',') }),
    });
    const route = v.tab === 'experiences' ? '/tours' : '/hotels';
    router.push(`${route}?${params}`);
    setSearchOpen(false);
  }

  const showFullSearch  = (isHome && (!scrolled || searchOpen)) || isSearchPage;
  const showCompactPill = isHome && scrolled && !searchOpen;
  const showTabsInRow   = showFullSearch;
  const showNav         = !isHome && !isSearchPage;

  return (
    <>
      {searchOpen && <div className={styles.backdrop} onClick={() => setSearchOpen(false)} />}

      <header ref={headerRef} className={`${styles.header} ${showFullSearch ? styles.headerExpanded : ''}`}>
        <div className={`shell ${styles.inner}`}>
          <Link className={styles.brand} href="/">
            <BrandLogo className={styles.logo} />
          </Link>

          {/* Tabs (Отели / Туры) — visible when search is expanded */}
          {showTabsInRow && (
            <div className={styles.headerTabs} role="tablist">
              {HEADER_TABS.map(t => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === t.id}
                  className={`${styles.headerTab} ${activeTab === t.id ? styles.headerTabActive : ''}`}
                  onClick={() => setActiveTab(t.id)}
                >
                  <span className={styles.headerTabIcon}>{t.icon}</span>
                  <span className={styles.headerTabText}>
                    <span className={styles.headerTabLabel}>{t.label}</span>
                    <span className={styles.headerTabHint}>{t.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Nav — прочие страницы */}
          {showNav && (
            <nav className={styles.nav} aria-label="Основная навигация">
              {NAV_LINKS.map(link => (
                <Link key={link.label} className={styles.navLink} href={link.href}>{link.label}</Link>
              ))}
            </nav>
          )}

          {/* Compact pill — главная, проскроллено */}
          {showCompactPill && (
            <button className={styles.compactPill} type="button"
              onClick={() => setSearchOpen(true)} aria-label="Открыть поиск">
              <span className={styles.compactPillSeg}>
                {pillSnap.destinationLabel || 'Куда'}
              </span>
              <span className={`${styles.compactPillDiv} ${styles.compactPillHideOnMobile}`} aria-hidden="true" />
              <span className={`${styles.compactPillSeg} ${styles.compactPillHideOnMobile}`}>
                {pillSnap.whenLabel || 'Любые даты'}
              </span>
              <span className={`${styles.compactPillDiv} ${styles.compactPillHideOnMobile}`} aria-hidden="true" />
              <span className={`${styles.compactPillSeg} ${styles.compactPillMuted} ${styles.compactPillHideOnMobile}`}>
                {pillSnap.guestsLabel || 'Гости'}
              </span>
              <span className={styles.compactPillBtn} aria-hidden="true">
                <MagnifyingGlassIcon weight="bold" size={13} />
              </span>
            </button>
          )}

          <div className={styles.actions}>
            {showNav && (
              <Link className={styles.searchAction} href="/tours" aria-label="Поиск">
                <MagnifyingGlassIcon weight="light" size={18} />
              </Link>
            )}
            <UserMenu initialUser={initialUser} />
          </div>

          <button className={styles.menuToggle}
            aria-label={isMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={isMenuOpen} aria-controls="mobile-nav"
            type="button" onClick={() => setIsMenuOpen(v => !v)}>
            {isMenuOpen ? <XIcon weight="light" size={22} /> : <ListIcon weight="light" size={22} />}
          </button>
        </div>

        {/* Full search */}
        {(showFullSearch || isSearchPage) && (
          <div className={`shell ${styles.searchRow} ${!showFullSearch ? styles.searchRowHidden : ''}`} ref={isHome ? searchRef : null}>
            {isSearchPage ? (
              <Suspense fallback={
                <SearchBar
                  tab={activeTab}
                  onTabChange={setActiveTab}
                  onSearch={handleSearch}
                  onValuesChange={setPillSnap}
                />
              }>
                <SearchBarFromURL
                  tab={activeTab}
                  onTabChange={setActiveTab}
                  onSearch={handleSearch}
                  onValuesChange={setPillSnap}
                />
              </Suspense>
            ) : (
              <>
                <SearchBar
                  tab={activeTab}
                  onTabChange={setActiveTab}
                  onSearch={handleSearch}
                  onValuesChange={setPillSnap}
                />
                {isHome && (
                  <div className={styles.searchPills}>
                    {SEARCH_PILLS.map(p => <span key={p} className={styles.searchPill}>{p}</span>)}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className={styles.mobileMenuWrap}>
            <div className={`shell ${styles.mobileMenu}`} id="mobile-nav">
              <nav className={styles.mobileNav} aria-label="Мобильная навигация">
                {NAV_LINKS.map(link => (
                  <Link key={link.label} className={styles.mobileNavLink} href={link.href}>{link.label}</Link>
                ))}
              </nav>
              <div className={styles.mobileActions}>
                <Link className={styles.mobileAction} href="/tours">Поиск</Link>
                <Link className={styles.mobileAction} href="/account">Профиль</Link>
              </div>
            </div>
          </div>
        )}
      </header>
      <div style={{ height: headerHeight }} aria-hidden="true" />
    </>
  );
}
