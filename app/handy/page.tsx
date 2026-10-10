import AdminAuthGate from "@/components/auth/AdminAuthGate";
import ThemeModeController from "@/components/ThemeModeController";
import HandyShell from "@/components/handy/HandyShell";
import PwaController from "@/components/PwaController";

// スタッフのスマホ用ハンディ（docs/09-handy-mode.md）。ログイン必須。
export default function HandyPage() {
  return (
    <>
      <ThemeModeController />
      <PwaController scope="/handy" />
      <AdminAuthGate label="ハンディ">
        <HandyShell />
      </AdminAuthGate>
    </>
  );
}
