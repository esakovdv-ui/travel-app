'use client';

import { useEffect, useState } from 'react';
import type { ThematicRowConfig } from '@/lib/thematic-rows';
import styles from './thematic-rows.module.css';

export default function ThematicRowsPage() {
  const [rows, setRows] = useState<ThematicRowConfig[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/thematic-rows')
      .then(r => r.json())
      .then(setRows);
  }, []);

  function updateRow(id: string, patch: Partial<ThematicRowConfig>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  function updateSearch(id: string, patch: Partial<ThematicRowConfig['search']>) {
    setRows(prev => prev.map(r =>
      r.id === id ? { ...r, search: { ...r.search, ...patch } } : r
    ));
  }

  function moveRow(id: string, dir: -1 | 1) {
    setRows(prev => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex(r => r.id === id);
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const a = sorted[idx].order;
      const b = sorted[swapIdx].order;
      return prev.map(r => {
        if (r.id === sorted[idx].id) return { ...r, order: b };
        if (r.id === sorted[swapIdx].id) return { ...r, order: a };
        return r;
      });
    });
  }

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/thematic-rows', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows),
      });
      if (!res.ok) throw new Error();
      setNotice({ type: 'success', text: 'Сохранено. Кэш главной страницы сброшен.' });
    } catch {
      setNotice({ type: 'error', text: 'Ошибка сохранения. Попробуйте снова.' });
    } finally {
      setSaving(false);
    }
  }

  const sorted = [...rows].sort((a, b) => a.order - b.order);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>
          <span className={styles.pageTitleAccent} aria-hidden="true" />
          Тематические ряды
        </h1>
        <p className={styles.pageSubtitle}>
          Подборки на главной странице — данные из Level Travel API
        </p>
      </div>

      {notice && (
        <div className={`${styles.notice} ${notice.type === 'success' ? styles.noticeSuccess : styles.noticeError}`}>
          {notice.text}
        </div>
      )}

      <div className={styles.actions}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Сохранение...' : 'Сохранить изменения'}
        </button>
      </div>

      <div className={styles.rowList}>
        {sorted.map((row, idx) => (
          <div key={row.id} className={`${styles.rowCard} ${!row.enabled ? styles.disabled : ''}`}>
            <div className={styles.rowHeader} onClick={() => setOpenId(openId === row.id ? null : row.id)}>
              <div className={styles.rowOrder}>{idx + 1}</div>
              <div className={styles.rowInfo}>
                <div className={styles.rowTitle}>{row.title}</div>
                <div className={styles.rowMeta}>
                  {row.search.toCountry}{row.search.toCity ? ` · ${row.search.toCity}` : ''} ·{' '}
                  {row.search.nightsFrom}–{row.search.nightsTo} ночей · {row.search.adults} взр.
                </div>
              </div>
              <span className={`${styles.rowBadge} ${row.enabled ? styles.badgeOn : styles.badgeOff}`}>
                {row.enabled ? 'Включён' : 'Выключен'}
              </span>
              <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => moveRow(row.id, -1)}
                  disabled={idx === 0}
                  title="Вверх"
                >↑</button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => moveRow(row.id, 1)}
                  disabled={idx === sorted.length - 1}
                  title="Вниз"
                >↓</button>
              </div>
              <span className={`${styles.rowChevron} ${openId === row.id ? styles.open : ''}`}>▼</span>
            </div>

            {openId === row.id && (
              <div className={styles.rowBody}>
                {/* Левая колонка — метаданные */}
                <div className={styles.fieldGroup}>
                  <div className={styles.fieldGroupTitle}>Отображение</div>

                  <label className={styles.toggle} onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className={styles.toggleInput}
                      checked={row.enabled}
                      onChange={e => updateRow(row.id, { enabled: e.target.checked })}
                    />
                    <span className={styles.toggleLabel}>Показывать на главной</span>
                  </label>

                  <div className={styles.field}>
                    <label className={styles.label}>Заголовок</label>
                    <input
                      className={styles.input}
                      value={row.title}
                      onChange={e => updateRow(row.id, { title: e.target.value })}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Описание</label>
                    <input
                      className={styles.input}
                      value={row.description}
                      onChange={e => updateRow(row.id, { description: e.target.value })}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Eyebrow (надзаголовок)</label>
                    <input
                      className={styles.input}
                      value={row.eyebrow}
                      onChange={e => updateRow(row.id, { eyebrow: e.target.value })}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Ссылка «Смотреть всё»</label>
                    <input
                      className={styles.input}
                      value={row.href}
                      onChange={e => updateRow(row.id, { href: e.target.value })}
                    />
                  </div>
                </div>

                {/* Правая колонка — параметры поиска */}
                <div className={styles.fieldGroup}>
                  <div className={styles.fieldGroupTitle}>Параметры Level Travel</div>

                  <div className={styles.field}>
                    <label className={styles.label}>Страна (to_country)</label>
                    <input
                      className={styles.input}
                      value={row.search.toCountry}
                      onChange={e => updateSearch(row.id, { toCountry: e.target.value })}
                      placeholder="Turkey, Egypt, Thailand..."
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Город/курорт (опционально)</label>
                    <input
                      className={styles.input}
                      value={row.search.toCity ?? ''}
                      onChange={e => updateSearch(row.id, { toCity: e.target.value })}
                      placeholder="Antalya, Hurghada..."
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Взрослых</label>
                    <input
                      type="number"
                      className={styles.input}
                      value={row.search.adults}
                      min={1}
                      max={6}
                      onChange={e => updateSearch(row.id, { adults: Number(e.target.value) })}
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Ночей (от — до)</label>
                    <div className={styles.numberRow}>
                      <input
                        type="number"
                        className={styles.input}
                        value={row.search.nightsFrom}
                        min={1}
                        onChange={e => updateSearch(row.id, { nightsFrom: Number(e.target.value) })}
                        placeholder="от"
                      />
                      <input
                        type="number"
                        className={styles.input}
                        value={row.search.nightsTo}
                        min={1}
                        onChange={e => updateSearch(row.id, { nightsTo: Number(e.target.value) })}
                        placeholder="до"
                      />
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Вылет через (дней от сегодня)</label>
                    <div className={styles.numberRow}>
                      <input
                        type="number"
                        className={styles.input}
                        value={row.search.startOffsetDays}
                        min={1}
                        onChange={e => updateSearch(row.id, { startOffsetDays: Number(e.target.value) })}
                        placeholder="от"
                      />
                      <input
                        type="number"
                        className={styles.input}
                        value={row.search.endOffsetDays}
                        min={1}
                        onChange={e => updateSearch(row.id, { endOffsetDays: Number(e.target.value) })}
                        placeholder="до"
                      />
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Максимум карточек</label>
                    <input
                      type="number"
                      className={styles.input}
                      value={row.search.maxResults}
                      min={1}
                      max={20}
                      onChange={e => updateSearch(row.id, { maxResults: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={styles.actions}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Сохранение...' : 'Сохранить изменения'}
        </button>
      </div>
    </div>
  );
}
