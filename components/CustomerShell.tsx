"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { isSupabaseConfigured } from "@/lib/supabase";
import CustomerOrder from "@/components/customer/CustomerOrder";
import AlertDialog from "@/components/ui/AlertDialog";
import SupabaseSync from "@/components/SupabaseSync";
import LoadingScreen from "@/components/ui/LoadingScreen";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', var(--font-noto-sans-jp), 'Noto Sans JP', sans-serif";

/** 客用の独立ページ（QRの遷移先）。管理系タブは一切表示しない。 */
export default function CustomerShell({ table }: { table?: string }) {
  const theme = useAppStore((s) => s.settings.theme);
  const loaded = useAppStore((s) => s.loaded);
  const tables = useAppStore((s) => s.tables);
  const setCustomerTable = useAppStore((s) => s.setCustomerTable);
  const setCustomerToken = useAppStore((s) => s.setCustomerToken);
  const openSession = useAppStore((s) => s.openSession);
  const customerToken = useAppStore((s) => s.customerToken);
  const customerTableId = useAppStore((s) => s.customerTableId);
  const loading = isSupabaseConfigured() && !loaded;

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", theme);
  }, [theme]);

  // QRに埋め込んだ合言葉 ?k= を取り込む（=その卓の qr_token）
  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get("k");
    setCustomerToken(k);
  }, [setCustomerToken]);

  // URLの [table] を実際の卓に解決（id一致 / 「テーブル N」/ 名前一致 / N番目）
  useEffect(() => {
    if (loading || !table || tables.length === 0) return;
    const t =
      tables.find((x) => x.id === table) ??
      tables.find((x) => x.name === `テーブル ${table}`) ??
      tables.find((x) => x.name === table) ??
      tables[Number(table) - 1];
    if (t) setCustomerTable(t.id);
  }, [loading, table, tables, setCustomerTable]);

  // 卓が決まり合言葉があれば来店セッションを開始（session_token 取得）
  useEffect(() => {
    if (loading || !customerToken || !customerTableId) return;
    openSession();
  }, [loading, customerToken, customerTableId, openSession]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#f2f2f7",
        fontFamily: FONT,
        color: "#1c1c1e",
        display: "flex",
        flexDirection: "column",
        letterSpacing: ".01em",
      }}
    >
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
        {loading ? <LoadingScreen /> : <CustomerOrder />}
      </main>
      <SupabaseSync />
      <AlertDialog />
    </div>
  );
}
