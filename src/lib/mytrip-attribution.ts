export const MYTRIP_ORIGIN = 'https://mytrip.mosgortur.ru';
export const FIRST_TOUCH_COOKIE = 'motrip_first_touch';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

export function captureFirstTouch(params: URLSearchParams): string {
  // Ограничиваем размер URL-кодированных значений для сессионной cookie.
  const firstTouch = new URLSearchParams();
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (!value?.trim()) continue;
    let bounded = '';
    for (const character of value) {
      if (encodeURIComponent(bounded + character).length > 400) break;
      bounded += character;
    }
    firstTouch.set(key, bounded);
  }
  return firstTouch.toString() || 'direct';
}

function parseMytripUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.origin === MYTRIP_ORIGIN && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

export function mytripHandoff(href: string): string {
  const target = parseMytripUrl(href);
  return target ? '/go/mytrip?' + new URLSearchParams({ to: target.href }) : href;
}

export function mytripDestination(href: string, firstTouch = ''): URL | null {
  const target = parseMytripUrl(href);
  if (!target) return null;
  const params = new URLSearchParams(firstTouch);
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) target.searchParams.set(key, value);
  }
  return target;
}
