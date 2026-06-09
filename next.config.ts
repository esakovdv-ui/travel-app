import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: 6 * 1024 * 1024,
  },
  async rewrites() {
    return [
      {
        source: '/raduga',
        destination: '/raduga.html',
      },
      {
        source: '/vlasevo',
        destination: '/vlasevo.html',
      },
    ];
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com'
      }
    ]
  }
};

export default nextConfig;
