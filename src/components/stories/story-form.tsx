'use client';

import { useActionState, useRef, useState } from 'react';
import { submitStoryAction, type StoryFormState } from '@/app/actions';
import styles from './story-form.module.css';

export function StoryForm() {
  const [state, formAction, isPending] = useActionState<StoryFormState, FormData>(
    submitStoryAction,
    null
  );
  const [previews, setPreviews] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const urls = Array.from(files).map((f) => URL.createObjectURL(f));
    setPreviews((prev) => [...prev, ...urls].slice(0, 5));
  }

  if (state?.success) {
    return (
      <section id="form" className={styles.section}>
        <div className="shell">
          <div className={styles.success}>
            <span className={styles.successIcon}>✓</span>
            <h2 className={styles.successTitle}>История отправлена!</h2>
            <p className={styles.successText}>
              Спасибо за доверие. Анна Бочкова рассмотрит вашу историю
              и опубликует её в ближайшее время.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="form" className={styles.section}>
      <div className="shell">
        <div className={styles.header}>
          <p className="eyebrow" style={{ marginBottom: 8, color: 'rgba(255,255,255,0.5)' }}>
            Участвуйте в розыгрыше
          </p>
          <h2 className={styles.title}>Расскажите свою историю</h2>
          <p className={styles.subtitle}>
            Заполните форму — мы свяжемся с вами для подтверждения публикации.
          </p>
        </div>

        <form action={formAction} className={styles.formPanel}>
          {state && !state.success && (
            <div className={styles.error}>{state.error}</div>
          )}

          <div className={styles.formGrid}>
            {/* Обязательные поля */}
            <div className="field">
              <label className={styles.label} htmlFor="authorName">
                Как вас подписать <span className={styles.req}>*</span>
              </label>
              <input
                id="authorName"
                name="authorName"
                className={`input ${styles.input}`}
                placeholder="Например: Наталья К."
                required
              />
            </div>

            <div className="field">
              <label className={styles.label} htmlFor="object">
                Объект или тур <span className={styles.req}>*</span>
              </label>
              <input
                id="object"
                name="object"
                className={`input ${styles.input}`}
                placeholder="Отель, город или страна"
                required
              />
            </div>

            <div className={`field ${styles.fullWidth}`}>
              <label className={styles.label} htmlFor="text">
                Ваша история <span className={styles.req}>*</span>
              </label>
              <textarea
                id="text"
                name="text"
                className={`textarea ${styles.textarea}`}
                placeholder="Расскажите, как прошла поездка — куда ездили, что понравилось, что запомнилось…"
                rows={5}
                required
              />
            </div>

            {/* Необязательные поля */}
            <div className="field">
              <label className={styles.label} htmlFor="manager">
                Кто помог организовать поездку
                <span className={styles.optional}> — необязательно</span>
              </label>
              <input
                id="manager"
                name="manager"
                className={`input ${styles.input}`}
                placeholder="Имя менеджера"
              />
            </div>

            <div className="field">
              <label className={styles.label} htmlFor="period">
                Период поездки
                <span className={styles.optional}> — необязательно</span>
              </label>
              <input
                id="period"
                name="period"
                className={`input ${styles.input}`}
                placeholder="Например: Июль 2025 · 12 дней"
              />
            </div>

            {/* Upload */}
            <div className={`field ${styles.fullWidth}`}>
              <label className={styles.label}>
                Фотографии из поездки
                <span className={styles.optional}> — необязательно, до 5 фото</span>
              </label>
              <div
                className={`${styles.uploadArea} ${dragging ? styles.uploadDragging : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  handleFiles(e.dataTransfer.files);
                }}
              >
                <input
                  ref={fileInputRef}
                  name="photos"
                  type="file"
                  accept="image/*"
                  multiple
                  className={styles.uploadInput}
                  onChange={(e) => handleFiles(e.target.files)}
                />
                {previews.length > 0 ? (
                  <div className={styles.previews}>
                    {previews.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={src} alt="" className={styles.previewThumb} />
                    ))}
                    <span className={styles.uploadHint}>Нажмите, чтобы добавить ещё</span>
                  </div>
                ) : (
                  <>
                    <span className={styles.uploadIcon}>📷</span>
                    <span className={styles.uploadHint}>
                      Перетащите фото сюда или нажмите для выбора
                    </span>
                    <span className={styles.uploadSub}>JPG, PNG, WebP · до 10 МБ каждое</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className={styles.formFooter}>
            <button
              type="submit"
              disabled={isPending}
              className={`btn btn-red btn-block ${styles.submitBtn}`}
            >
              {isPending ? 'Отправляем…' : 'Рассказать свою историю →'}
            </button>
            <p className={styles.consent}>
              Нажимая кнопку, вы соглашаетесь с{' '}
              <a
                href="https://online.mosgortur.ru/documents/new-documents/Форма_согласия_на_обработку_персональных_данных_в_сети_Интернет.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.consentLink}
              >
                условиями публикации
              </a>
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
