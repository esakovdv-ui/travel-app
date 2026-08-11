'use client'

import { FormEvent, useEffect, useState } from 'react'
import styles from './admin.module.css'

type LogEntry = {
  id: string
  at: string
  email: string
  success: boolean
  ip: string | null
  userAgent: string | null
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(value))
  } catch {
    return value
  }
}

export default function StaffAdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<LogEntry[]>([])

  async function loadLogs() {
    const res = await fetch('/api/admin/access-log?limit=300')
    if (!res.ok) {
      setAuthed(false)
      return
    }
    const json = await res.json()
    setEntries(Array.isArray(json.entries) ? json.entries : [])
    setAuthed(true)
  }

  useEffect(() => {
    loadLogs().finally(() => setLoading(false))
  }, [])

  async function login(e: FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (!res.ok) {
      setError('Неверный пароль админки')
      setPassword('')
      return
    }
    setPassword('')
    await loadLogs()
  }

  async function logout() {
    await fetch('/api/admin/auth', { method: 'DELETE' })
    setAuthed(false)
    setEntries([])
  }

  if (loading) {
    return <div className={styles.page}><div className={styles.card}>Загрузка…</div></div>
  }

  if (!authed) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Админка staff.motrip.ru</h1>
          <p className={styles.sub}>Журнал попыток входа сотрудников</p>
          <form onSubmit={login} className={styles.form}>
            <input
              type="password"
              className={styles.input}
              placeholder="Пароль админки"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
            />
            {error && <div className={styles.error}>{error}</div>}
            <button type="submit" className={styles.button} disabled={!password}>
              Войти
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Журнал входов</h1>
            <p className={styles.sub}>Последние попытки входа на портал для сотрудников</p>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => loadLogs()}>
              Обновить
            </button>
            <button type="button" className={styles.secondary} onClick={logout}>
              Выйти
            </button>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Дата и время</th>
                <th>Почта</th>
                <th>Результат</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={4} className={styles.empty}>Пока нет записей</td>
                </tr>
              ) : entries.map(entry => (
                <tr key={entry.id}>
                  <td>{formatDate(entry.at)}</td>
                  <td>{entry.email || '—'}</td>
                  <td>
                    <span className={entry.success ? styles.ok : styles.fail}>
                      {entry.success ? 'Успешно' : 'Отказ'}
                    </span>
                  </td>
                  <td>{entry.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
