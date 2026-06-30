'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import styles from '../raduga-admin/raduga-admin.module.css';

type RebookingBitrixStatus = 'pending' | 'sent' | 'failed';
type RebookingCaptureSource = 'direct' | 'sync' | 'webhook';

type RebookingQueuedLead = {
  id: string;
  createdAt: string;
  order: string;
  cert: string;
  name: string;
  phone: string;
  email?: string;
  comment?: string;
  people?: number;
  kids?: number;
  kidAges?: number[];
  price?: number;
  nights?: number;
  date?: string;
  destination?: string;
  tour?: {
    hotel?: string;
    country?: string;
    region?: string;
    dateFrom?: string;
    nights?: number;
    price?: number;
    placement?: string;
    meal?: string;
    tourvisorOrderId?: string;
    orderTypeName?: string;
  };
  captureSource: RebookingCaptureSource;
  tourvisorOrderId?: string;
  eventType?: string;
  bitrixStatus: RebookingBitrixStatus;
  bitrixLeadId?: number;
  bitrixSyncedAt?: string;
  bitrixError?: string;
};

const BITRIX_STATUS_LABELS: Record<RebookingBitrixStatus, string> = {
  pending: 'В очереди',
  sent: 'В Bitrix',
  failed: 'Ошибка Bitrix',
};

const CAPTURE_SOURCE_LABELS: Record<RebookingCaptureSource, string> = {
  direct: 'postMessage',
  sync: 'sync TV',
  webhook: 'webhook TV',
};

const SYNC_INTERVAL_MS = 5 * 60 * 1000;

type AdminView = 'leads' | 'visits' | 'annuls';

type RebookingAnnulRecord = {
  id: string;
  createdAt: string;
  order: string;
  cert: string;
  name: string;
  phone?: string;
  email?: string;
  people?: number;
  kids?: number;
  kidAges?: number[];
  price?: number;
  nights?: number;
  date?: string;
  bitrixStatus: 'sent' | 'failed';
  bitrixItemId?: number;
  bitrixError?: string;
};

const ANNUL_STATUS_LABELS: Record<RebookingAnnulRecord['bitrixStatus'], string> = {
  sent: 'В Bitrix',
  failed: 'Ошибка',
};

const VISIT_EVENT_LABELS: Record<string, string> = {
  visit: 'Заход',
  ANNUL_REQUEST: 'Аннуляция',
  ORDERTOUR: 'Заявка на тур',
  HELPTOUR: 'Помощь с туром',
  NOTOUR: 'Нет туров',
  HELPCART: 'Корзина',
  TOURSELECTION: 'Выбор тура',
  BOOKTOUR: 'Бронирование',
  focus_sync: 'Синхронизация',
  lead_submitted: 'Заявка отправлена',
};

type RebookingVisit = {
  id: string;
  order: string;
  cert: string;
  name: string;
  visitedAt: string;
  lastEventAt: string;
  lastEvent?: string;
  status: 'visited' | 'searched' | 'submitted';
  selectedHotel?: string;
  selectedCountry?: string;
  phone?: string;
  tourvisorOrderId?: string;
  leadSource?: string;
  bitrixLeadId?: number;
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

function formatTour(lead: RebookingQueuedLead) {
  const parts = [lead.tour?.hotel, lead.tour?.country, lead.tour?.region].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}

function formatPrice(value?: number) {
  if (value == null || !Number.isFinite(value)) return '';
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}

function formatVisitEvent(event?: string) {
  if (!event) return '—';
  return VISIT_EVENT_LABELS[event] || event;
}

function formatCompositionFromVisit(visit: RebookingVisit | RebookingAnnulRecord) {
  const parts: string[] = [];
  if (visit.people != null) parts.push(`${visit.people} чел.`);
  if (visit.kids != null) parts.push(`детей: ${visit.kids}`);
  if (visit.kidAges?.length) parts.push(`возрасты: ${visit.kidAges.join(', ')}`);
  return parts.join(' · ');
}

function formatComposition(lead: RebookingQueuedLead) {
  return formatCompositionFromVisit(lead);
}

export function RebookingAdminClient() {
  const [password, setPassword] = useState('');
  const [isAuthed, setIsAuthed] = useState(false);
  const [view, setView] = useState<AdminView>('leads');
  const [leads, setLeads] = useState<RebookingQueuedLead[]>([]);
  const [visits, setVisits] = useState<RebookingVisit[]>([]);
  const [annuls, setAnnuls] = useState<RebookingAnnulRecord[]>([]);
  const [orderFilter, setOrderFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RebookingBitrixStatus>('all');
  const [annulStatusFilter, setAnnulStatusFilter] = useState<'all' | 'sent' | 'failed'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const saved = window.sessionStorage.getItem('rebooking-admin-password');
    if (saved) {
      setPassword(saved);
      setIsAuthed(true);
    }
  }, []);

  const loadLeads = useCallback(async () => {
    if (!password) return;
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ password, limit: '500', status: statusFilter });
      if (orderFilter.trim()) params.set('order', orderFilter.trim());
      const response = await fetch(`/api/rebooking-leads?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          window.sessionStorage.removeItem('rebooking-admin-password');
          setIsAuthed(false);
        }
        throw new Error(data.error || 'Не удалось загрузить лиды');
      }
      setLeads(Array.isArray(data.leads) ? data.leads : []);
      setStatus(`Лидов: ${Array.isArray(data.leads) ? data.leads.length : 0}`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить лиды');
      setLeads([]);
    } finally {
      setIsLoading(false);
    }
  }, [orderFilter, password, statusFilter]);

  const loadVisits = useCallback(async () => {
    if (!password) return;
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ password, limit: '500' });
      if (orderFilter.trim()) params.set('order', orderFilter.trim());
      const response = await fetch(`/api/rebooking-visits?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось загрузить визиты');
      setVisits(Array.isArray(data.visits) ? data.visits : []);
      setStatus(`Визитов: ${Array.isArray(data.visits) ? data.visits.length : 0}`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить визиты');
      setVisits([]);
    } finally {
      setIsLoading(false);
    }
  }, [orderFilter, password]);

  const loadAnnuls = useCallback(async () => {
    if (!password) return;
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ password, limit: '500', status: annulStatusFilter });
      if (orderFilter.trim()) params.set('order', orderFilter.trim());
      const response = await fetch(`/api/rebooking-annuls?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось загрузить аннуляции');
      setAnnuls(Array.isArray(data.annuls) ? data.annuls : []);
      setStatus(`Аннуляций: ${Array.isArray(data.annuls) ? data.annuls.length : 0}`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить аннуляции');
      setAnnuls([]);
    } finally {
      setIsLoading(false);
    }
  }, [annulStatusFilter, orderFilter, password]);

  const loadData = useCallback(async () => {
    if (view === 'visits') await loadVisits();
    else if (view === 'annuls') await loadAnnuls();
    else await loadLeads();
  }, [loadAnnuls, loadLeads, loadVisits, view]);

  const syncBitrix = useCallback(async (silent = false) => {
    if (!password) return;
    setIsSyncing(true);
    if (!silent) setError('');
    try {
      const params = new URLSearchParams({ password, limit: '30' });
      const response = await fetch(`/api/rebooking-sync-bitrix?${params.toString()}`, {
        method: 'POST',
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Синхронизация не удалась');
      if (!silent) {
        setStatus(`Bitrix: отправлено ${data.sent ?? 0}, ошибок ${data.failed ?? 0}`);
      }
      await loadLeads();
    } catch (syncError) {
      if (!silent) {
        setError(syncError instanceof Error ? syncError.message : 'Синхронизация не удалась');
      }
    } finally {
      setIsSyncing(false);
    }
  }, [loadLeads, password]);

  useEffect(() => {
    if (!isAuthed) return;
    loadData();
  }, [isAuthed, loadData]);

  useEffect(() => {
    if (!isAuthed || view !== 'leads') return;
    const timer = window.setInterval(() => {
      syncBitrix(true);
    }, SYNC_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isAuthed, syncBitrix, view]);

  const stats = useMemo(() => ({
    total: leads.length,
    pending: leads.filter((lead) => lead.bitrixStatus === 'pending').length,
    sent: leads.filter((lead) => lead.bitrixStatus === 'sent').length,
    failed: leads.filter((lead) => lead.bitrixStatus === 'failed').length,
  }), [leads]);

  const annulStats = useMemo(() => ({
    total: annuls.length,
    sent: annuls.filter((item) => item.bitrixStatus === 'sent').length,
    failed: annuls.filter((item) => item.bitrixStatus === 'failed').length,
  }), [annuls]);

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
    setLeads([]);
  }

  if (!isAuthed) {
    return (
      <main className={styles.page}>
        <div className={`${styles.shell} ${styles.loginWrap}`}>
          <form className={styles.loginCard} onSubmit={login}>
            <h1>Перебронирование</h1>
            <p className={styles.subtitle}>Введите пароль админки лидов /rebooking.</p>
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
            <h1 className={styles.title}>Перебронирование /rebooking</h1>
            <p className={styles.subtitle}>
              Лиды — перебронь в Bitrix. Аннуляции — запросы с кнопки на лендинге. Визиты — все заходы на страницу.
            </p>
          </div>
          <button className={styles.secondaryButton} type="button" onClick={logout}>Выйти</button>
        </div>

        <div className={styles.panel}>
          <div className={styles.actions} style={{ marginBottom: 16 }}>
            <button
              className={view === 'leads' ? styles.primaryButton : styles.secondaryButton}
              type="button"
              onClick={() => setView('leads')}
            >
              Лиды
            </button>
            <button
              className={view === 'visits' ? styles.primaryButton : styles.secondaryButton}
              type="button"
              onClick={() => setView('visits')}
            >
              Визиты
            </button>
            <button
              className={view === 'annuls' ? styles.primaryButton : styles.secondaryButton}
              type="button"
              onClick={() => setView('annuls')}
            >
              Аннуляции
            </button>
          </div>

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
              {view === 'leads' ? (
              <label className={styles.field}>
                Статус Bitrix
                <select
                  className={styles.input}
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                >
                  <option value="all">Все</option>
                  <option value="pending">В очереди</option>
                  <option value="sent">В Bitrix</option>
                  <option value="failed">Ошибка</option>
                </select>
              </label>
              ) : null}
              {view === 'annuls' ? (
              <label className={styles.field}>
                Статус
                <select
                  className={styles.input}
                  value={annulStatusFilter}
                  onChange={(event) => setAnnulStatusFilter(event.target.value as typeof annulStatusFilter)}
                >
                  <option value="all">Все</option>
                  <option value="sent">В Bitrix</option>
                  <option value="failed">Ошибка</option>
                </select>
              </label>
              ) : null}
            </div>
            <div className={styles.actions}>
              {view === 'leads' ? (
              <button
                className={styles.primaryButton}
                type="button"
                onClick={() => syncBitrix(false)}
                disabled={isSyncing}
              >
                {isSyncing ? 'Отправляю…' : 'Отправить в Bitrix'}
              </button>
              ) : null}
              <button className={styles.secondaryButton} type="button" onClick={loadData} disabled={isLoading}>
                {isLoading ? 'Обновляю…' : 'Обновить'}
              </button>
            </div>
          </div>

          {view === 'leads' ? (
          <>
          <p className={styles.subtitle}>
            Всего: {stats.total} · в очереди: {stats.pending} · в Bitrix: {stats.sent} · ошибки: {stats.failed}
          </p>

          {isLoading ? (
            <p className={styles.subtitle}>Загружаю лиды…</p>
          ) : leads.length === 0 ? (
            <p className={styles.subtitle}>Лидов пока нет. Проверьте вкладку «Визиты» — заявка могла зафиксироваться там.</p>
          ) : (
            <div className={styles.leadsTableWrap}>
              <table className={styles.leadsTable}>
                <thead>
                  <tr>
                    <th>Создан</th>
                    <th>Заявка</th>
                    <th>Клиент</th>
                    <th>Bitrix</th>
                    <th>Источник</th>
                    <th>Тур</th>
                    <th>Телефон</th>
                    <th>Детали</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id}>
                      <td>{formatDate(lead.createdAt)}</td>
                      <td>
                        <strong>{lead.order}</strong>
                        {lead.cert ? <span className={styles.hint}><br />{lead.cert}</span> : null}
                      </td>
                      <td>
                        {lead.name}
                        {formatComposition(lead) ? (
                          <span className={styles.hint}><br />{formatComposition(lead)}</span>
                        ) : null}
                        {lead.price != null ? (
                          <span className={styles.hint}><br />бюджет: {formatPrice(lead.price)}</span>
                        ) : null}
                      </td>
                      <td>
                        <span className={`${styles.leadStatus} ${styles[`leadStatus_${lead.bitrixStatus === 'sent' ? 'sent' : lead.bitrixStatus === 'failed' ? 'failed' : 'pending'}`]}`}>
                          {BITRIX_STATUS_LABELS[lead.bitrixStatus]}
                        </span>
                        {lead.bitrixLeadId ? (
                          <span className={styles.hint}>
                            <br />
                            <a
                              href={`https://crm.mosgortur.ru/crm/type/1302/details/${lead.bitrixLeadId}/`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              перебронь #{lead.bitrixLeadId}
                            </a>
                          </span>
                        ) : null}
                        {lead.bitrixError ? (
                          <span className={styles.hint}><br />{lead.bitrixError}</span>
                        ) : null}
                      </td>
                      <td>
                        {CAPTURE_SOURCE_LABELS[lead.captureSource]}
                        {lead.eventType ? <span className={styles.hint}><br />{lead.eventType}</span> : null}
                        {lead.tourvisorOrderId ? (
                          <span className={styles.hint}><br />TV #{lead.tourvisorOrderId}</span>
                        ) : null}
                      </td>
                      <td>
                        {formatTour(lead)}
                        {lead.tour?.price != null ? (
                          <span className={styles.hint}><br />{formatPrice(lead.tour.price)}</span>
                        ) : null}
                      </td>
                      <td>
                        <a href={`tel:${lead.phone}`}>{lead.phone}</a>
                        {lead.email ? (
                          <span className={styles.hint}><br /><a href={`mailto:${lead.email}`}>{lead.email}</a></span>
                        ) : null}
                      </td>
                      <td className={styles.hint}>
                        {lead.date ? `дата: ${lead.date}` : null}
                        {lead.nights != null ? <><br />ночей: {lead.nights}</> : null}
                        {lead.tour?.meal ? <><br />питание: {lead.tour.meal}</> : null}
                        {lead.tour?.placement ? <><br />размещение: {lead.tour.placement}</> : null}
                        {lead.comment ? <><br />{lead.comment}</> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </>
          ) : view === 'annuls' ? (
          <>
          <p className={styles.subtitle}>
            Всего: {annulStats.total} · в Bitrix: {annulStats.sent} · ошибки: {annulStats.failed}
          </p>

          {isLoading ? (
            <p className={styles.subtitle}>Загружаю аннуляции…</p>
          ) : annuls.length === 0 ? (
            <p className={styles.subtitle}>Запросов на аннуляцию пока нет.</p>
          ) : (
            <div className={styles.leadsTableWrap}>
              <table className={styles.leadsTable}>
                <thead>
                  <tr>
                    <th>Создан</th>
                    <th>Заявка</th>
                    <th>Клиент</th>
                    <th>Bitrix</th>
                    <th>Контакты</th>
                    <th>Детали</th>
                  </tr>
                </thead>
                <tbody>
                  {annuls.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.createdAt)}</td>
                      <td>
                        <strong>{item.order}</strong>
                        {item.cert ? <span className={styles.hint}><br />{item.cert}</span> : null}
                      </td>
                      <td>
                        {item.name}
                        {formatCompositionFromVisit(item) ? (
                          <span className={styles.hint}><br />{formatCompositionFromVisit(item)}</span>
                        ) : null}
                        {item.price != null ? (
                          <span className={styles.hint}><br />бюджет: {formatPrice(item.price)}</span>
                        ) : null}
                      </td>
                      <td>
                        <span className={`${styles.leadStatus} ${styles[`leadStatus_${item.bitrixStatus === 'sent' ? 'sent' : 'failed'}`]}`}>
                          {ANNUL_STATUS_LABELS[item.bitrixStatus]}
                        </span>
                        {item.bitrixItemId ? (
                          <span className={styles.hint}>
                            <br />
                            <a
                              href={`https://crm.mosgortur.ru/crm/type/1302/details/${item.bitrixItemId}/`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              аннуляция #{item.bitrixItemId}
                            </a>
                          </span>
                        ) : null}
                        {item.bitrixError ? (
                          <span className={styles.hint}><br />{item.bitrixError}</span>
                        ) : null}
                      </td>
                      <td>
                        {item.phone ? <a href={`tel:${item.phone}`}>{item.phone}</a> : '—'}
                        {item.email ? (
                          <span className={styles.hint}><br /><a href={`mailto:${item.email}`}>{item.email}</a></span>
                        ) : null}
                      </td>
                      <td className={styles.hint}>
                        {item.date ? `дата: ${item.date}` : null}
                        {item.nights != null ? <><br />ночей: {item.nights}</> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </>
          ) : isLoading ? (
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
                    <th>Событие</th>
                    <th>Тур</th>
                    <th>Телефон</th>
                    <th>TV</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((visit) => (
                    <tr key={visit.id}>
                      <td>{formatDate(visit.visitedAt)}</td>
                      <td><strong>{visit.order}</strong></td>
                      <td>{visit.name || '—'}</td>
                      <td>{visit.status}</td>
                      <td>
                        {formatVisitEvent(visit.lastEvent)}
                        <span className={styles.hint}><br />{formatDate(visit.lastEventAt)}</span>
                        {visit.lastEvent === 'ANNUL_REQUEST' && visit.bitrixLeadId ? (
                          <span className={styles.hint}>
                            <br />
                            <a
                              href={`https://crm.mosgortur.ru/crm/type/1302/details/${visit.bitrixLeadId}/`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              #{visit.bitrixLeadId}
                            </a>
                          </span>
                        ) : null}
                      </td>
                      <td>{[visit.selectedHotel, visit.selectedCountry].filter(Boolean).join(' · ') || '—'}</td>
                      <td>{visit.phone || '—'}</td>
                      <td>{visit.tourvisorOrderId ? `#${visit.tourvisorOrderId}` : '—'}</td>
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
