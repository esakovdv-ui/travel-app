import type { Metadata } from 'next';
import { VlasevoPromoAdminClient } from './vlasevo-promo-admin-client';

export const metadata: Metadata = {
  title: 'Админка Власьево Промо',
};

export default function VlasevoPromoAdminPage() {
  return <VlasevoPromoAdminClient />;
}
