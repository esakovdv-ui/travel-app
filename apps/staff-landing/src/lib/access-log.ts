import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

export type AccessLogEntry = {
  id: string
  at: string
  email: string
  success: boolean
  ip: string | null
  userAgent: string | null
}

const LOG_DIR = process.env.STAFF_ACCESS_LOG_DIR ?? path.join(process.cwd(), 'data')
const LOG_FILE = path.join(LOG_DIR, 'staff-access-log.json')

async function ensureLogFile(): Promise<AccessLogEntry[]> {
  await mkdir(LOG_DIR, { recursive: true })
  try {
    const raw = await readFile(LOG_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function save(entries: AccessLogEntry[]): Promise<void> {
  await mkdir(LOG_DIR, { recursive: true })
  await writeFile(LOG_FILE, JSON.stringify(entries, null, 2), 'utf8')
}

export function normalizeCredential(value: string): string {
  return value.trim().toLowerCase()
}

export async function appendAccessLog(entry: Omit<AccessLogEntry, 'id' | 'at'>): Promise<void> {
  const entries = await ensureLogFile()
  entries.unshift({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    email: normalizeCredential(entry.email),
    success: entry.success,
    ip: entry.ip,
    userAgent: entry.userAgent,
  })
  await save(entries.slice(0, 5000))
}

export async function listAccessLogs(limit = 200): Promise<AccessLogEntry[]> {
  const entries = await ensureLogFile()
  return entries.slice(0, Math.max(1, Math.min(limit, 5000)))
}
