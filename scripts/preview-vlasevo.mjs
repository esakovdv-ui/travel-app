#!/usr/bin/env node
/**
 * Локальный предпросмотр /vlasevo: поднимает next dev на свободном порту и открывает браузер.
 * Запуск: npm run vlasevo
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const START_PORT = Number(process.env.PORT) || 3000;
const MAX_PORT = START_PORT + 30;

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port);
  });
}

async function findFreePort(from) {
  for (let port = from; port <= MAX_PORT; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`Не найден свободный порт в диапазоне ${from}–${MAX_PORT}`);
}

function waitForPage(port, attempts = 90) {
  const url = `http://127.0.0.1:${port}/vlasevo`;
  return new Promise((resolve, reject) => {
    let left = attempts;
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) resolve(url);
        else if (--left > 0) setTimeout(tick, 500);
        else reject(new Error('Сервер не ответил вовремя'));
      });
      req.on('error', () => {
        if (--left > 0) setTimeout(tick, 500);
        else reject(new Error('Сервер не ответил вовремя'));
      });
      req.setTimeout(1500, () => req.destroy());
    };
    tick();
  });
}

function openBrowser(url) {
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
  const child = spawn(cmd, platform === 'win32' ? ['', url] : [url], {
    stdio: 'ignore',
    shell: platform === 'win32',
  });
  child.unref();
}

function startNext(port) {
  return spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['next', 'dev', '-p', String(port)],
    { cwd: ROOT, stdio: ['inherit', 'pipe', 'pipe'], env: { ...process.env, PORT: String(port) } },
  );
}

async function main() {
  const port = await findFreePort(START_PORT);
  const url = `http://localhost:${port}/vlasevo`;

  console.log(`\n→ Запускаю Next.js на порту ${port}...`);
  console.log(`→ Страница: ${url}\n`);

  const child = startNext(port);
  let opened = false;

  const shutdown = () => {
    if (!child.killed) child.kill('SIGTERM');
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  child.stdout?.on('data', (chunk) => {
    process.stdout.write(chunk);
    if (!opened && String(chunk).includes('Ready')) {
      opened = true;
      waitForPage(port)
        .then((readyUrl) => {
          console.log(`\n✓ Открываю в браузере: ${readyUrl}`);
          openBrowser(readyUrl);
          console.log('  Остановка сервера: Ctrl+C\n');
        })
        .catch((error) => console.error('\nНе удалось дождаться страницы:', error.message));
    }
  });

  child.stderr?.on('data', (chunk) => process.stderr.write(chunk));

  child.on('exit', (code) => {
    if (code && code !== 0 && !opened) {
      console.error(`\nNext.js завершился с кодом ${code}. Попробуйте: PORT=3005 npm run vlasevo`);
    }
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
