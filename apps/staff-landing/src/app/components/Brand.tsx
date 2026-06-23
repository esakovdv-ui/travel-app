import styles from '../page.module.css'

// Общие для / и /tours — вынесены отдельно, т.к. App Router не разрешает
// произвольные named-экспорты из файлов page.tsx (раздел 2.2 ТЗ).

export function BrandLogo() {
  return (
    <div className={styles.brandWrap} aria-label="Мои путешествия">
      <svg
        aria-hidden="true"
        className={styles.brandIcon}
        viewBox="0 0 88 88"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="42" cy="44" r="28" fill="#F5C000" />
        <g transform="rotate(-18,48,50)">
          <polygon points="48,30 66,60 30,60" fill="#FFFFFF" />
        </g>
        <g transform="rotate(-9,44,32)">
          <rect x="2" y="26" width="80" height="12" fill="#1B4FBF" />
        </g>
        <g transform="rotate(16,42,56)">
          <rect x="14" y="51" width="52" height="12" fill="#D42B2B" />
        </g>
      </svg>
      <span className={styles.brandText}>
        <span className={styles.brandTextLine}>Мои</span>
        <span className={styles.brandTextLine}>путешествия</span>
      </span>
    </div>
  )
}

export function MgtBadge() {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src="/mgt_logo.png"
      alt="МОСГОРТУР"
      className={styles.mgtBadgeLogo}
    />
  )
}
