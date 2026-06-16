'use client';

import { useState, useTransition } from 'react';
import { renameTagAction } from '@/app/actions';
import type { StoryTag } from '@/types/travel';
import tagStyles from './story-tags.module.css';

export function TagsManager({ initialTags }: { initialTags: StoryTag[] }) {
  const [tags, setTags] = useState(initialTags);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startEdit(tag: StoryTag) {
    setEditingId(tag.id);
    setEditValue(tag.label);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  function save(tagId: string) {
    const fd = new FormData();
    fd.append('tagId', tagId);
    fd.append('label', editValue);
    startTransition(async () => {
      const result = await renameTagAction(fd);
      if (result?.error) {
        setError(result.error);
      } else {
        setTags((prev) => prev.map((t) => (t.id === tagId ? { ...t, label: editValue } : t)));
        setEditingId(null);
        setError(null);
      }
    });
  }

  return (
    <div className={tagStyles.tableWrap}>
      {error && <p className={tagStyles.errorBanner}>{error}</p>}
      <table className={tagStyles.table}>
        <thead>
          <tr>
            <th className={tagStyles.th}>Название</th>
            <th className={tagStyles.th} style={{ width: 100, textAlign: 'center' }}>Историй</th>
            <th className={tagStyles.th} style={{ width: 160 }}></th>
          </tr>
        </thead>
        <tbody>
          {tags.map((tag) => (
            <tr key={tag.id} className={tagStyles.row}>
              <td className={tagStyles.td}>
                {editingId === tag.id ? (
                  <input
                    className={`input ${tagStyles.editInput}`}
                    value={editValue}
                    maxLength={40}
                    autoFocus
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') save(tag.id);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                  />
                ) : (
                  <span className={tag.storiesCount === 0 ? tagStyles.labelMuted : tagStyles.label}>
                    {tag.label}
                  </span>
                )}
              </td>
              <td className={tagStyles.td} style={{ textAlign: 'center' }}>
                <span className={tag.storiesCount === 0 ? tagStyles.countMuted : tagStyles.count}>
                  {tag.storiesCount}
                </span>
              </td>
              <td className={tagStyles.td}>
                {editingId === tag.id ? (
                  <div className={tagStyles.actions}>
                    <button
                      className="btn btn-sm btn-red"
                      onClick={() => save(tag.id)}
                      disabled={isPending || !editValue.trim()}
                    >
                      Сохранить
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={cancelEdit} disabled={isPending}>
                      Отмена
                    </button>
                  </div>
                ) : (
                  <button className="btn btn-sm btn-ghost" onClick={() => startEdit(tag)}>
                    ✏ Переименовать
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
