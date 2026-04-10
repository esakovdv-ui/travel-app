import styles from './brand-logo.module.css';

export function BrandLogo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
  inverted?: boolean;
}) {
  return (
    <div className={`${styles.wrap} ${className ?? ''}`}>
      <svg
        aria-hidden="true"
        className={styles.icon}
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

      {!compact && (
        <span className={styles.text} aria-label="Мои путешествия">
          <span className={styles.textLine}>Мои</span>
          <span className={styles.textLine}>путешествия</span>
        </span>
      )}
    </div>
  );
}
