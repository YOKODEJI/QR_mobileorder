"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase";
import SupabaseSync from "@/components/SupabaseSync";
import AlertDialog from "@/components/ui/AlertDialog";
import Toast from "@/components/ui/Toast";
import LoadingScreen from "@/components/ui/LoadingScreen";
import TableGrid from "@/components/handy/TableGrid";
import TableView from "@/components/handy/TableView";
import OrderEntry from "@/components/handy/OrderEntry";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', var(--font-noto-sans-jp), 'Noto Sans JP', sans-serif";

type View = { name: "tables" } | { name: "table"; id: string } | { name: "order"; id: string };

/** スタッフのスマホ用ハンディ（/handy）。卓一覧 → 卓 → 注文入力 の3画面。金額は一切出さない */
export default function HandyShell() {
  const storeName = useAppStore((s) => s.settings.storeName);
  const theme = useAppStore((s) => s.settings.theme);
  const loaded = useAppStore((s) => s.loaded);
  const tableName = useAppStore((s) => s.tableName);
  const selectStaffTable = useAppStore((s) => s.selectStaffTable);
  const muteSound = useAppStore((s) => s.muteSound);
  const loading = isSupabaseConfigured() && !loaded;
  const [view, setView] = useState<View>({ name: "tables" });
  // 入力中の注文（staffCart）がどの卓のものか。別の卓の注文入力に入ったら持ち越さない
  const cartOwner = useRef<string | null>(null);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", theme);
  }, [theme]);

  // 他のスタッフの注文が入るたびにスマホが鳴るのは邪魔なので、ハンディでは通知音を使わない
  useEffect(() => {
    muteSound();
  }, [muteSound]);

  const openTableView = (id: string) => {
    selectStaffTable(id);
    setView({ name: "table", id });
  };
  const openOrder = (id: string) => {
    selectStaffTable(id);
    if (cartOwner.current !== id) useAppStore.setState({ staffCart: {}, staffNotes: {} });
    cartOwner.current = id;
    setView({ name: "order", id });
  };
  const back = () => {
    if (view.name === "order") setView({ name: "table", id: view.id });
    else setView({ name: "tables" });
  };

  const title =
    view.name === "tables" ? storeName : view.name === "table" ? tableName(view.id) : `${tableName(view.id)} の注文`;

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--app-bg)",
        fontFamily: FONT,
        color: "var(--text)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div aria-hidden className="ambient-wash" />
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 12px",
          background: "var(--glass)",
          backdropFilter: "blur(26px) saturate(180%)",
          WebkitBackdropFilter: "blur(26px) saturate(180%)",
          borderBottom: "1px solid var(--glass-edge)",
        }}
      >
        {view.name !== "tables" && (
          <button onClick={back} aria-label="戻る" style={headerButton}>
            ‹ 戻る
          </button>
        )}
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontWeight: 800,
            fontSize: "18px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </span>
        {view.name === "tables" && isSupabaseConfigured() && (
          <button onClick={() => getSupabase()?.auth.signOut()} style={{ ...headerButton, color: "var(--text-2)" }}>
            ログアウト
          </button>
        )}
      </header>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
        {loading ? (
          <LoadingScreen />
        ) : view.name === "tables" ? (
          <TableGrid onOpenTable={openTableView} onOrder={openOrder} />
        ) : view.name === "table" ? (
          <TableView tableId={view.id} onOrder={() => openOrder(view.id)} />
        ) : (
          <OrderEntry tableId={view.id} onSent={() => setView({ name: "table", id: view.id })} />
        )}
      </main>

      <SupabaseSync staff />
      <AlertDialog />
      <Toast />
    </div>
  );
}

const headerButton: React.CSSProperties = {
  flexShrink: 0,
  padding: "8px 12px",
  borderRadius: "999px",
  border: "none",
  background: "var(--control-tint)",
  color: "var(--text)",
  fontFamily: "inherit",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
};
