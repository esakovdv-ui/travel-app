type LogLevel = 'info' | 'warn' | 'error';

type LogPayload = Record<string, string | number | boolean | null | undefined>;

export function logEvent(level: LogLevel, event: string, payload: LogPayload) {
  const entry = {
    level,
    event,
    payload,
    timestamp: new Date().toISOString()
  };

  if (level === 'error') {
    console.error(JSON.stringify(entry));
    return;
  }

  if (level === 'warn') {
    console.warn(JSON.stringify(entry));
    return;
  }

  console.info(JSON.stringify(entry));
}
