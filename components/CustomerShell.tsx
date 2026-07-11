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
  const loading = isSupabaseConfigured() && !loaded;

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", theme);
  }, [theme]);

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
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {loading ? <LoadingScreen /> : <CustomerOrder />}
      </main>
      <SupabaseSync />
      <AlertDialog />
    </div>
  );
}
