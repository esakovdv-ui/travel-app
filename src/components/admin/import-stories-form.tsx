'use client';

import { useActionState } from 'react';
import { importStoriesAction, type ImportStoriesState } from '@/app/actions';
import styles from '../../app/admin/admin.module.css';

export function ImportStoriesForm() {
  const [state, formAction, isPending] = useActionState<ImportStoriesState, FormData>(
    importStoriesAction,
    null
  );

  return (
    <form action={formAction} className={styles.formPanel} style={{ maxWidth: 560 }}>
      <h2 className={styles.formPanelTitle}>Загрузить файл опроса</h2>

      <div className="field">
        <label className="field-label" htmlFor="file">
          Файл опроса (Excel, .xlsx)
        </label>
        <input id="file" name="file" type="file" accept=".xlsx" required className="input" />
        <p className={styles.subtleText} style={{ marginTop: 8 }}>
          Импортируются только строки с согласием на публикацию («Да») и заполненным
          текстом отзыва. Они появятся в общем списке историй со статусом «На модерации» —
          заголовок, тег и фото нужно будет добавить вручную перед публикацией. Повторная
          загрузка того же файла не создаёт дубликаты.
        </p>
      </div>

      <button type="submit" disabled={isPending} className="btn btn-red" style={{ marginTop: 16 }}>
        {isPending ? 'Загружаем…' : 'Загрузить и импортировать'}
      </button>

      {state && !state.success && (
        <div className={`${styles.notice} ${styles.noticeError}`} style={{ marginTop: 20 }}>
          {state.error}
        </div>
      )}

      {state?.success && (
        <div className={`${styles.notice} ${styles.noticeSuccess}`} style={{ marginTop: 20 }}>
          <strong>Импорт завершён.</strong> Новых историй добавлено на модерацию: {state.stats.imported}.
          <ul style={{ marginTop: 10, paddingLeft: 18, fontSize: '0.8rem', color: 'var(--c-text-muted)' }}>
            <li>Всего строк в файле: {state.stats.totalRows}</li>
            <li>Подходящих (согласие + отзыв): {state.stats.qualified}</li>
            <li>Уже были импортированы ранее: {state.stats.duplicates}</li>
            <li>Пропущено без согласия на публикацию: {state.stats.skippedNoConsent}</li>
            <li>Пропущено без текста отзыва: {state.stats.skippedEmptyText}</li>
            <li>Пропущено из-за неполных данных: {state.stats.skippedMissingFields}</li>
          </ul>
        </div>
      )}
    </form>
  );
}
