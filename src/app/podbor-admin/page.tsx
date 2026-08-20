import type { Metadata } from 'next';
import { PodborAdminClient } from './podbor-admin-client';

export const metadata: Metadata = {
  title: 'Админка подбора /podbor',
  robots: { index: false, follow: false },
};

export default function PodborAdminPage() {
  return <PodborAdminClient />;
}
