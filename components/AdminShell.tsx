"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase";
import SegmentedControl from "@/components/ui/SegmentedControl";
import SettingsSheet from "@/components/settings/SettingsSheet";
import AlertDialog from "@/components/ui/AlertDialog";
import Toast from "@/components/ui/Toast";
import KitchenDisplay from "@/components/kitchen/KitchenDisplay";
import StaffCheckout from "@/components/staff/StaffCheckout";
import MenuManagement from "@/components/menu/MenuManagement";
import CheckoutHistory from "@/components/history/CheckoutHistory";
import SupabaseSync from "@/components/SupabaseSync";
import LoadingScreen from "@/components/ui/LoadingScreen";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', var(--font-noto-sans-jp), 'Noto Sans JP', sans-serif";

/** 管理ツールの独立ページ（ログイン必須にする対象。厨房/会計/メニュー/履歴+設定を集約） */
export default function AdminShell() {
  const storeName = useAppStore((s) => s.settings.storeName);
  const theme = useAppStore((s) => s.settings.theme);
  const mgmtTab = useAppStore((s) => s.mgmtTab);
  const setMgmt = useAppStore((s) => s.setMgmt);
  const openSettings = useAppStore((s) => s.openSettings);
  const loaded = useAppStore((s) => s.loaded);
  const loading = isSupabaseConfigured() && !loaded;

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", theme);
  }, [theme]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--app-bg)",
        fontFamily: FONT,
        color: "var(--text)",
        display: "flex",
        flexDirection: "column",
        letterSpacing: ".01em",
      }}
    >
      <header
        className="no-print"
        style={{
          margin: "10px 10px 0",
          borderRadius: "22px",
          background: "var(--glass)",
          backdropFilter: "blur(26px) saturate(180%)",
          WebkitBackdropFilter: "blur(26px) saturate(180%)",
          border: "1px solid var(--glass-edge)",
          boxShadow: "inset 0 1px 0 var(--glass-spec), var(--glass-shadow)",
          position: "sticky",
          top: "10px",
          zIndex: 30,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "9px", padding: "12px 22px 0" }}>
          <span style={{ fontWeight: 800, fontSize: "21px", letterSpacing: "-.02em" }}>
            {storeName}
          </span>
          <span style={{ fontSize: "12px", color: "var(--text-2)" }}>管理ツール</span>
        </div>
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 14px 10px" }}>
          <SegmentedControl
            segments={[
              { value: "kitchen", label: "厨房" },
              { value: "staff", label: "テーブル / 会計" },
              { value: "menu", label: "メニュー管理" },
              { value: "history", label: "会計履歴" },
            ]}
            value={mgmtTab}
            onChange={setMgmt}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "0 22px 12px" }}>
          {isSupabaseConfigured() && (
            <button
              onClick={() => getSupabase()?.auth.signOut()}
              style={{
                padding: "8px 14px",
                borderRadius: "999px",
                border: "none",
                background: "var(--control-tint)",
                color: "var(--text-2)",
                fontFamily: "inherit",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ログアウト
            </button>
          )}
          <button
            onClick={openSettings}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "999px",
              border: "none",
              background: "var(--control-tint)",
              color: "var(--text)",
              fontFamily: "inherit",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: "14px" }}>⚙︎</span>設定
          </button>
        </div>
      </header>

      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {loading ? (
          <LoadingScreen />
        ) : (
          <>
            {mgmtTab === "kitchen" && <KitchenDisplay />}
            {mgmtTab === "staff" && <StaffCheckout />}
            {mgmtTab === "menu" && <MenuManagement />}
            {mgmtTab === "history" && <CheckoutHistory />}
          </>
        )}
      </main>

      <SupabaseSync />
      <SettingsSheet />
      <AlertDialog />
      <Toast />
    </div>
  );
}
