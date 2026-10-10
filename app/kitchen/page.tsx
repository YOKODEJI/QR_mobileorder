import AdminAuthGate from "@/components/auth/AdminAuthGate";
import ThemeModeController from "@/components/ThemeModeController";
import KitchenShell from "@/components/KitchenShell";
import PwaController from "@/components/PwaController";

// 厨房タブレット専用の画面（docs/09-handy-mode.md）。ログイン必須。
export default function KitchenPage() {
  return (
    <>
      <ThemeModeController />
      <PwaController scope="/kitchen" />
      <AdminAuthGate label="厨房">
        <KitchenShell />
      </AdminAuthGate>
    </>
  );
}
