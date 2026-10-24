"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/store/useAppStore";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase";
import { loadDraft, saveDraft, clearDraft } from "@/lib/handyDraft";
import SupabaseSync from "@/components/SupabaseSync";
import AlertDialog from "@/components/ui/AlertDialog";
import Toast from "@/components/ui/Toast";
import LoadingScreen from "@/components/ui/LoadingScreen";
import TableGrid from "@/components/handy/TableGrid";
import TableView from "@/components/handy/TableView";
import OrderEntry from "@/components/handy/OrderEntry";
import TableEditSheet from "@/components/handy/TableEditSheet";
import SentView, { type SentLine } from "@/components/handy/SentView";
import { PHONE_MAX_WIDTH, glassBar, smallButton } from "@/components/handy/ui";
import { STAFF_CAN_EDIT_TABLES } from "@/lib/storeRules";
import { useBackGuard, useBackHandler } from "@/lib/backGuard";
import UpdateNotice from "@/components/UpdateNotice";

type View =
  | { name: "tables" }
  | { name: "table"; id: string }
  | { name: "order"; id: string }
  | { name: "sent"; id: string; lines: SentLine[] };

/** スタッフのスマホ用ハンディ（/handy）。卓一覧 → 卓 → 注文入力 → 送信の完了 の4画面。金額は一切出さない。
 *  スマホで使う前提（片手・縦持ち）。見た目は視認性を最優先にする */
export default function HandyShell() {
  const storeName = useAppStore((s) => s.settings.storeName);
  const theme = useAppStore((s) => s.settings.theme);
  const loaded = useAppStore((s) => s.loaded);
  const tableName = useAppStore((s) => s.tableName);
  const selectStaffTable = useAppStore((s) => s.selectStaffTable);
  const resetStaffCart = useAppStore((s) => s.resetStaffCart);
  const restoreStaffCart = useAppStore((s) => s.restoreStaffCart);
  const pushToast = useAppStore((s) => s.pushToast);
  const muteSound = useAppStore((s) => s.muteSound);
  const staffRole = useAppStore((s) => s.staffRole);
  const loading = isSupabaseConfigured() && !loaded;
  const [view, setView] = useState<View>({ name: "tables" });
  const [editingTables, setEditingTables] = useState(false);
  // 入力中の注文（staffCart）がどの卓のものか。別の卓の注文入力に入ったら持ち越さない
  const cartOwner = useRef<string | null>(null);
  const draftChecked = useRef(false);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", theme);
  }, [theme]);

  // 他のスタッフの注文が入るたびにスマホが鳴るのは邪魔なので、ハンディでは通知音を使わない
  useEffect(() => {
    muteSound();
  }, [muteSound]);

  // 入力中の注文は、変わるたびにこの端末へ控える（画面を下に引いて再読み込みになっても消えないように）
  useEffect(
    () =>
      useAppStore.subscribe((st, prev) => {
        if (st.staffCart === prev.staffCart && st.staffNotes === prev.staffNotes) return;
        if (cartOwner.current) saveDraft(cartOwner.current, st.staffCart, st.staffNotes);
      }),
    []
  );

  // 開き直したとき、控えがあれば注文入力の続きに戻す（卓が消えた・閉じられたあとの控えは捨てる）
  useEffect(() => {
    if (loading) return;
    // 読み込みが終わった直後に1回だけ。描画の途中で画面を切り替えないよう、ひと呼吸おいて行う
    const timer = window.setTimeout(() => {
      if (draftChecked.current) return;
      draftChecked.current = true;
      const draft = loadDraft();
      if (!draft) return;
      const table = useAppStore.getState().tables.find((t) => t.id === draft.tableId);
      if (!table || (isSupabaseConfigured() && !table.openSince)) {
        clearDraft();
        return;
      }
      cartOwner.current = draft.tableId;
      restoreStaffCart(draft.cart, draft.notes);
      if (Object.keys(useAppStore.getState().staffCart).length === 0) {
        cartOwner.current = null;
        clearDraft();
        return;
      }
      selectStaffTable(draft.tableId);
      setView({ name: "order", id: draft.tableId });
      pushToast(`${table.name} の入力中だった注文を戻しました`);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loading, restoreStaffCart, selectStaffTable, pushToast]);

  const openTableView = (id: string) => {
    selectStaffTable(id);
    setView({ name: "table", id });
  };
  const openOrder = (id: string) => {
    selectStaffTable(id);
    if (cartOwner.current !== id) resetStaffCart();
    cartOwner.current = id;
    setView({ name: "order", id });
  };
  const back = () => {
    if (view.name === "order") setView({ name: "table", id: view.id });
    else setView({ name: "tables" });
  };

  // 端末の「戻る」でアプリが閉じないようにし、奥の画面から1つずつ戻る（注文入力 → 卓 → 卓一覧）
  useBackGuard();
  useBackHandler(view.name !== "tables", back);

  const title =
    view.name === "tables"
      ? storeName
      : view.name === "table"
        ? tableName(view.id)
        : view.name === "sent"
          ? "送信完了"
          : `${tableName(view.id)} の注文`;
  // 卓の編集ができる役割は店の決まり（lib/storeRules.ts。DBのポリシーと合わせること）。
  // 役割が分からない＝Supabase未設定のローカルでは出す
  const canEditTables =
    view.name === "tables" &&
    !loading &&
    (staffRole === "owner" || staffRole === null || (STAFF_CAN_EDIT_TABLES && staffRole === "staff"));

  return (
    <div
      className="handy"
      data-view={view.name}
      style={{
        minHeight: "100dvh",
        maxWidth: PHONE_MAX_WIDTH,
        margin: "0 auto",
        background: "var(--app-bg)",
        color: "var(--text)",
        display: "flex",
        flexDirection: "column",
        // 種類の切替で横にずらした一覧がはみ出しても、横スクロールにしない（clip は sticky を壊さない）
        overflowX: "clip",
      }}
    >
      {/* すりガラスの背後に敷く、店の色の光 */}
      <div aria-hidden className="ambient-wash" />
      <header
        style={{
          ...glassBar,
          position: "sticky",
          top: 0,
          zIndex: 30,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          height: "var(--handy-header-h)",
          padding: "env(safe-area-inset-top) 12px 0",
          borderBottom: "1px solid var(--glass-edge)",
          boxShadow: "inset 0 1px 0 var(--glass-spec)",
        }}
      >
        {view.name !== "tables" && (
          <button onClick={back} aria-label="戻る" style={{ ...smallButton, paddingLeft: "10px" }}>
            <span aria-hidden style={{ fontSize: "20px", lineHeight: 1, marginRight: "2px" }}>
              ‹
            </span>
            戻る
          </button>
        )}
        {/* 卓一覧では屋号を店の書体で出す。ほかの画面は卓名を大きく */}
        <h1
          className={view.name === "tables" ? "brand-name" : undefined}
          style={{
            flex: 1,
            minWidth: 0,
            margin: 0,
            ...(view.name === "tables" ? {} : { fontWeight: 800, fontSize: "21px" }),
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </h1>
        {canEditTables && (
          <button onClick={() => setEditingTables(true)} style={smallButton}>
            卓の編集
          </button>
        )}
        {view.name === "tables" && isSupabaseConfigured() && (
          <button
            onClick={() => getSupabase()?.auth.signOut()}
            style={{ ...smallButton, border: "none", background: "transparent", boxShadow: "none", color: "var(--text-2)", padding: "8px 4px" }}
          >
            ログアウト
          </button>
        )}
      </header>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>
        {loading ? (
          <LoadingScreen />
        ) : staffRole === "kitchen" ? (
          <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--text-2)", lineHeight: 1.7 }}>
            厨房用のアカウントではハンディは使えません。
            <br />
            厨房の画面は <Link href="/kitchen" style={{ color: "var(--accent)", fontWeight: 700 }}>/kitchen</Link> です。
          </div>
        ) : view.name === "tables" ? (
          <TableGrid onOpenTable={openTableView} onOrder={openOrder} />
        ) : view.name === "table" ? (
          <TableView
            tableId={view.id}
            onOrder={() => openOrder(view.id)}
            onMoved={(to) => {
              // 移動先で注文入力を続けられるよう、入力中の注文も新しい卓のものとして引き継ぐ
              if (cartOwner.current === view.id) {
                cartOwner.current = to;
                const st = useAppStore.getState();
                saveDraft(to, st.staffCart, st.staffNotes);
              }
              openTableView(to);
            }}
            onClosedTable={() => setView({ name: "tables" })}
          />
        ) : view.name === "sent" ? (
          <SentView
            tableName={tableName(view.id)}
            lines={view.lines}
            onTables={() => setView({ name: "tables" })}
            onTable={() => openTableView(view.id)}
            onMore={() => openOrder(view.id)}
          />
        ) : (
          <OrderEntry tableId={view.id} onSent={(lines) => setView({ name: "sent", id: view.id, lines })} />
        )}
      </main>

      {editingTables && <TableEditSheet onClose={() => setEditingTables(false)} />}

      <SupabaseSync staff />
      <UpdateNotice />
      <AlertDialog />
      <Toast />
    </div>
  );
}
