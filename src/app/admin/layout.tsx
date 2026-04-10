import { AdminSidebar } from '@/components/admin/admin-sidebar';
import styles from './admin-layout.module.css';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.layout}>
      <AdminSidebar />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
