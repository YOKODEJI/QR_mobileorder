import AdminAuthGate from "@/components/auth/AdminAuthGate";
import ThemeModeController from "@/components/ThemeModeController";
import KitchenShell from "@/components/KitchenShell";

// 厨房タブレット専用の画面（docs/09-handy-mode.md）。ログイン必須。
export default function KitchenPage() {
  return (
    <>
      <ThemeModeController />
      <AdminAuthGate label="厨房">
        <KitchenShell />
      </AdminAuthGate>
    </>
  );
}
