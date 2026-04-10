const encoder = new TextEncoder();

function toBase64Url(value: string) {
  return Buffer.from(value).toString('base64url');
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

export async function createJwtToken(payload: Record<string, string>, secret: string) {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = toBase64Url(JSON.stringify(payload));
  const signature = await signPayload(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}
