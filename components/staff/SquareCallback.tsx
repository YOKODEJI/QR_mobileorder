"use client";

import { useEffect, useState } from "react";
import { dbCloseTable, dbPreviewCheckout } from "@/lib/data";
import { getSupabase, STORE_ID } from "@/lib/supabase";
import { parseSquarePosCallback } from "@/lib/squarePos";
import type { DiscountType } from "@/store/useAppStore";

type Phase = "processing" | "success" | "canceled" | "error" | "no-session";

type PendingCheckout = {
  tableId: string;
  tableName: string;
  discountType: DiscountType;
  discountValue: number;
  chargeEnabled: boolean;
  ts: number;
};

/** ペンディング情報の有効期限。localStorageはタブを閉じても残り続けるため、
 *  古い(=別の会計操作で上書きされずに放置された)エントリを誤って使わないための上限。 */
const PENDING_MAX_AGE_MS = 30 * 60 * 1000;

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', var(--font-noto-sans-jp), 'Noto Sans JP', sans-serif";

/** Square側に実際の決済を問い合わせて確認する（Edge Function square_verify_payment）。
 *  Square POSアプリのコールバックが返す status=ok / transaction_id は、しょせん
 *  ブラウザのクエリパラメータ＝クライアント側で自由に書き換え可能な値でしかない。
 *  これをそのまま信用してclose_tableを呼ぶと、URLを手で書き換えるだけで
 *  決済せずに会計を確定できてしまう（Codexレビューで指摘）。必ずサーバー側で
 *  Square access_tokenを使って裏取りしてから確定する。 */
async function verifySquarePayment(transactionId: string): Promise<{ verified: boolean; amountYen: number | null }> {
  const sb = getSupabase();
  if (!sb) return { verified: false, amountYen: null };
  const { data, error } = await sb.functions.invoke("square_verify_payment", {
    body: { storeId: STORE_ID, transactionId },
  });
  if (error || !data?.verified) return { verified: false, amountYen: null };
  return { verified: true, amountYen: (data.amountYen as number) ?? null };
}

/** Square POSアプリから戻ってきた直後に一度だけ表示される画面(step19)。
 *  ここで初めて当店側の会計(close_table)を確定する。localStorageに
 *  会計ボタンを押した時点で退避しておいた内容(卓・割引等)を、Square側の
 *  結果(state)と突き合わせて使う（ページ遷移でZustandの状態は失われるため）。
 *  sessionStorageではなくlocalStorageを使うのは、Android実機で確認した通り
 *  Square POSアプリからの戻り先が「別タブ」で開かれることがあり、タブ専用の
 *  sessionStorageでは会計開始時の情報を読めなくなるため（タブをまたいで
 *  共有されるlocalStorageなら読める）。
 *  ペンディング情報は、会計が実際に確定した時にだけ消す。
 *  失敗時に消してしまうと、リロードしても再試行できなくなるため。 */
export default function SquareCallback() {
  const [phase, setPhase] = useState<Phase>("processing");
  const [tableName, setTableName] = useState("");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = parseSquarePosCallback(window.location.search);

      if (result.status === "unknown") {
        if (!cancelled) setPhase("no-session");
        return;
      }

      const token = result.state;
      const raw = token && typeof localStorage !== "undefined" ? localStorage.getItem(`squarePosPending:${token}`) : null;

      if (!raw) {
        if (!cancelled) {
          setPhase("error");
          setDetail("この端末でお会計を開始した記録が見つかりませんでした。お会計が確定していない場合は、もう一度「Squareで決済する」からやり直してください。");
        }
        return;
      }
      const pending = JSON.parse(raw) as PendingCheckout;
      if (!cancelled) setTableName(pending.tableName);

      const clearPending = () => {
        if (typeof localStorage !== "undefined") localStorage.removeItem(`squarePosPending:${token}`);
      };

      if (Date.now() - (pending.ts ?? 0) > PENDING_MAX_AGE_MS) {
        clearPending();
        if (!cancelled) {
          setPhase("error");
          setDetail("お会計を開始してから時間が経ちすぎているため、この記録は無効になりました。決済が完了していないか確認の上、必要ならもう一度「Squareで決済する」からやり直してください。");
        }
        return;
      }

      if (result.status === "canceled") {
        clearPending(); // キャンセルは再試行の必要が無いのでここで消してよい
        if (!cancelled) setPhase("canceled");
        return;
      }
      if (result.status === "error") {
        clearPending();
        if (!cancelled) {
          setPhase("error");
          setDetail(result.errorCode ?? "不明なエラー");
        }
        return;
      }

      // ここから先は status=ok の場合。クライアント側の申告を信用せず、
      // Square側に実際の決済を確認してから確定する。
      if (!result.transactionId) {
        if (!cancelled) {
          setPhase("error");
          setDetail("Squareから取引IDを受け取れなかったため、お会計を確定できません。Squareダッシュボードで取引を確認の上、必要なら管理画面から手動対応してください。");
        }
        return; // ペンディングは消さない（原因を解消した上でこの画面をやり直せるように）
      }

      const verify = await verifySquarePayment(result.transactionId);
      if (cancelled) return;
      if (!verify.verified || verify.amountYen == null) {
        setPhase("error");
        setDetail("Square側で決済の確認が取れませんでした。少し待ってからこの画面を再読み込みするか、Squareダッシュボードで取引を確認してください。");
        return;
      }

      // 決済額と、現時点の未会計分から再計算した金額が一致するか確認する。
      // Square操作中に注文が追加/変更されていた場合、close_tableは現在の未会計分を
      // 元に再計算するため、決済額とズレたまま確定してしまう恐れがある(Codexレビューで指摘)。
      // 一致しない場合は自動確定せず、スタッフの手動確認に委ねる。
      const preview = await dbPreviewCheckout(pending.tableId, pending.discountType, pending.discountValue, pending.chargeEnabled);
      if (cancelled) return;
      if (!preview || preview.total !== verify.amountYen) {
        setPhase("error");
        setDetail(
          `Squareでの決済額（${verify.amountYen}円）と、現在の未会計分の合計が一致しないため、自動確定を止めました。決済自体は完了しています。管理画面の「テーブル / 会計」から内容を確認し、手動でお会計を確定してください。`
        );
        return; // ペンディングは消さない
      }

      // ここまで来て初めて当店側の会計を確定する（Square側の決済が検証できた後）
      const record = await dbCloseTable(pending.tableId, pending.discountType, pending.discountValue, pending.chargeEnabled);
      if (cancelled) return;
      if (!record) {
        setPhase("error");
        setDetail("Squareの決済は完了しましたが、当店側のお会計確定に失敗しました。この画面を再読み込みするか、管理画面の「テーブル / 会計」から手動で確認してください。");
        return; // ペンディングは消さない＝再読み込みで再試行できる
      }
      clearPending();
      setPhase("success");
      // 会計成功時はスタッフの操作を待たず自動的に管理画面へ戻る
      // （手動タップ待ちのままレジ前で放置される事故を避ける）。
      setTimeout(() => {
        if (!cancelled) window.location.href = "/admin";
      }, 1500);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const messages: Record<Phase, { title: string; body: string; color: string }> = {
    processing: { title: "処理中…", body: "Squareの決済結果を確認しています。", color: "var(--text)" },
    success: { title: "お会計が完了しました", body: tableName ? `${tableName} のセッションを締めました。` : "セッションを締めました。", color: "var(--green-dark, #1a7f37)" },
    canceled: { title: "決済がキャンセルされました", body: "お会計はまだ確定していません。テーブルは開いたままです。", color: "var(--text-2)" },
    error: { title: "エラーが発生しました", body: detail || "Square決済でエラーが発生しました。お会計はまだ確定していません。", color: "#f26c3a" },
    "no-session": { title: "Squareアプリからの応答がありません", body: "このページに直接アクセスした場合は、管理画面の「お会計」から操作してください。", color: "var(--text-2)" },
  };
  const m = messages[phase];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--app-bg)",
        color: "var(--text)",
        fontFamily: FONT,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        textAlign: "center",
        gap: "14px",
      }}
    >
      <div style={{ fontSize: "20px", fontWeight: 800, color: m.color }}>{m.title}</div>
      <div style={{ fontSize: "14px", color: "var(--text-2)", maxWidth: "340px", lineHeight: 1.6 }}>{m.body}</div>
      {phase !== "processing" && (
        <a
          href="/admin"
          style={{
            marginTop: "10px",
            padding: "12px 28px",
            borderRadius: "999px",
            background: "var(--control-tint)",
            color: "var(--text)",
            fontWeight: 700,
            fontSize: "14px",
            textDecoration: "none",
          }}
        >
          管理画面に戻る
        </a>
      )}
    </div>
  );
}
