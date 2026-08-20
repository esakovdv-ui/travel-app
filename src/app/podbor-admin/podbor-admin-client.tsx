'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import styles from '../raduga-admin/raduga-admin.module.css';

type PodborStatus = 'started' | 'in_progress' | 'completed';

type PodborSession = {
  id: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  status: PodborStatus;
  embedded?: boolean;
  utm?: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  };
  referer?: string;
  answers: {
    adults?: number;
    kids?: number;
    kidsAges?: number[];
    budget?: number;
    budgetCustom?: boolean;
    format?: 'tour' | 'hotel' | null;
    region?: string | null;
    checkIn?: string;
    checkOut?: string;
    nights?: number;
    handoffUrl?: string;
  };
};

const STATUS_LABELS: Record<PodborStatus, string> = {
  started: 'Старт',
  in_progress: 'В процессе',
  completed: 'Handoff',
};

const FORMAT_LABELS: Record<string, string> = {
  tour: 'Тур',
  hotel: 'Отель',
};

const REGION_LABELS: Record<string, string> = {
  sea: 'У моря',
  podmos: 'Подмосковье',
  spb: 'Санкт-Петербург',
  kaliningrad: 'Калининград',
  kazan: 'Казань',
  other: 'Другой регион',
  any: 'Пока не знаю',
  karelia: 'Карелия',
  kaluga: 'Калуга',
  altai: 'Алтай',
  yaroslavl: 'Ярославль',
  nnovgorod: 'Нижний Новгород',
  vladimir: 'Владимир',
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRub(value?: number) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}

function countBy<T extends string>(items: T[], labels?: Record<string, string>) {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = item || '__empty__';
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => [labels?.[key] || (key === '__empty__' ? 'Не выбрано' : key), count] as const);
}

function avg(nums: number[]) {
  if (!nums.length) return null;
  return Math.round(nums.reduce((sum, n) => sum + n, 0) / nums.length);
}

export function PodborAdminClient() {
  const [password, setPassword] = useState('');
  const [isAuthed, setIsAuthed] = useState(false);
  const [sessions, setSessions] = useState<PodborSession[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PodborStatus>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const saved = window.sessionStorage.getItem('podbor-admin-password');
    if (saved) {
      setPassword(saved);
      setIsAuthed(true);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    if (!password) return;
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ password, limit: '5000', format: 'json' });
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const response = await fetch(`/api/podbor-responses?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          window.sessionStorage.removeItem('podbor-admin-password');
          setIsAuthed(false);
        }
        throw new Error(data.error || 'Не удалось загрузить ответы');
      }
      const list = Array.isArray(data.sessions) ? data.sessions : [];
      setSessions(list);
      setStatus(`Сессий: ${list.length}`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить ответы');
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, password, statusFilter, toDate]);

  useEffect(() => {
    if (!isAuthed) return;
    loadSessions();
  }, [isAuthed, loadSessions]);

  const stats = useMemo(() => {
    const total = sessions.length;
    const completed = sessions.filter((s) => s.status === 'completed').length;
    const inProgress = sessions.filter((s) => s.status === 'in_progress').length;
    const started = sessions.filter((s) => s.status === 'started').length;
    const embedded = sessions.filter((s) => s.embedded).length;
    const budgets = sessions.map((s) => s.answers.budget).filter((n): n is number => Number.isFinite(n));
    const nights = sessions.map((s) => s.answers.nights).filter((n): n is number => Number.isFinite(n));
    const formats = sessions.map((s) => s.answers.format || '');
    const regions = sessions.map((s) => s.answers.region || '');

    return {
      total,
      completed,
      inProgress,
      started,
      embedded,
      completionRate: total ? Math.round((completed / total) * 100) : 0,
      avgBudget: avg(budgets),
      avgNights: avg(nights),
      byFormat: countBy(formats, FORMAT_LABELS),
      byRegion: countBy(regions, REGION_LABELS),
      withoutFormat: formats.filter((f) => !f).length,
      withoutRegion: regions.filter((r) => !r).length,
    };
  }, [sessions]);

  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    window.sessionStorage.setItem('podbor-admin-password', password);
    setIsAuthed(true);
  }

  function logout() {
    window.sessionStorage.removeItem('podbor-admin-password');
    setIsAuthed(false);
    setPassword('');
    setSessions([]);
  }

  function exportTsv() {
    const params = new URLSearchParams({ password, format: 'tsv' });
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    window.open(`/api/podbor-responses?${params.toString()}`, '_blank');
  }

  if (!isAuthed) {
    return (
      <main className={styles.page}>
        <div className={`${styles.shell} ${styles.loginWrap}`}>
          <form className={styles.loginCard} onSubmit={login}>
            <h1>Подбор /podbor</h1>
            <p className={styles.subtitle}>Статистика ответов визарда подбора туров и отелей.</p>
            <label className={styles.field}>
              Пароль
              <input
                className={styles.input}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>
            <div className={styles.actions}>
              <button className={styles.primaryButton} type="submit">Войти</button>
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
            <h1 className={styles.title}>Подбор /podbor</h1>
            <p className={styles.subtitle}>
              Ответы визарда: состав, бюджет, формат, регион, даты. Handoff — нажали «Показать туры/отели».
            </p>
          </div>
          <button className={styles.secondaryButton} type="button" onClick={logout}>Выйти</button>
        </div>

        <div className={styles.panel} style={{ padding: 24, marginBottom: 20 }}>
          <p className={styles.subtitle} style={{ marginTop: 0 }}>
            Всего: {stats.total} · handoff: {stats.completed} ({stats.completionRate}%) · в процессе: {stats.inProgress} · только старт: {stats.started} · iframe: {stats.embedded}
            {stats.avgBudget != null ? ` · ср. бюджет: ${formatRub(stats.avgBudget)}` : ''}
            {stats.avgNights != null ? ` · ср. ночей: ${stats.avgNights}` : ''}
            {stats.withoutFormat ? ` · без формата: ${stats.withoutFormat}` : ''}
            {stats.withoutRegion ? ` · без региона: ${stats.withoutRegion}` : ''}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div>
              <strong>Формат</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {stats.byFormat.map(([label, count]) => (
                  <li key={label}>{label}: {count}</li>
                ))}
              </ul>
            </div>
            <div>
              <strong>Регион</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {stats.byRegion.map(([label, count]) => (
                  <li key={label}>{label}: {count}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className={styles.panel} style={{ padding: 24 }}>
          <div className={styles.leadsToolbar}>
            <div className={styles.leadsFilters}>
              <label className={styles.field}>
                С
                <input className={styles.input} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </label>
              <label className={styles.field}>
                По
                <input className={styles.input} type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </label>
              <label className={styles.field}>
                Статус
                <select
                  className={styles.input}
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                >
                  <option value="all">Все</option>
                  <option value="completed">Handoff</option>
                  <option value="in_progress">В процессе</option>
                  <option value="started">Только старт</option>
                </select>
              </label>
            </div>
            <div className={styles.actions}>
              <button className={styles.secondaryButton} type="button" onClick={exportTsv}>
                Скачать TSV
              </button>
              <button className={styles.primaryButton} type="button" onClick={loadSessions} disabled={isLoading}>
                {isLoading ? 'Обновляю…' : 'Обновить'}
              </button>
            </div>
          </div>

          {isLoading ? (
            <p className={styles.subtitle}>Загружаю сессии…</p>
          ) : sessions.length === 0 ? (
            <p className={styles.subtitle}>Сессий пока нет. Журнал копится с момента включения логирования.</p>
          ) : (
            <div className={styles.leadsTableWrap}>
              <table className={styles.leadsTable}>
                <thead>
                  <tr>
                    <th>Старт</th>
                    <th>Статус</th>
                    <th>Состав</th>
                    <th>Бюджет</th>
                    <th>Формат</th>
                    <th>Регион</th>
                    <th>Даты</th>
                    <th>UTM</th>
                    <th>Handoff</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => {
                    const a = session.answers;
                    const kidsText = a.kids
                      ? `${a.kids} (${(a.kidsAges || []).join(', ') || '—'})`
                      : '0';
                    return (
                      <tr key={session.id}>
                        <td>{formatDate(session.startedAt)}</td>
                        <td>{STATUS_LABELS[session.status]}</td>
                        <td>
                          {a.adults ?? '—'} взр., {kidsText} дет.
                          {session.embedded ? <span className={styles.hint}><br />iframe</span> : null}
                        </td>
                        <td>
                          {formatRub(a.budget)}
                          {a.budgetCustom ? <span className={styles.hint}><br />своя сумма</span> : null}
                        </td>
                        <td>{a.format ? (FORMAT_LABELS[a.format] || a.format) : '—'}</td>
                        <td>{a.region ? (REGION_LABELS[a.region] || a.region) : '—'}</td>
                        <td className={styles.hint}>
                          {a.checkIn && a.checkOut ? `${a.checkIn}–${a.checkOut}` : '—'}
                          {a.nights ? <><br />{a.nights} н.</> : null}
                        </td>
                        <td className={styles.hint}>
                          {session.utm?.utm_source || '—'}
                          {session.utm?.utm_campaign ? <><br />{session.utm.utm_campaign}</> : null}
                        </td>
                        <td className={styles.hint}>
                          {a.handoffUrl ? (
                            <a href={a.handoffUrl} target="_blank" rel="noreferrer">ссылка</a>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {status && !error && <p className={styles.status}>{status}</p>}
          {error && <p className={`${styles.status} ${styles.error}`}>{error}</p>}
        </div>
      </div>
    </main>
  );
}
