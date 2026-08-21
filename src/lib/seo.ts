import type { Metadata } from 'next';
import { APP_DESCRIPTION, APP_NAME, DEFAULT_OG_IMAGE } from './constants';

type SeoInput = {
  title: string;
  description?: string;
  path?: string;
};

export function buildMetadata({ title, description = APP_DESCRIPTION, path = '/' }: SeoInput): Metadata {
  const absolutePath = path.startsWith('/') ? path : `/${path}`;
  const fullTitle = title === APP_NAME ? title : `${title} | ${APP_NAME}`;
  // На проде NEXT_PUBLIC_APP_URL может быть не задан — тогда canonical и og:image
  // уезжали на localhost:3000, и превью ссылки в мессенджерах не отрисовывалось.
  // В продакшен-сборке падаем на боевой домен, а не на localhost.
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.NODE_ENV === 'production' ? 'https://motrip.ru' : 'http://localhost:3000');

  return {
    metadataBase: new URL(appUrl),
    title: fullTitle,
    description,
    alternates: { canonical: absolutePath },
    openGraph: {
      title: fullTitle,
      description,
      url: absolutePath,
      siteName: APP_NAME,
      type: 'website',
      images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: APP_NAME }]
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [DEFAULT_OG_IMAGE]
    }
  };
}
