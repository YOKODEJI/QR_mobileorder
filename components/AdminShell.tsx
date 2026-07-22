"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase";
import { GearIcon } from "@/components/ui/Icon";
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
import { useSwipeCategory } from "@/lib/useSwipeCategory";
import type { AppState } from "@/store/useAppStore";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', var(--font-noto-sans-jp), 'Noto Sans JP', sans-serif";

// SegmentedControlの並び順と一致させる（左右スワイプでの前後移動がタブ表示順と揃うように）
const MGMT_TABS: AppState["mgmtTab"][] = ["kitchen", "staff", "menu", "history"];

/** 管理ツールの独立ページ（ログイン必須にする対象。厨房/会計/メニュー/履歴+設定を集約） */
export default function AdminShell() {
  const storeName = useAppStore((s) => s.settings.storeName);
  const theme = useAppStore((s) => s.settings.theme);
  const mgmtTab = useAppStore((s) => s.mgmtTab);
  const setMgmt = useAppStore((s) => s.setMgmt);
  const openSettings = useAppStore((s) => s.openSettings);
  const loaded = useAppStore((s) => s.loaded);
  const syncSoundPref = useAppStore((s) => s.syncSoundPref);
  const loading = isSupabaseConfigured() && !loaded;

  const tabSwipe = useSwipeCategory({
    categories: MGMT_TABS,
    current: mgmtTab,
    onChange: (v) => setMgmt(v as AppState["mgmtTab"]),
  });

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", theme);
  }, [theme]);

  // 通知音ON/OFFは端末ローカル設定。Zustandの初期値は既定値(ON)固定なので、
  // マウント時に一度だけlocalStorageの実際の値へ同期する。
  useEffect(() => {
    syncSoundPref();
  }, [syncSoundPref]);

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
      {/* ガラスは背後に何か無いと透明感が見えない。画面全体を覆う連続的な階調を
          固定で敷き、スクロールしてもどの位置でも屈折が視認できるようにする
          （隅に光を数点置くだけだとスクロールで通り過ぎた瞬間ガラスが死んで見える）。 */}
      <div aria-hidden className="no-print ambient-wash" />
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
        {/* 店名/タブ/ログアウト・設定を1つの折り返し可能な横並びにして縦を圧縮する。
            幅が十分あれば1行(3列相当)に収まり、狭い画面では自然に2列・1列へ折り返す。 */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            padding: "10px 16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexShrink: 0 }}>
            <span style={{ fontWeight: 800, fontSize: "18px", letterSpacing: "-.02em", whiteSpace: "nowrap" }}>
              {storeName}
            </span>
            <span style={{ fontSize: "11px", color: "var(--text-2)", whiteSpace: "nowrap" }}>管理ツール</span>
          </div>

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

          <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
            {isSupabaseConfigured() && (
              <button
                onClick={() => getSupabase()?.auth.signOut()}
                style={{
                  padding: "7px 14px",
                  borderRadius: "999px",
                  border: "none",
                  background: "var(--control-tint)",
                  color: "var(--text-2)",
                  fontFamily: "inherit",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
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
                padding: "7px 14px",
                borderRadius: "999px",
                border: "none",
                background: "var(--control-tint)",
                color: "var(--text)",
                fontFamily: "inherit",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <GearIcon size={15} />設定
            </button>
          </div>
        </div>
      </header>

      <main
        onTouchStart={tabSwipe.onTouchStart}
        onTouchEnd={tabSwipe.onTouchEnd}
        style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}
      >
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
