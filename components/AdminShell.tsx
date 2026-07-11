"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { isSupabaseConfigured } from "@/lib/supabase";
import SegmentedControl from "@/components/ui/SegmentedControl";
import SettingsSheet from "@/components/settings/SettingsSheet";
import AlertDialog from "@/components/ui/AlertDialog";
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
        background: "#f2f2f7",
        fontFamily: FONT,
        color: "#1c1c1e",
        display: "flex",
        flexDirection: "column",
        letterSpacing: ".01em",
        zoom: 1.07,
      }}
    >
      <header
        style={{
          background: "rgba(248,248,250,.82)",
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
          borderBottom: "1px solid rgba(0,0,0,.07)",
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "9px", padding: "12px 22px 0" }}>
          <span style={{ fontWeight: 800, fontSize: "21px", letterSpacing: "-.02em" }}>
            {storeName}
          </span>
          <span style={{ fontSize: "12px", color: "#8e8e93" }}>管理ツール</span>
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
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 22px 12px" }}>
          <button
            onClick={openSettings}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "999px",
              border: "none",
              background: "rgba(120,120,128,.12)",
              color: "#1c1c1e",
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
    </div>
  );
}
