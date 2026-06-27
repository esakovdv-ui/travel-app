'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import styles from '../raduga-admin/raduga-admin.module.css';

type RebookingVisitStatus = 'visited' | 'searched' | 'submitted';

type RebookingVisit = {
  id: string;
  order: string;
  cert: string;
  name: string;
  visitedAt: string;
  lastEventAt: string;
  lastEvent?: string;
  status: RebookingVisitStatus;
  selectedHotel?: string;
  selectedCountry?: string;
  selectedRegion?: string;
  phone?: string;
  email?: string;
  tourvisorOrderId?: string;
  leadSource?: 'direct' | 'sync' | 'webhook';
  bitrixLeadId?: number;
  people?: number;
  price?: number;
};

const STATUS_LABELS: Record<RebookingVisitStatus, string> = {
  visited: 'Зашёл',
  searched: 'Выбрал тур',
  submitted: 'Оставил заявку',
};

const LEAD_SOURCE_LABELS: Record<NonNullable<RebookingVisit['leadSource']>, string> = {
  direct: 'postMessage',
  sync: 'sync TV',
  webhook: 'webhook TV',
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

function formatTour(visit: RebookingVisit) {
  const parts = [visit.selectedHotel, visit.selectedCountry, visit.selectedRegion].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}

function formatPrice(value?: number) {
  if (value == null || !Number.isFinite(value)) return '';
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}

export function RebookingAdminClient() {
  const [password, setPassword] = useState('');
  const [isAuthed, setIsAuthed] = useState(false);
  const [visits, setVisits] = useState<RebookingVisit[]>([]);
  const [orderFilter, setOrderFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const saved = window.sessionStorage.getItem('rebooking-admin-password');
    if (saved) {
      setPassword(saved);
      setIsAuthed(true);
    }
  }, []);

  const loadVisits = useCallback(async () => {
    if (!password) return;
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ password, limit: '500' });
      if (orderFilter.trim()) params.set('order', orderFilter.trim());
      const response = await fetch(`/api/rebooking-visits?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          window.sessionStorage.removeItem('rebooking-admin-password');
          setIsAuthed(false);
        }
        throw new Error(data.error || 'Не удалось загрузить визиты');
      }
      setVisits(Array.isArray(data.visits) ? data.visits : []);
      setStatus(`Записей: ${Array.isArray(data.visits) ? data.visits.length : 0}`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить визиты');
      setVisits([]);
    } finally {
      setIsLoading(false);
    }
  }, [orderFilter, password]);

  useEffect(() => {
    if (!isAuthed) return;
    loadVisits();
  }, [isAuthed, loadVisits]);

  const stats = useMemo(() => ({
    total: visits.length,
    visited: visits.filter((visit) => visit.status === 'visited').length,
    searched: visits.filter((visit) => visit.status === 'searched').length,
    submitted: visits.filter((visit) => visit.status === 'submitted').length,
  }), [visits]);

  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    window.sessionStorage.setItem('rebooking-admin-password', password);
    setIsAuthed(true);
  }

  function logout() {
    window.sessionStorage.removeItem('rebooking-admin-password');
    setIsAuthed(false);
    setPassword('');
    setVisits([]);
  }

  if (!isAuthed) {
    return (
      <main className={styles.page}>
        <div className={`${styles.shell} ${styles.loginWrap}`}>
          <form className={styles.loginCard} onSubmit={login}>
            <h1>Перебронирование</h1>
            <p className={styles.subtitle}>Введите пароль админки визитов /rebooking.</p>
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
            <h1 className={styles.title}>Визиты /rebooking</h1>
            <p className={styles.subtitle}>
              Кто заходил на лендинг, какой тур выбрал и какие данные оставил в форме Tourvisor.
            </p>
          </div>
          <button className={styles.secondaryButton} type="button" onClick={logout}>Выйти</button>
        </div>

        <div className={styles.panel}>
          <div className={styles.leadsToolbar}>
            <div className={styles.leadsFilters}>
              <label className={styles.field}>
                Фильтр по заявке
                <input
                  className={styles.input}
                  type="search"
                  placeholder="МГТ-2025-…"
                  value={orderFilter}
                  onChange={(event) => setOrderFilter(event.target.value)}
                />
              </label>
            </div>
            <div className={styles.actions}>
              <button className={styles.secondaryButton} type="button" onClick={loadVisits} disabled={isLoading}>
                {isLoading ? 'Обновляю…' : 'Обновить'}
              </button>
            </div>
          </div>

          <p className={styles.subtitle}>
            Всего: {stats.total} · зашли: {stats.visited} · выбрали тур: {stats.searched} · заявки: {stats.submitted}
          </p>

          {isLoading ? (
            <p className={styles.subtitle}>Загружаю визиты…</p>
          ) : visits.length === 0 ? (
            <p className={styles.subtitle}>Визитов пока нет.</p>
          ) : (
            <div className={styles.leadsTableWrap}>
              <table className={styles.leadsTable}>
                <thead>
                  <tr>
                    <th>Заход</th>
                    <th>Заявка</th>
                    <th>Клиент</th>
                    <th>Статус</th>
                    <th>Последнее событие</th>
                    <th>Выбранный тур</th>
                    <th>Телефон</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((visit) => (
                    <tr key={visit.id}>
                      <td>{formatDate(visit.visitedAt)}</td>
                      <td>
                        <strong>{visit.order}</strong>
                        {visit.cert ? <span className={styles.hint}><br />{visit.cert}</span> : null}
                      </td>
                      <td>
                        {visit.name || '—'}
                        {visit.people ? (
                          <span className={styles.hint}><br />{visit.people} чел.{formatPrice(visit.price) ? ` · ${formatPrice(visit.price)}` : ''}</span>
                        ) : null}
                      </td>
                      <td>
                        <span className={`${styles.leadStatus} ${styles[`leadStatus_${visit.status === 'submitted' ? 'sent' : visit.status === 'searched' ? 'pending' : 'failed'}`]}`}>
                          {STATUS_LABELS[visit.status]}
                        </span>
                        {visit.leadSource ? (
                          <span className={styles.hint}><br />{LEAD_SOURCE_LABELS[visit.leadSource]}</span>
                        ) : null}
                      </td>
                      <td>
                        {visit.lastEvent || '—'}
                        <span className={styles.hint}><br />{formatDate(visit.lastEventAt)}</span>
                      </td>
                      <td>{formatTour(visit)}</td>
                      <td>
                        {visit.phone ? <a href={`tel:${visit.phone}`}>{visit.phone}</a> : '—'}
                      </td>
                      <td>
                        {visit.email ? <a href={`mailto:${visit.email}`}>{visit.email}</a> : '—'}
                      </td>
                    </tr>
                  ))}
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
