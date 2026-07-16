"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { isSupabaseConfigured, ensureAnonymousSession } from "@/lib/supabase";
import CustomerOrder from "@/components/customer/CustomerOrder";
import AlertDialog from "@/components/ui/AlertDialog";
import Toast from "@/components/ui/Toast";
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
  // 匿名認証(signInAnonymously)完了フラグ。auth.uid()が要るopen_sessionより先に済ませる。
  // 未設定時はそもそも不要なのでtrue扱い。
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured());

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", theme);
  }, [theme]);

  // 匿名認証: これにより注文状況(orders/staff_calls)を自分の卓分だけ閲覧できる
  // (has_table_session()経由のRLS)。失敗しても注文自体(token方式)は引き続き可能。
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    ensureAnonymousSession().finally(() => {
      if (!cancelled) setAuthReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  // 匿名認証完了・卓が決まり・合言葉があれば来店セッションを開始（session_token 取得）
  useEffect(() => {
    if (loading || !authReady || !customerToken || !customerTableId) return;
    openSession();
  }, [loading, authReady, customerToken, customerTableId, openSession]);

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
      <Toast />
    </div>
  );
}
