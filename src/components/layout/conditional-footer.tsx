'use client';
import { usePathname } from 'next/navigation';
import { SiteFooter } from './site-footer';

const FULLSCREEN_PATHS = ['/tours', '/hotels'];

export function ConditionalFooter() {
  const pathname = usePathname();
  if (FULLSCREEN_PATHS.some(p => pathname.startsWith(p))) return null;
  return <SiteFooter />;
}
