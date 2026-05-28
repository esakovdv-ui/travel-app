'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import styles from '../raduga-admin/raduga-admin.module.css';

type VlasevoShift = {
  id: string;
  title: string;
  dates: string;
  duration: string;
  oldPrice: number;
  price: number;
  image: string;
  url: string;
  promoAccentText: string;
};

const DEFAULT_PROMO_ACCENT_TEXT = 'Летние смены по специальной цене';

const blankShift: VlasevoShift = {
  id: '',
  title: '',
  dates: '',
  duration: '',
  oldPrice: 0,
  price: 0,
  image: '/raduga-hero.png',
  url: '',
  promoAccentText: DEFAULT_PROMO_ACCENT_TEXT,
};

function makeId() {
  return `shift-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeShift(shift: VlasevoShift): VlasevoShift {
  return {
    ...shift,
    id: shift.id || makeId(),
    oldPrice: Number(shift.oldPrice) || 0,
    price: Number(shift.price) || 0,
    promoAccentText: shift.promoAccentText?.trim() || DEFAULT_PROMO_ACCENT_TEXT,
  };
}

export function VlasevoAdminClient() {
  const [password, setPassword] = useState('');
  const [isAuthed, setIsAuthed] = useState(false);
  const [shifts, setShifts] = useState<VlasevoShift[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const canSave = useMemo(() => shifts.every((shift) => (
    shift.title.trim()
    && shift.dates.trim()
    && shift.duration.trim()
    && shift.image.trim()
    && shift.url.trim()
    && Number(shift.oldPrice) >= 0
    && Number(shift.price) >= 0
  )), [shifts]);

  useEffect(() => {
    const saved = window.sessionStorage.getItem('vlasevo-admin-password');
    if (saved) {
      setPassword(saved);
      setIsAuthed(true);
    }
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    let ignore = false;

    async function loadShifts() {
      setIsLoading(true);
      setError('');
      try {
        const response = await fetch('/api/vlasevo-shifts', { cache: 'no-store' });
        if (!response.ok) throw new Error('Не удалось загрузить смены');
        const data = await response.json();
        if (!ignore) {
          setShifts(data.map((shift: Partial<VlasevoShift>) => ({
            ...blankShift,
            ...shift,
            promoAccentText: shift.promoAccentText || DEFAULT_PROMO_ACCENT_TEXT,
          })));
        }
      } catch (loadError) {
        if (!ignore) setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить смены');
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadShifts();
    return () => {
      ignore = true;
    };
  }, [isAuthed]);

  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (password !== 'vlasevo2026') {
      setError('Неверный пароль.');
      return;
    }

    window.sessionStorage.setItem('vlasevo-admin-password', password);
    setIsAuthed(true);
  }

  function logout() {
    window.sessionStorage.removeItem('vlasevo-admin-password');
    setIsAuthed(false);
    setPassword('');
    setShifts([]);
  }

  function updateShift(index: number, patch: Partial<VlasevoShift>) {
    setShifts((current) => current.map((shift, shiftIndex) => (
      shiftIndex === index ? { ...shift, ...patch } : shift
    )));
  }

  function addShift() {
    setShifts((current) => [...current, { ...blankShift, id: makeId() }]);
  }

  function removeShift(index: number) {
    setShifts((current) => current.filter((_, shiftIndex) => shiftIndex !== index));
  }

  async function uploadImage(index: number, file: File | null) {
    if (!file) return;

    setUploadingIndex(index);
    setStatus('');
    setError('');

    try {
      const formData = new FormData();
      formData.append('password', password);
      formData.append('shiftId', shifts[index]?.id || makeId());
      formData.append('file', file);

      const response = await fetch('/api/vlasevo-shift-images', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось загрузить изображение');

      updateShift(index, { image: data.url });
      setStatus('Изображение загружено. Не забудьте сохранить смены.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Не удалось загрузить изображение');
    } finally {
      setUploadingIndex(null);
    }
  }

  async function save() {
    setIsSaving(true);
    setStatus('');
    setError('');

    try {
      const response = await fetch('/api/vlasevo-shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, shifts: shifts.map(normalizeShift) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось сохранить смены');
      setShifts(data.shifts);
      setStatus('Смены сохранены. Лендинг обновится при следующей загрузке страницы.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить смены');
    } finally {
      setIsSaving(false);
    }
  }

  if (!isAuthed) {
    return (
      <main className={styles.page}>
        <div className={styles.loginWrap}>
          <form className={styles.loginCard} onSubmit={login}>
            <h1>Власьево</h1>
            <p className={styles.subtitle}>Введите пароль, чтобы открыть редактор смен.</p>
            <div className={styles.field}>
              <label htmlFor="password">Пароль</label>
              <input
                className={styles.input}
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className={styles.actions} style={{ marginTop: 16 }}>
              <button className={styles.button} type="submit">Войти</button>
            </div>
            {error && <p className={`${styles.status} ${styles.error}`}>{error}</p>}
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <div>
            <h1 className={styles.title}>Смены лагеря «Власьево»</h1>
            <p className={styles.subtitle}>Редактируйте карточки смен, длительность, цены, изображения и ссылки на бронирование.</p>
          </div>
          <div className={styles.actions}>
            <button className={styles.secondaryButton} type="button" onClick={addShift}>Добавить смену</button>
            <button className={styles.button} type="button" onClick={save} disabled={isSaving || isLoading || !canSave}>
              {isSaving ? 'Сохраняю...' : 'Сохранить'}
            </button>
            <button className={styles.dangerButton} type="button" onClick={logout}>Выйти</button>
          </div>
        </div>

        <div className={styles.panel}>
          {isLoading ? (
            <p className={styles.subtitle}>Загружаю смены...</p>
          ) : (
            <div className={styles.shiftList}>
              {shifts.map((shift, index) => (
                <article className={styles.shiftCard} key={shift.id || index}>
                  <div className={styles.shiftHeader}>
                    <strong>{shift.title || `Новая смена ${index + 1}`}</strong>
                    <button className={styles.dangerButton} type="button" onClick={() => removeShift(index)}>Удалить</button>
                  </div>
                  <div className={styles.grid}>
                    <div className={styles.field}>
                      <label>Название</label>
                      <input className={styles.input} value={shift.title} onChange={(event) => updateShift(index, { title: event.target.value })} />
                    </div>
                    <div className={styles.field}>
                      <label>Даты</label>
                      <input className={styles.input} value={shift.dates} onChange={(event) => updateShift(index, { dates: event.target.value })} />
                    </div>
                    <div className={styles.field}>
                      <label>Длительность</label>
                      <input className={styles.input} value={shift.duration} onChange={(event) => updateShift(index, { duration: event.target.value })} />
                    </div>
                    <div className={styles.field}>
                      <label>Текст плашки</label>
                      <input className={styles.input} value={shift.promoAccentText} onChange={(event) => updateShift(index, { promoAccentText: event.target.value })} />
                    </div>
                    <div className={styles.field}>
                      <label>Старая цена</label>
                      <input className={styles.input} type="number" value={shift.oldPrice} onChange={(event) => updateShift(index, { oldPrice: Number(event.target.value) })} />
                    </div>
                    <div className={styles.field}>
                      <label>Цена по акции</label>
                      <input className={styles.input} type="number" value={shift.price} onChange={(event) => updateShift(index, { price: Number(event.target.value) })} />
                    </div>
                    <div className={`${styles.field} ${styles.wide}`}>
                      <label>Ссылка</label>
                      <textarea className={styles.textarea} value={shift.url} onChange={(event) => updateShift(index, { url: event.target.value })} />
                    </div>
                    <div className={`${styles.field} ${styles.wide}`}>
                      <label>Изображение</label>
                      {shift.image && (
                        <img className={styles.preview} src={shift.image} alt={shift.title || 'Изображение смены'} />
                      )}
                      <input className={styles.input} value={shift.image} onChange={(event) => updateShift(index, { image: event.target.value })} />
                      <input
                        className={styles.fileInput}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => uploadImage(index, event.target.files?.[0] ?? null)}
                        disabled={uploadingIndex === index}
                      />
                      <span className={styles.hint}>
                        {uploadingIndex === index ? 'Загружаю изображение...' : 'Можно вставить ссылку вручную или загрузить JPG, PNG, WebP до 5 МБ.'}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          {status && <p className={styles.status}>{status}</p>}
          {error && <p className={`${styles.status} ${styles.error}`}>{error}</p>}
        </div>
      </div>
    </main>
  );
}
