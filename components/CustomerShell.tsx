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

/** 卓が閉じている（来店受付前/会計後）間の待機画面(step17)。
 *  スタッフが「来店受付」するとRealtime経由でtables.open_sinceが更新され、
 *  客が何もしなくても自動的に注文画面へ切り替わる。 */
function ClosedTableScreen() {
  const storeName = useAppStore((s) => s.settings.storeName);
  return (
    <div
      style={{
        flex: 1,
        minHeight: "100dvh",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "var(--app-bg)",
      }}
    >
      <div aria-hidden className="ambient-wash" />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "360px",
          maxWidth: "100%",
          background: "var(--glass-strong)",
          backdropFilter: "blur(26px) saturate(180%)",
          WebkitBackdropFilter: "blur(26px) saturate(180%)",
          border: "1px solid var(--glass-edge)",
          borderRadius: "22px",
          padding: "32px 24px",
          boxShadow: "inset 0 1px 0 var(--glass-spec), var(--glass-shadow)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "13px", color: "var(--text-2)", marginBottom: "6px" }}>
          {storeName}
        </div>
        <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text)", marginBottom: "12px" }}>
          ただいま準備中です
        </div>
        <div style={{ fontSize: "14px", color: "var(--text-2)", lineHeight: 1.7 }}>
          スタッフが受付を行うと、この画面が
          <br />
          自動的にご注文画面へ切り替わります。
          <br />
          お近くのスタッフにお声がけください。
        </div>
      </div>
    </div>
  );
}

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
  const muteSound = useAppStore((s) => s.muteSound);
  const loading = isSupabaseConfigured() && !loaded;

  // 客用画面には通知音は不要（厨房/管理側だけの機能）。soundOnはこの端末の
  // ローカルstate（他端末には影響しない）で、既定値がONのままだと
  // 新規注文検知(hydrateのshouldBeep)等で意図せず鳴ってしまうため明示的に消す。
  useEffect(() => {
    muteSound();
  }, [muteSound]);
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

  // 卓の開閉状態(step17)。閉じている間は注文UIを出さず待機画面にする。
  // Supabase未設定(ローカル開発)は常に開扱い。開閉はRealtime(tables)で自動反映される。
  const currentTable = tables.find((t) => t.id === customerTableId);
  const tableClosed =
    isSupabaseConfigured() && !loading && currentTable != null && !currentTable.openSince;

  // 匿名認証完了・卓が決まり・合言葉があり・卓が開いていれば来店セッションを開始
  // （閉じている間はopen_sessionがサーバー側でも拒否するため呼ばない。
  //   スタッフが受付するとtableClosedがfalseに変わり、この効果が再実行されて自動接続する）
  useEffect(() => {
    if (loading || !authReady || !customerToken || !customerTableId || tableClosed) return;
    openSession();
  }, [loading, authReady, customerToken, customerTableId, tableClosed, openSession]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--app-bg)",
        fontFamily: FONT,
        color: "var(--text)",
        display: "flex",
        flexDirection: "column",
        letterSpacing: ".01em",
      }}
    >
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
        {loading ? <LoadingScreen /> : tableClosed ? <ClosedTableScreen /> : <CustomerOrder />}
      </main>
      <SupabaseSync />
      <AlertDialog />
      <Toast />
    </div>
  );
}
