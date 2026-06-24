import type { NextConfig } from 'next'

const config: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://online.mosgortur.ru https://*.mosgortur.ru",
          },
        ],
      },
    ]
  },
}

export default config
