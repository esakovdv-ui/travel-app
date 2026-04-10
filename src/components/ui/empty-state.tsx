import styles from './empty-state.module.css';

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.mark} aria-hidden="true" />
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.desc}>{description}</p>}
      {action}
    </div>
  );
}
