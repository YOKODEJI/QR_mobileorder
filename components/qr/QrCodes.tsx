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
    <div style={{ padding: "24px 18px 40px", maxWidth: "980px", margin: "0 auto", width: "100%" }}>
      <div style={{ background: "#fff", borderRadius: "22px", padding: "20px 22px", boxShadow: "0 12px 34px rgba(0,0,0,.06)" }}>
        {/* ヘッダー（印刷しない） */}
        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
          <div>
            <div style={{ fontSize: "19px", fontWeight: 800 }}>QRコード発行</div>
            <div style={{ fontSize: "12px", color: "#8e8e93", marginTop: "2px", lineHeight: 1.5 }}>
              各卓に置くQRです。読み取ると、その卓の注文ページが開きます。
              <br />
              ⚠️ 「再発行」すると印刷済みの古いQRは<strong>使えなくなります</strong>（作り直すと別のQRに）。
            </div>
          </div>
          <button
            onClick={() => window.print()}
            style={{
              border: "none",
              background: accent,
              color: "#fff",
              borderRadius: "999px",
              padding: "10px 20px",
              fontSize: "14px",
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
          <div style={{ textAlign: "center", color: "#8e8e93", padding: "40px 0" }}>
            テーブルがありません。「テーブル / 会計」で追加してください。
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
              gap: "16px",
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
                    borderRadius: "16px",
                    padding: "16px 12px",
                    textAlign: "center",
                    background: "#fff",
                    breakInside: "avoid",
                  }}
                >
                  <div style={{ fontSize: "16px", fontWeight: 800, marginBottom: "10px" }}>
                    {t.name}
                  </div>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <QRCodeSVG value={url} size={148} level="M" />
                  </div>
                  <div style={{ fontSize: "11px", color: "#a0a0a5", marginTop: "8px" }}>
                    スマホのカメラで読み取り
                  </div>
                  {/* 再発行（印刷しない）。Supabase設定時のみ */}
                  {configured && (
                    <button
                      className="no-print"
                      onClick={() => regenerateToken(t.id)}
                      style={{
                        marginTop: "10px",
                        border: "1px solid #ececee",
                        background: "transparent",
                        color: "#8e8e93",
                        borderRadius: "999px",
                        padding: "6px 14px",
                        fontSize: "12px",
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
      </div>
    </div>
  );
}
