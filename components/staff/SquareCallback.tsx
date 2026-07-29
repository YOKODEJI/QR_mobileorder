"use client";

import { useEffect, useState } from "react";
import { dbCloseTable } from "@/lib/data";
import { parseSquarePosCallback } from "@/lib/squarePos";
import type { DiscountType } from "@/store/useAppStore";

type Phase = "processing" | "success" | "canceled" | "error" | "no-session";

type PendingCheckout = {
  tableId: string;
  tableName: string;
  discountType: DiscountType;
  discountValue: number;
  chargeEnabled: boolean;
};

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', var(--font-noto-sans-jp), 'Noto Sans JP', sans-serif";

/** Square POSアプリから戻ってきた直後に一度だけ表示される画面(step19)。
 *  ここで初めて当店側の会計(close_table)を確定する。sessionStorageに
 *  会計ボタンを押した時点で退避しておいた内容(卓・割引等)を、Square側の
 *  結果(state)と突き合わせて使う（ページ遷移でZustandの状態は失われるため）。 */
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

      const token = result.status === "ok" || result.status === "canceled" || result.status === "error" ? result.state : null;
      const raw = token && typeof sessionStorage !== "undefined" ? sessionStorage.getItem(`squarePosPending:${token}`) : null;
      if (token && typeof sessionStorage !== "undefined") sessionStorage.removeItem(`squarePosPending:${token}`);

      if (!raw) {
        if (!cancelled) {
          setPhase(result.status === "ok" ? "error" : result.status === "canceled" ? "canceled" : "error");
          setDetail("この端末でお会計を開始した記録が見つかりませんでした。お会計が確定していない場合は、もう一度「Squareで決済する」からやり直してください。");
        }
        return;
      }
      const pending = JSON.parse(raw) as PendingCheckout;
      if (!cancelled) setTableName(pending.tableName);

      if (result.status === "canceled") {
        if (!cancelled) setPhase("canceled");
        return;
      }
      if (result.status === "error") {
        if (!cancelled) {
          setPhase("error");
          setDetail(result.errorCode ?? "不明なエラー");
        }
        return;
      }

      // ここまで来て初めて当店側の会計を確定する（Square側の決済が成功した後）
      const record = await dbCloseTable(pending.tableId, pending.discountType, pending.discountValue, pending.chargeEnabled);
      if (cancelled) return;
      if (!record) {
        setPhase("error");
        setDetail("Squareの決済は完了しましたが、当店側のお会計確定に失敗しました。管理画面の「テーブル / 会計」から手動で確認してください。");
        return;
      }
      setPhase("success");
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
