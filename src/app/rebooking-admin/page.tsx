import type { Metadata } from 'next';
import { RebookingAdminClient } from './rebooking-admin-client';

export const metadata: Metadata = {
  title: 'Админка перебронирования',
  robots: { index: false, follow: false },
};

export default function RebookingAdminPage() {
  return <RebookingAdminClient />;
}
