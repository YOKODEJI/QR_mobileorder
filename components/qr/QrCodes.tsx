"use client";

import { useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { isSupabaseConfigured } from "@/lib/supabase";

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
        <div style={{ fontSize: "12px", color: "#8e8e93", lineHeight: 1.5 }}>
          各卓に置くQRです。読み取ると、その卓の注文ページが開きます。
          <br />
          ⚠️ 「再発行」すると印刷済みの古いQRは<strong>使えなくなります</strong>（作り直すと別のQRに）。
        </div>
        <button
          onClick={() => window.print()}
          style={{
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
          🖨 印刷する
        </button>
      </div>

      {/* QRグリッド */}
      {s.tables.length === 0 ? (
        <div style={{ textAlign: "center", color: "#8e8e93", padding: "24px 0", fontSize: "13px" }}>
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
                  border: "1px solid #ececee",
                  borderRadius: "14px",
                  padding: "14px 10px",
                  textAlign: "center",
                  background: "#fff",
                  breakInside: "avoid",
                }}
              >
                <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "8px" }}>
                  {t.name}
                </div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <QRCodeSVG value={url} size={128} level="M" />
                </div>
                <div style={{ fontSize: "10px", color: "#a0a0a5", marginTop: "6px" }}>
                  スマホのカメラで読み取り
                </div>
                {/* 再発行（印刷しない）。Supabase設定時のみ */}
                {configured && (
                  <button
                    className="no-print"
                    onClick={() => regenerateToken(t.id)}
                    style={{
                      marginTop: "8px",
                      border: "1px solid #ececee",
                      background: "transparent",
                      color: "#8e8e93",
                      borderRadius: "999px",
                      padding: "5px 12px",
                      fontSize: "11px",
                      fontWeight: 600,
                      fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    ♻︎ QRを再発行
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
