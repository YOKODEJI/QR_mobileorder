import AdminAuthGate from "@/components/auth/AdminAuthGate";
import ThemeModeController from "@/components/ThemeModeController";
import HandyShell from "@/components/handy/HandyShell";

// スタッフのスマホ用ハンディ（docs/09-handy-mode.md）。ログイン必須。
export default function HandyPage() {
  return (
    <>
      <ThemeModeController />
      <AdminAuthGate label="ハンディ">
        <HandyShell />
      </AdminAuthGate>
    </>
  );
}
