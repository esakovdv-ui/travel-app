'use client';

import { useEffect, useState } from 'react';
import type { SearchTag } from '@/lib/search-tags';
import styles from '../thematic-rows/thematic-rows.module.css';
import tagStyles from './search-tags.module.css';

const ICON_OPTIONS = [
  { value: 'umbrella',          label: '☂ Зонтик' },
  { value: 'umbrella-duotone',  label: '☂ Зонтик (акцент)' },
  { value: 'globe',             label: '🌐 Глобус' },
  { value: 'airplane-takeoff',  label: '✈ Самолёт (взлёт)' },
  { value: 'airplane-landing',  label: '✈ Самолёт (посадка)' },
  { value: 'map-pin',           label: '📍 Метка' },
  { value: 'suitcase',          label: '🧳 Чемодан' },
];

export default function SearchTagsPage() {
  const [tags, setTags] = useState<SearchTag[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/search-tags')
      .then(r => r.json())
      .then(setTags);
  }, []);

  function updateTag(id: string, patch: Partial<SearchTag>) {
    setTags(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }

  function moveTag(id: string, dir: -1 | 1) {
    setTags(prev => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex(t => t.id === id);
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const a = sorted[idx].order;
      const b = sorted[swapIdx].order;
      return prev.map(t => {
        if (t.id === sorted[idx].id) return { ...t, order: b };
        if (t.id === sorted[swapIdx].id) return { ...t, order: a };
        return t;
      });
    });
  }

  function addTag() {
    const newId = `tag-${Date.now()}`;
    const maxOrder = tags.length ? Math.max(...tags.map(t => t.order)) + 1 : 0;
    setTags(prev => [...prev, {
      id: newId,
      label: 'Новый тег',
      icon: 'umbrella',
      href: '/tours',
      enabled: true,
      order: maxOrder,
    }]);
  }

  function deleteTag(id: string) {
    setTags(prev => prev.filter(t => t.id !== id));
  }

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/search-tags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tags),
      });
      if (!res.ok) throw new Error();
      setNotice({ type: 'success', text: 'Теги сохранены.' });
    } catch {
      setNotice({ type: 'error', text: 'Ошибка сохранения. Попробуйте снова.' });
    } finally {
      setSaving(false);
    }
  }

  const sorted = [...tags].sort((a, b) => a.order - b.order);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>
          <span className={styles.pageTitleAccent} aria-hidden="true" />
          Теги поиска
        </h1>
        <p className={styles.pageSubtitle}>
          Кнопки-категории в начале главной страницы
        </p>
      </div>

      {notice && (
        <div className={`${styles.notice} ${notice.type === 'success' ? styles.noticeSuccess : styles.noticeError}`}>
          {notice.text}
        </div>
      )}

      <div className={styles.actions}>
        <button className="btn btn-secondary" onClick={addTag} type="button">
          + Добавить тег
        </button>
        <button className="btn btn-primary" onClick={save} disabled={saving} type="button">
          {saving ? 'Сохранение...' : 'Сохранить изменения'}
        </button>
      </div>

      <div className={tagStyles.tagList}>
        {sorted.map((tag, idx) => (
          <div key={tag.id} className={`${tagStyles.tagRow} ${!tag.enabled ? tagStyles.disabled : ''}`}>
            <div className={tagStyles.orderBadge}>{idx + 1}</div>

            <label className={styles.toggle}>
              <input
                type="checkbox"
                className={styles.toggleInput}
                checked={tag.enabled}
                onChange={e => updateTag(tag.id, { enabled: e.target.checked })}
              />
            </label>

            <div className={tagStyles.fields}>
              <div className={styles.field}>
                <label className={styles.label}>Название</label>
                <input
                  className={styles.input}
                  value={tag.label}
                  onChange={e => updateTag(tag.id, { label: e.target.value })}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Иконка</label>
                <select
                  className={styles.select}
                  value={tag.icon}
                  onChange={e => updateTag(tag.id, { icon: e.target.value })}
                >
                  {ICON_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Ссылка</label>
                <input
                  className={styles.input}
                  value={tag.href}
                  onChange={e => updateTag(tag.id, { href: e.target.value })}
                  placeholder="/tours?toCountry=TR"
                />
              </div>
            </div>

            <div className={tagStyles.rowActions}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => moveTag(tag.id, -1)}
                disabled={idx === 0}
                type="button"
                title="Вверх"
              >↑</button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => moveTag(tag.id, 1)}
                disabled={idx === sorted.length - 1}
                type="button"
                title="Вниз"
              >↓</button>
              <button
                className={`btn btn-secondary btn-sm ${tagStyles.deleteBtn}`}
                onClick={() => deleteTag(tag.id)}
                type="button"
                title="Удалить"
              >✕</button>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.actions}>
        <button className="btn btn-secondary" onClick={addTag} type="button">
          + Добавить тег
        </button>
        <button className="btn btn-primary" onClick={save} disabled={saving} type="button">
          {saving ? 'Сохранение...' : 'Сохранить изменения'}
        </button>
      </div>
    </div>
  );
}
