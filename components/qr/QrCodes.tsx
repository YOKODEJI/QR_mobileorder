"use client";

import { useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { isSupabaseConfigured } from "@/lib/supabase";
import { PrinterIcon, RefreshIcon, WarningIcon } from "@/components/ui/Icon";

/** 各卓のQRコードを発行・印刷する画面（管理ツール） */
export default function QrCodes() {
  const s = useAppStore(
    useShallow((st) => ({
      tables: st.tables,
      settings: st.settings,
      tableTokens: st.tableTokens,
    }))
  );
  const loadTableTokens = useAppStore((st) => st.loadTableTokens);
  const regenerateToken = useAppStore((st) => st.regenerateToken);
  const accent = s.settings.theme;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const configured = isSupabaseConfigured();

  // 各卓の qr_token を取得（QRのURLに ?k= として埋め込む）
  useEffect(() => {
    loadTableTokens();
  }, [loadTableTokens]);

  return (
    <>
      {/* ヘッダー（印刷しない） */}
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
        <div style={{ fontSize: "12px", color: "var(--text-2)", lineHeight: 1.5 }}>
          各卓に置くQRです。読み取ると、その卓の注文ページが開きます。
          <br />
          <WarningIcon size={11} style={{ verticalAlign: "-1px" }} /> 「再発行」すると印刷済みの古いQRは<strong>使えなくなります</strong>（作り直すと別のQRに）。
        </div>
        <button
          onClick={() => window.print()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            border: "none",
            background: accent,
            color: "#fff",
            borderRadius: "999px",
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <PrinterIcon size={14} />印刷する
        </button>
      </div>

      {/* QRグリッド */}
      {s.tables.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text-2)", padding: "24px 0", fontSize: "13px" }}>
          テーブルがありません。「テーブル / 会計」で追加してください。
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: "12px",
          }}
        >
          {s.tables.map((t) => {
            const token = s.tableTokens[t.id];
            // 合言葉つきURL（未取得＝ローカル/未設定時は素のURLにフォールバック）
            const url = token
              ? `${origin}/order/${t.id}?k=${token}`
              : `${origin}/order/${t.id}`;
            return (
              <div
                key={t.id}
                style={{
                  border: "1px solid var(--hairline)",
                  borderRadius: "14px",
                  padding: "14px 10px",
                  textAlign: "center",
                  background: "var(--surface)",
                  breakInside: "avoid",
                }}
              >
                <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "8px" }}>
                  {t.name}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    background: "#ffffff",
                    borderRadius: "10px",
                    padding: "10px",
                  }}
                >
                  <QRCodeSVG value={url} size={128} level="M" fgColor="#000000" bgColor="#ffffff" />
                </div>
                <div style={{ fontSize: "10px", color: "var(--text-3)", marginTop: "6px" }}>
                  スマホのカメラで読み取り
                </div>
                {/* 再発行（印刷しない）。Supabase設定時のみ */}
                {configured && (
                  <button
                    className="no-print"
                    onClick={() => regenerateToken(t.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      marginTop: "8px",
                      border: "1px solid var(--hairline)",
                      background: "transparent",
                      color: "var(--text-2)",
                      borderRadius: "999px",
                      padding: "5px 12px",
                      fontSize: "11px",
                      fontWeight: 600,
                      fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    <RefreshIcon size={11} />QRを再発行
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
