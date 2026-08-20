'use client';
import { usePathname } from 'next/navigation';

const FULLSCREEN_PATHS = ['/tours', '/hotels'];

/**
 * Футер принимаем слотом, а не импортируем напрямую: SiteFooter читает
 * список направлений из файла через fs, и при прямом импорте он попадал бы
 * в клиентский бандл вместе с этой клиентской обёрткой (Module not found: fs).
 */
export function ConditionalFooter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (FULLSCREEN_PATHS.some((p) => pathname.startsWith(p))) return null;
  return <>{children}</>;
}
