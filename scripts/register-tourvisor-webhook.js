#!/usr/bin/env node
/**
 * Регистрация webhook Tourvisor для заявок → motrip.ru
 * Запуск: TOURVISOR_AUTHKEY=... node scripts/register-tourvisor-webhook.js
 */
const authkey = process.env.TOURVISOR_AUTHKEY;
const webhookUrl =
  process.env.TOURVISOR_WEBHOOK_URL || 'https://motrip.ru/api/tourvisor-order-webhook';

if (!authkey) {
  console.error('Set TOURVISOR_AUTHKEY');
  process.exit(1);
}

async function main() {
  const response = await fetch('https://tourvisor.ru/xml/webhooks.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authkey, url: webhookUrl }),
  });
  const text = await response.text();
  console.log('status:', response.status);
  console.log(text);
  if (!response.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
