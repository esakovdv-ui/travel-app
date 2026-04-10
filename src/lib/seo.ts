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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

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
