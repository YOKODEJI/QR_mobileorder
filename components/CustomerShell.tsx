"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { isSupabaseConfigured, ensureAnonymousSession } from "@/lib/supabase";
import { customerDraft } from "@/lib/handyDraft";
import CustomerOrder from "@/components/customer/CustomerOrder";
import AlertDialog from "@/components/ui/AlertDialog";
import Toast from "@/components/ui/Toast";
import SupabaseSync from "@/components/SupabaseSync";
import LoadingScreen from "@/components/ui/LoadingScreen";

const FONT = "var(--font-ui)";

/** 卓が閉じている（来店受付前/会計後）間の待機画面(step17)。
 *  スタッフが「来店受付」するとRealtime経由でtables.open_sinceが更新され、
 *  客が何もしなくても自動的に注文画面へ切り替わる。
 *  バナーやポップアップではなく、その場に留まる全画面の案内であることを
 *  はっきりさせるためシンプルな1枚の画面にしているが、色自体は他の画面と
 *  同じくライト/ダーク設定に追従する（トークン参照。固定白黒にはしない）。 */
function ClosedTableScreen() {
  const storeName = useAppStore((s) => s.settings.storeName);
  const headerPhoto = useAppStore((s) => s.settings.headerPhoto);
  const showHeaderPhoto = useAppStore((s) => s.settings.showHeaderPhoto);
  return (
    <div
      style={{
        flex: 1,
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
        background: "var(--app-bg)",
        color: "var(--text)",
      }}
    >
      <div style={{ width: "380px", maxWidth: "100%", textAlign: "center" }}>
        {/* 注文画面と同じヘッダー写真を流用し、待機中でも店舗の世界観を保つ。
            設定でヘッダー表示がONかつ画像がある場合のみ出す（注文画面と同条件）。 */}
        {showHeaderPhoto && headerPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={headerPhoto}
            alt=""
            style={{
              width: "100%",
              height: "120px",
              objectFit: "cover",
              borderRadius: "16px",
              marginBottom: "20px",
              display: "block",
            }}
          />
        )}

        {storeName && (
          <div
            style={{
              fontSize: "17px",
              fontWeight: 800,
              color: "var(--text)",
              letterSpacing: ".02em",
              marginBottom: "20px",
            }}
          >
            {storeName}
          </div>
        )}

        {/* 通常の状態ではないことが一目で伝わるよう、警告色で状態名を出す。
            色は systemRed(--red) だと強すぎるため、警告として落ち着く
            オレンジ(iOS systemOrange相当)を使う。 */}
        <div
          style={{
            fontSize: "26px",
            fontWeight: 800,
            letterSpacing: ".08em",
            color: "#f26c3a",
            marginBottom: "16px",
          }}
        >
          ERROR
        </div>

        <h1
          style={{
            fontSize: "20px",
            fontWeight: 800,
            lineHeight: 1.5,
            margin: "0 0 10px",
            // 3行に割れて頭でっかちに見えるのを防ぐ（対応ブラウザでは行長を均等化）
            textWrap: "balance",
          }}
        >
          ただいま、こちらの席では
          <br />
          ご注文を承っておりません
        </h1>

        <p style={{ fontSize: "14px", lineHeight: 1.8, color: "var(--text-2)", margin: "0 0 24px" }}>
          スタッフの受付が完了しますと、
          <br />
          この画面は自動的にご注文画面へ切り替わります。
        </p>

        <div
          style={{
            textAlign: "left",
            background: "var(--chip-tint)",
            borderRadius: "14px",
            padding: "16px 18px",
            fontSize: "13px",
            lineHeight: 1.8,
            color: "var(--text-2)",
            marginBottom: "24px",
          }}
        >
          <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: "6px" }}>
            考えられる原因
          </div>
          {/* 「・」を行頭に置く日本語の箇条書き。ぶら下げインデントにして
              折り返した2行目が「・」の位置に潜り込まないようにする。 */}
          {[
            "お会計が完了した直後で、次のお客様のご案内前です",
            "スタッフによる受付がまだ行われていません",
          ].map((line) => (
            <div key={line} style={{ paddingLeft: "1em", textIndent: "-1em" }}>
              ・{line}
            </div>
          ))}
        </div>

        <p style={{ fontSize: "14px", fontWeight: 700, lineHeight: 1.7, margin: 0 }}>
          恐れ入りますが、
          <br />
          お近くのスタッフまでお声がけください。
        </p>
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
  const restoreCart = useAppStore((s) => s.restoreCart);
  const loading = isSupabaseConfigured() && !loaded;
  const draftChecked = useRef(false);

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

  // カートの中身は、変わるたびにこの端末へ控える。画面を下に引いて再読み込みになったり、
  // 別のアプリから戻ってページが読み直されたりしても、選んだ品が消えないようにする。
  // 控えは卓と「どの着席か」（来店受付の時刻）ごと。会計後に次の方が同じ卓に座っても引き継がない。
  const seat = currentTable?.openSince ?? "";
  useEffect(
    () =>
      useAppStore.subscribe((st, prev) => {
        // 控えを戻す前の「空のカート」で、残っている控えを消してしまわない
        if (st.cart === prev.cart || !draftChecked.current || !st.customerTableId) return;
        const t = st.tables.find((x) => x.id === st.customerTableId);
        customerDraft.save({ tableId: st.customerTableId, cart: st.cart, seat: t?.openSince ?? "" });
      }),
    []
  );
  // 会計などで卓が閉じられたら、控えも捨てる（次に開いたときに前の内容を出さない）
  useEffect(() => {
    if (tableClosed) customerDraft.clear();
  }, [tableClosed]);
  useEffect(() => {
    if (loading || !customerTableId || tableClosed) return;
    // 読み込みが終わって卓が決まった直後に1回だけ。描画の途中で状態を変えないよう、ひと呼吸おいて行う
    const timer = window.setTimeout(() => {
      if (draftChecked.current) return;
      draftChecked.current = true;
      const draft = customerDraft.load();
      if (!draft) return;
      if (draft.tableId !== customerTableId || (draft.seat ?? "") !== seat) {
        customerDraft.clear();
        return;
      }
      restoreCart(draft.cart);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loading, customerTableId, tableClosed, seat, restoreCart]);

  return (
    <div
      className="customer-ui"
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
