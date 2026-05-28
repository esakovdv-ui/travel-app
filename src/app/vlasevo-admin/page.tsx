import type { Metadata } from 'next';
import { VlasevoAdminClient } from './vlasevo-admin-client';

export const metadata: Metadata = {
  title: 'Админка Власьево',
};

export default function VlasevoAdminPage() {
  return <VlasevoAdminClient />;
}
