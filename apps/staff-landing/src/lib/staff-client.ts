const STORAGE_KEY = 'staff_session_token'

export function getStaffSessionToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function setStaffSessionToken(token: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (token) sessionStorage.setItem(STORAGE_KEY, token)
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // sessionStorage may be unavailable in some embedded contexts
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
