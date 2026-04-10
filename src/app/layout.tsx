import './globals.css';
import type { Metadata } from 'next';
import { Manrope, Unbounded } from 'next/font/google';
import { ConditionalFooter } from '@/components/layout/conditional-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { listPackages } from '@/lib/repositories';
import { buildMetadata } from '@/lib/seo';
import { AppProvider } from '@/context/app-context';
import { APP_NAME } from '@/lib/constants';

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-manrope',
  display: 'swap'
});

const unbounded = Unbounded({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-unbounded',
  display: 'swap'
});

export const metadata: Metadata = buildMetadata({
  title: APP_NAME
});

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const packages = await listPackages();

  return (
    <html lang="ru">
      <body className={`${manrope.variable} ${unbounded.variable}`}>
        <AppProvider initialPackages={packages}>
          <SiteHeader />
          {children}
          <ConditionalFooter />
        </AppProvider>
      </body>
    </html>
  );
}
