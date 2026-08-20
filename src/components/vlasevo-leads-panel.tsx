'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from '@/app/raduga-admin/raduga-admin.module.css';

type VlasevoLead = {
  id: string;
  createdAt: string;
  name: string;
  phone: string;
  shift: string;
  landing: 'vlasevo' | 'vlasevo-promo';
  bookingPrice?: number;
  source?: string;
  bitrixStatus: 'pending' | 'sent' | 'failed';
  bitrixDealId?: number;
  bitrixError?: string;
};

type LandingFilter = 'all' | 'vlasevo' | 'vlasevo-promo';

const BITRIX_STATUS_LABELS: Record<VlasevoLead['bitrixStatus'], string> = {
  pending: 'Ожидает отправки',
  sent: 'Отправлено в Bitrix',
  failed: 'Ошибка Bitrix (повтор через ~5 мин)',
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

function formatPrice(value?: number) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}

type VlasevoLeadsPanelProps = {
  password: string;
  defaultLanding?: LandingFilter;
};

export function VlasevoLeadsPanel({ password, defaultLanding = 'all' }: VlasevoLeadsPanelProps) {
  const [leads, setLeads] = useState<VlasevoLead[]>([]);
  const [landingFilter, setLandingFilter] = useState<LandingFilter>(defaultLanding);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const loadLeads = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        password,
        landing: landingFilter,
        limit: '500',
      });
      const response = await fetch(`/api/vlasevo-leads?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось загрузить заявки');
      setLeads(Array.isArray(data.leads) ? data.leads : []);
      setStatus(`Заявок: ${Array.isArray(data.leads) ? data.leads.length : 0}`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить заявки');
      setLeads([]);
    } finally {
      setIsLoading(false);
    }
  }, [landingFilter, password]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const stats = useMemo(() => ({
    total: leads.length,
    failed: leads.filter((lead) => lead.bitrixStatus === 'failed').length,
    pending: leads.filter((lead) => lead.bitrixStatus === 'pending').length,
    sent: leads.filter((lead) => lead.bitrixStatus === 'sent').length,
  }), [leads]);

  return (
    <div className={styles.panel}>
      <div className={styles.leadsToolbar}>
        <div className={styles.leadsFilters}>
          <label className={styles.field}>
            Лендинг
            <select
              className={styles.input}
              value={landingFilter}
              onChange={(event) => setLandingFilter(event.target.value as LandingFilter)}
            >
              <option value="all">Все</option>
              <option value="vlasevo">/vlasevo</option>
              <option value="vlasevo-promo">/vlasevo-promo</option>
            </select>
          </label>
        </div>
        <div className={styles.actions}>
          <button className={styles.secondaryButton} type="button" onClick={loadLeads} disabled={isLoading}>
            {isLoading ? 'Обновляю…' : 'Обновить'}
          </button>
        </div>
      </div>

      <p className={styles.subtitle}>
        Всего: {stats.total} · в Bitrix: {stats.sent} · ожидают отправки: {stats.failed + stats.pending}
      </p>
      <p className={styles.hint}>
        Заявки сохраняются на сервере сразу. Отправка в Bitrix идёт через GitHub Actions (relay), т.к. VPS не достучится до CRM напрямую — обычно в течение 5 минут.
      </p>

      {isLoading ? (
        <p className={styles.subtitle}>Загружаю заявки…</p>
      ) : leads.length === 0 ? (
        <p className={styles.subtitle}>Заявок пока нет.</p>
      ) : (
        <div className={styles.leadsTableWrap}>
          <table className={styles.leadsTable}>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Имя</th>
                <th>Телефон</th>
                <th>Смена</th>
                <th>Лендинг</th>
                <th>Цена</th>
                <th>Bitrix</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>{formatDate(lead.createdAt)}</td>
                  <td>{lead.name}</td>
                  <td>
                    <a href={`tel:${lead.phone}`}>{lead.phone}</a>
                  </td>
                  <td>{lead.shift}</td>
                  <td>{lead.landing === 'vlasevo-promo' ? 'promo' : 'vlasevo'}</td>
                  <td>{formatPrice(lead.bookingPrice)}</td>
                  <td>
                    <span className={`${styles.leadStatus} ${styles[`leadStatus_${lead.bitrixStatus}`]}`}>
                      {BITRIX_STATUS_LABELS[lead.bitrixStatus]}
                    </span>
                    {lead.bitrixDealId ? (
                      <span className={styles.hint}> · сделка #{lead.bitrixDealId}</span>
                    ) : null}
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
  );
}
