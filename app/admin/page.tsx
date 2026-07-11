import AdminShell from "@/components/AdminShell";
import AdminAuthGate from "@/components/auth/AdminAuthGate";

// 管理ツールの独立ページ。Supabase設定時はログイン必須。
export default function AdminPage() {
  return (
    <AdminAuthGate>
      <AdminShell />
    </AdminAuthGate>
  );
}
