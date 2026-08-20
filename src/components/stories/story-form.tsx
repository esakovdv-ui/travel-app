'use client';

import { useActionState, useRef, useState } from 'react';
import { submitStoryAction, type StoryFormState } from '@/app/actions';
import { LEGAL_DOCS } from '@/lib/constants';
import styles from './story-form.module.css';

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

// Поездку описывают недавнюю: текущий год и два предыдущих
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

/** Приводит ввод к виду +7 (999) 123-45-67, оставляя только цифры */
function formatPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('8')) digits = '7' + digits.slice(1);
  if (!digits.startsWith('7')) digits = '7' + digits;
  digits = digits.slice(0, 11);

  const [, a = '', b = '', c = '', d = ''] =
    /^7(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})$/.exec(digits) ?? [];

  let out = '+7';
  if (a) out += ` (${a}`;
  if (a.length === 3) out += ')';
  if (b) out += ` ${b}`;
  if (c) out += `-${c}`;
  if (d) out += `-${d}`;
  return out;
}

export function StoryForm() {
  const [state, formAction, isPending] = useActionState<StoryFormState, FormData>(
    submitStoryAction,
    null
  );
  const [previews, setPreviews] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [phone, setPhone] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const urls = Array.from(files).map((f) => URL.createObjectURL(f));
    setPreviews((prev) => [...prev, ...urls].slice(0, 5));
  }

  function assignFilesToInput(dropped: FileList) {
    const dt = new DataTransfer();
    const existing = fileInputRef.current?.files;
    if (existing) Array.from(existing).forEach((f) => dt.items.add(f));
    Array.from(dropped).forEach((f) => dt.items.add(f));
    if (fileInputRef.current) fileInputRef.current.files = dt.files;
  }

  if (state?.success) {
    return (
      <section id="form" className={styles.section}>
        <div className="shell">
          <div className={styles.success}>
            <span className={styles.successIcon}>✓</span>
            <h2 className={styles.successTitle}>История отправлена!</h2>
            <p className={styles.successText}>
              Спасибо! Мы прочитаем вашу историю и опубликуем её в ближайшее время.
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
              <label className={styles.label} htmlFor="phone">
                Телефон <span className={styles.req}>*</span>
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className={`input ${styles.input}`}
                placeholder="+7 (999) 123-45-67"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                required
              />
              <span className={styles.hint}>Позвоним подтвердить публикацию</span>
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

            {/* Раньше было свободное поле — в карточках получалась каша
                из «Июль 2025 · 12 дней», «июль 2026» и «07.2026».
                Селекты дают единый формат «Июль 2025». */}
            <div className="field">
              <label className={styles.label} htmlFor="periodMonth">
                Период поездки
                <span className={styles.optional}> — необязательно</span>
              </label>
              <div className={styles.periodRow}>
                <select id="periodMonth" name="periodMonth" className={`input ${styles.input}`} defaultValue="">
                  <option value="">Месяц</option>
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <select id="periodYear" name="periodYear" className={`input ${styles.input}`} defaultValue="">
                  <option value="">Год</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
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
                  assignFilesToInput(e.dataTransfer.files);
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
            {/* Согласия — явными чекбоксами, а не строкой «нажимая кнопку».
                Обработку ПД требуем, рассылка остаётся на выбор. */}
            <label className={styles.consentRow}>
              <input
                type="checkbox"
                name="consentPersonal"
                className={styles.consentCheckbox}
                required
              />
              <span className={styles.consentText}>
                Даю{' '}
                <a href={LEGAL_DOCS.personalData.url} target="_blank" rel="noopener noreferrer" className={styles.consentLink}>
                  согласие на обработку персональных данных
                </a>{' '}
                и принимаю{' '}
                <a href={LEGAL_DOCS.privacy.url} target="_blank" rel="noopener noreferrer" className={styles.consentLink}>
                  политику конфиденциальности
                </a>
                <span className={styles.req}> *</span>
              </span>
            </label>

            <label className={styles.consentRow}>
              <input
                type="checkbox"
                name="consentMailing"
                className={styles.consentCheckbox}
              />
              <span className={styles.consentText}>
                Хочу получать новости и спецпредложения —{' '}
                <a href={LEGAL_DOCS.mailing.url} target="_blank" rel="noopener noreferrer" className={styles.consentLink}>
                  согласие на рассылку
                </a>
              </span>
            </label>

            <button
              type="submit"
              disabled={isPending}
              className={`btn btn-red btn-block ${styles.submitBtn}`}
            >
              {isPending ? 'Отправляем…' : 'Рассказать свою историю →'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
