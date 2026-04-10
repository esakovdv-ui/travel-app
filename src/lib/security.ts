const encoder = new TextEncoder();

export async function hashPassword(password: string) {
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
  return Buffer.from(buffer).toString('hex');
}

export async function verifyPassword(password: string, hash: string) {
  const nextHash = await hashPassword(password);
  return nextHash === hash;
}
