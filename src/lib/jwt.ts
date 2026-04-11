const encoder = new TextEncoder();

function toBase64Url(value: string) {
  return Buffer.from(value).toString('base64url');
}

function fromBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

async function signPayload(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Buffer.from(signature).toString('base64url');
}

export async function createJwtToken(
  payload: Record<string, string>,
  secret: string,
  expiresInSeconds = 60 * 60 * 24 * 30 // 30 дней
): Promise<string> {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = toBase64Url(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  }));
  const signature = await signPayload(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}

export async function verifyJwtToken(
  token: string,
  secret: string
): Promise<Record<string, string> | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expected = await signPayload(`${header}.${body}`, secret);
    if (expected !== signature) return null;

    const payload = JSON.parse(fromBase64Url(body)) as Record<string, string | number>;
    const exp = payload.exp as number | undefined;
    if (exp && Math.floor(Date.now() / 1000) > exp) return null;

    return payload as Record<string, string>;
  } catch {
    return null;
  }
}
