import type { Metadata } from 'next';
import { RadugaAdminClient } from './raduga-admin-client';

export const metadata: Metadata = {
  title: 'Админка Радуги',
};

export default function RadugaAdminPage() {
  return <RadugaAdminClient />;
}
