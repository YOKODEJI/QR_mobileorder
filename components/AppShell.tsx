"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import SegmentedControl from "@/components/ui/SegmentedControl";
import SettingsSheet from "@/components/settings/SettingsSheet";
import AlertDialog from "@/components/ui/AlertDialog";
import CustomerOrder from "@/components/customer/CustomerOrder";
import KitchenDisplay from "@/components/kitchen/KitchenDisplay";
import StaffCheckout from "@/components/staff/StaffCheckout";
import MenuManagement from "@/components/menu/MenuManagement";

export default function AppShell() {
  const storeName = useAppStore((s) => s.settings.storeName);
  const theme = useAppStore((s) => s.settings.theme);
  const topTab = useAppStore((s) => s.topTab);
  const mgmtTab = useAppStore((s) => s.mgmtTab);
  const setTop = useAppStore((s) => s.setTop);
  const setMgmt = useAppStore((s) => s.setMgmt);
  const openSettings = useAppStore((s) => s.openSettings);

  // テーマアクセントを CSS変数に反映
  useEffect(() => {
    document.documentElement.style.setProperty("--accent", theme);
  }, [theme]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f2f2f7",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', var(--font-noto-sans-jp), 'Noto Sans JP', sans-serif",
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
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "9px",
            padding: "12px 22px 0",
          }}
        >
          <span style={{ fontWeight: 800, fontSize: "21px", letterSpacing: "-.02em" }}>
            {storeName}
          </span>
          <span style={{ fontSize: "12px", color: "#8e8e93" }}>QRオーダー</span>
        </div>
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 14px" }}>
          <SegmentedControl
            segments={[
              { value: "customer", label: "客用 注文" },
              { value: "mgmt", label: "管理画面" },
            ]}
            value={topTab}
            onChange={setTop}
          />
        </div>
        {topTab === "mgmt" && (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "0 14px 10px",
              }}
            >
              <SegmentedControl
                segments={[
                  { value: "kitchen", label: "厨房" },
                  { value: "staff", label: "テーブル / 会計" },
                  { value: "menu", label: "メニュー管理" },
                ]}
                value={mgmtTab}
                onChange={setMgmt}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                padding: "0 22px 12px",
              }}
            >
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
          </>
        )}
      </header>

      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {topTab === "customer" && <CustomerOrder />}
        {topTab === "mgmt" && mgmtTab === "kitchen" && <KitchenDisplay />}
        {topTab === "mgmt" && mgmtTab === "staff" && <StaffCheckout />}
        {topTab === "mgmt" && mgmtTab === "menu" && <MenuManagement />}
      </main>

      <SettingsSheet />
      <AlertDialog />
    </div>
  );
}
