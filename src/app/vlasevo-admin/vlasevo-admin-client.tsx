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
  specialTermsText: string;
};

const DEFAULT_PROMO_ACCENT_TEXT = 'Летние смены по специальной цене';
const DEFAULT_SPECIAL_TERMS_TEXT = 'Спецусловия до 7 июня';
const DEBUG_ENDPOINT = 'http://127.0.0.1:7452/ingest/559fd227-ad27-4091-a3b1-b6f5ed56ddbf';
const DEBUG_SESSION_ID = '6bb749';

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
  specialTermsText: DEFAULT_SPECIAL_TERMS_TEXT,
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
    specialTermsText: shift.specialTermsText?.trim() || DEFAULT_SPECIAL_TERMS_TEXT,
  };
}

function debugLog(payload: {
  runId: string;
  hypothesisId: string;
  location: string;
  message: string;
  data: Record<string, unknown>;
}) {
  fetch(DEBUG_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': DEBUG_SESSION_ID,
    },
    body: JSON.stringify({
      sessionId: DEBUG_SESSION_ID,
      ...payload,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}

type UploadErrorInfo = {
  kind: 'auth' | 'validation' | 'server' | 'network' | 'unknown';
  status?: number;
  details: string;
};

const TARGET_UPLOAD_BYTES = 1 * 1024 * 1024;
const MAX_IMAGE_SIDE = 1920;

function readImageDimensions(file: File) {
  return new Promise<{ width: number; height: number; image: HTMLImageElement }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight, image });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось прочитать изображение.'));
    };
    image.src = url;
  });
}

async function maybeCompressImage(file: File) {
  if (file.size <= TARGET_UPLOAD_BYTES) {
    return { file, compressed: false, originalSize: file.size };
  }

  const { width, height, image } = await readImageDimensions(file);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    return { file, compressed: false, originalSize: file.size };
  }

  const scales = [1, 0.85, 0.7, 0.6, 0.5, 0.4, 0.3];
  const qualities = [0.86, 0.78, 0.7, 0.62, 0.54, 0.46, 0.38];
  let bestFile: File | null = null;

  for (const resizeRatio of scales) {
    const baseScale = Math.min(1, MAX_IMAGE_SIDE / Math.max(width, height));
    const finalScale = baseScale * resizeRatio;
    const targetWidth = Math.max(1, Math.round(width * finalScale));
    const targetHeight = Math.max(1, Math.round(height * finalScale));

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    context.clearRect(0, 0, targetWidth, targetHeight);
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    for (const quality of qualities) {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((result) => resolve(result), 'image/webp', quality);
      });
      if (!blob) continue;

      const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' });
      if (!bestFile || compressed.size < bestFile.size) {
        bestFile = compressed;
      }
      if (compressed.size <= TARGET_UPLOAD_BYTES) {
        return { file: compressed, compressed: true, originalSize: file.size };
      }
    }
  }

  if (bestFile && bestFile.size < file.size) {
    return { file: bestFile, compressed: true, originalSize: file.size };
  }

  return { file, compressed: false, originalSize: file.size };
}

async function parseUploadError(response: Response) {
  let payload: unknown = null;
  let fallbackMessage = `HTTP ${response.status}`;

  try {
    payload = await response.json();
  } catch {
    try {
      const text = await response.text();
      if (text.trim()) fallbackMessage = text.trim();
    } catch {
      // ignore
    }
  }

  const apiMessage = (
    payload
    && typeof payload === 'object'
    && 'error' in payload
    && typeof (payload as { error?: unknown }).error === 'string'
  )
    ? (payload as { error: string }).error
    : fallbackMessage;

  const kind: UploadErrorInfo['kind'] = response.status === 401
    ? 'auth'
    : response.status >= 400 && response.status < 500
      ? 'validation'
      : response.status >= 500
        ? 'server'
        : 'unknown';

  let details = `Тип: ${kind}. Статус: ${response.status}. Причина: ${apiMessage}`;
  if (response.status === 413) {
    details = 'Тип: validation. Статус: 413. Причина: файл слишком большой для сервера. Попробуйте JPG/WebP меньшего размера (рекомендуется до 1 МБ).';
  }

  return { kind, status: response.status, details };
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
            specialTermsText: shift.specialTermsText || DEFAULT_SPECIAL_TERMS_TEXT,
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
    if ('image' in patch) {
      // #region agent log
      debugLog({
        runId: 'pre-fix',
        hypothesisId: 'H2',
        location: 'src/app/vlasevo-admin/vlasevo-admin-client.tsx:updateShift',
        message: 'Applying image patch to local shift state',
        data: { index, nextImage: patch.image ?? null },
      });
      // #endregion
    }
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

  async function persistShifts(nextShifts: VlasevoShift[]) {
    const response = await fetch('/api/vlasevo-shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, shifts: nextShifts.map(normalizeShift) }),
    });
    const data = await response.json();

    // #region agent log
    debugLog({
      runId: 'pre-fix',
      hypothesisId: 'H3',
      location: 'src/app/vlasevo-admin/vlasevo-admin-client.tsx:persistShifts',
      message: 'Persist shifts response received',
      data: { ok: response.ok, status: response.status, error: data?.error ?? null },
    });
    // #endregion

    if (!response.ok) throw new Error(data.error || 'Не удалось сохранить смены');
    return data.shifts as VlasevoShift[];
  }

  async function uploadImage(index: number, file: File | null) {
    if (!file) return;

    setUploadingIndex(index);
    setStatus('');
    setError('');

    try {
      const prepared = await maybeCompressImage(file);
      const uploadFile = prepared.file;
      if (prepared.compressed) {
        const originalMb = (prepared.originalSize / (1024 * 1024)).toFixed(2);
        const uploadedMb = (uploadFile.size / (1024 * 1024)).toFixed(2);
        setStatus(`Изображение автоматически сжато: ${originalMb} МБ -> ${uploadedMb} МБ.`);
      }
      // #region agent log
      debugLog({
        runId: 'pre-fix',
        hypothesisId: 'H1',
        location: 'src/app/vlasevo-admin/vlasevo-admin-client.tsx:uploadImage:beforeFetch',
        message: 'Starting image upload request',
        data: { index, shiftId: shifts[index]?.id || null, fileType: uploadFile.type, fileSize: uploadFile.size },
      });
      // #endregion
      const formData = new FormData();
      formData.append('password', password);
      formData.append('shiftId', shifts[index]?.id || makeId());
      formData.append('file', uploadFile);

      const response = await fetch('/api/vlasevo-shift-images', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const info = await parseUploadError(response);
        throw new Error(info.details);
      }
      const data = await response.json();
      // #region agent log
      debugLog({
        runId: 'pre-fix',
        hypothesisId: 'H1',
        location: 'src/app/vlasevo-admin/vlasevo-admin-client.tsx:uploadImage:afterFetch',
        message: 'Image upload response received',
        data: { ok: response.ok, status: response.status, hasUrl: Boolean(data?.url), error: data?.error ?? null },
      });
      // #endregion
      if (!data?.url || typeof data.url !== 'string') {
        throw new Error('Тип: unknown. Статус: 200. Причина: сервер не вернул URL изображения.');
      }

      const nextShifts = shifts.map((shift, shiftIndex) => (
        shiftIndex === index ? { ...shift, image: data.url } : shift
      ));
      setShifts(nextShifts);
      const persistedShifts = await persistShifts(nextShifts);
      setShifts(persistedShifts);
      setStatus('Изображение загружено и сохранено. Лендинг можно обновить для проверки.');
    } catch (uploadError) {
      const message = uploadError instanceof Error
        ? uploadError.message
        : 'Тип: unknown. Причина: не удалось загрузить изображение.';
      setError(message);
      window.alert(`Ошибка загрузки изображения.\n${message}`);
    } finally {
      setUploadingIndex(null);
    }
  }

  async function save() {
    setIsSaving(true);
    setStatus('');
    setError('');

    try {
      // #region agent log
      debugLog({
        runId: 'pre-fix',
        hypothesisId: 'H3',
        location: 'src/app/vlasevo-admin/vlasevo-admin-client.tsx:save:beforeFetch',
        message: 'Starting shifts save request',
        data: { shiftsCount: shifts.length, sampleImage: shifts[0]?.image ?? null },
      });
      // #endregion
      const persistedShifts = await persistShifts(shifts);
      setShifts(persistedShifts);
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
                      <label>Текст спецусловий</label>
                      <input className={styles.input} value={shift.specialTermsText} onChange={(event) => updateShift(index, { specialTermsText: event.target.value })} />
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
                        {uploadingIndex === index ? 'Загружаю изображение...' : 'Можно загрузить JPG, PNG, WebP любого размера: файл автоматически сожмется перед отправкой.'}
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
