const STORAGE_KEY = 'staff_session_token'

// Safari blocks sessionStorage in cross-origin iframes (ITP). Keep the token
// in memory so the Bearer header survives within a single page session.
let memoryToken: string | null = null

export function getStaffSessionToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? memoryToken
  } catch {
    return memoryToken
  }
}

export function setStaffSessionToken(token: string | null) {
  memoryToken = token
  if (typeof window === 'undefined') return
  try {
    if (token) sessionStorage.setItem(STORAGE_KEY, token)
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // sessionStorage unavailable — memoryToken is already set above
  }
}

export function staffAuthHeaders(): HeadersInit {
  const token = getStaffSessionToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function staffFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  const auth = staffAuthHeaders() as Record<string, string>
  Object.entries(auth).forEach(([key, value]) => {
    if (!headers.has(key)) headers.set(key, value)
  })

  return fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  })
}
