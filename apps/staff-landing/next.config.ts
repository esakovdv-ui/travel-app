import type { NextConfig } from 'next'

// Кто имеет право показывать портал в iframe.
// STAFF_EXTRA_FRAME_ANCESTORS — список через пробел для локальной проверки
// встраивания (например «http://localhost:3004»). На проде не задавать.
const FRAME_ANCESTORS = [
  "'self'",
  'https://online.mosgortur.ru',
  'https://*.mosgortur.ru',
  ...(process.env.STAFF_EXTRA_FRAME_ANCESTORS ?? '').split(/\s+/).filter(Boolean),
].join(' ')

const NO_STORE_HEADERS = [
  // На iPhone после сетевого сбоя Safari может удержать битую HTML-оболочку
  // и не перепроверять её вовремя. Для входа и рабочих экранов staff-портала
  // это слишком рискованно, поэтому сами документы всегда запрашиваем заново.
  { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
  { key: 'Pragma', value: 'no-cache' },
  { key: 'Expires', value: '0' },
]

const config: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `frame-ancestors ${FRAME_ANCESTORS}`,
          },
          // Портал всегда за HTTPS — фиксируем это для браузера на год.
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Не утекаем путь с параметрами поиска на сторонние домены (Яндекс, Tourvisor).
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), payment=()',
          },
        ],
      },
      {
        source: '/',
        headers: NO_STORE_HEADERS,
      },
      {
        source: '/tours',
        headers: NO_STORE_HEADERS,
      },
      {
        source: '/admin',
        headers: NO_STORE_HEADERS,
      },
    ]
  },
}

export default config
