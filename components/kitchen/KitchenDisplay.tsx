"use client";

import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { hm, elapsedMin, useNow } from "@/lib/time";
import { BellIcon, BellSlashIcon, WarningIcon } from "@/components/ui/Icon";
import { optionsLabel } from "@/lib/options";

/** 提供前伝票の経過時間による色エスカレーション */
function ticketHeaderColor(
  status: "cooking" | "served",
  elapsed: number | null
): string {
  if (status === "served") return "var(--green)"; // 提供済み: 緑
  if (elapsed == null) return "#2c2c2e"; // 未計測: 落ち着いた黒
  if (elapsed >= 15) return "var(--red)"; // 15分超: 赤（急げ）
  if (elapsed >= 8) return "#e0902a"; // 8分超: 琥珀
  return "#2c2c2e"; // それ未満: 落ち着いた黒
}

export default function KitchenDisplay() {
  const s = useAppStore(
    useShallow((st) => ({
      calls: st.calls,
      confirmClearCall: st.confirmClearCall,
      confirmStatus: st.confirmStatus,
      connected: st.connected,
      highlightId: st.highlightId,
      orders: st.orders,
      settings: st.settings,
      soundOn: st.soundOn,
      tableName: st.tableName,
      toggleSound: st.toggleSound,
    }))
  );
  const accent = s.settings.theme;
  const now = useNow();

  // FIFO: 提供前を先に、各グループ内は古い順（先に入った注文を先に作る）
  const sorted = [...s.orders].sort((a, b) => {
    const sa = a.status === "cooking" ? 0 : 1;
    const sb = b.status === "cooking" ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const pill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 14px",
    borderRadius: "999px",
    fontSize: "13px",
    fontWeight: 700,
    border: "none",
    fontFamily: "inherit",
  };

  return (
    <div style={{ padding: "24px 18px 40px", maxWidth: "1140px", margin: "0 auto", width: "100%" }}>
      <div style={{ background: "var(--glass)", backdropFilter: "blur(22px) saturate(180%)", WebkitBackdropFilter: "blur(22px) saturate(180%)", border: "1px solid var(--glass-edge)", borderRadius: "24px", padding: "20px 22px", boxShadow: "inset 0 1px 0 var(--glass-spec), var(--glass-shadow)" }}>
        {/* ヘッダー */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <div style={{ fontSize: "24px", fontWeight: 800 }}>厨房ディスプレイ</div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span
              style={{
                ...pill,
                background: s.connected ? "var(--green-bg)" : "var(--red-bg)",
                color: s.connected ? "var(--green-dark)" : "var(--red-dark)",
              }}
            >
              <span
                style={{
                  width: "9px",
                  height: "9px",
                  borderRadius: "50%",
                  background: s.connected ? "var(--green)" : "var(--red)",
                }}
              />
              {s.connected ? "接続中" : "オフライン"}
            </span>
            <button
              onClick={s.toggleSound}
              style={{
                ...pill,
                cursor: "pointer",
                background: s.soundOn ? "#fff3d6" : "var(--control-tint)",
                color: s.soundOn ? "#a8791a" : "var(--text-2)",
              }}
            >
              {s.soundOn ? <BellIcon size={13} /> : <BellSlashIcon size={13} />}
              {s.soundOn ? "通知音 ON" : "通知音 OFF"}
            </button>
          </div>
        </div>

        {/* スタッフ呼び出しバナー */}
        {s.calls.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
            {[...s.calls]
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
              .map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    background: "#fff8e6",
                    border: "1px solid #ffe2a8",
                    borderRadius: "14px",
                    padding: "12px 16px",
                  }}
                >
                  <BellIcon size={20} style={{ color: "#a8791a", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 800, fontSize: "15px" }}>
                      {s.tableName(c.table)} が呼び出し中
                    </span>
                    {now > 0 && (
                      <span style={{ fontSize: "12px", color: "#a8791a", marginLeft: "8px" }}>
                        {elapsedMin(c.createdAt, now)}分前
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => s.confirmClearCall(c.id)}
                    style={{ ...pill, cursor: "pointer", background: "#a8791a", color: "#fff" }}
                  >
                    対応済み
                  </button>
                </div>
              ))}
          </div>
        )}

        {/* オフラインバナー */}
        {!s.connected && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: "var(--red-bg-2)",
              border: "1px solid var(--red-bg)",
              borderRadius: "14px",
              padding: "12px 16px",
              marginBottom: "16px",
            }}
          >
            <WarningIcon size={18} style={{ color: "var(--red-dark)", flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, color: "var(--red-dark)", fontSize: "14px" }}>
                接続が切断されています
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-2)" }}>
                新しい注文を受信できません。ネットワークを確認してください。
              </div>
            </div>
          </div>
        )}

        {/* 伝票グリッド */}
        {sorted.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-2)", padding: "60px 0", fontSize: "15px" }}>
            新しい注文を待っています…
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(258px, 1fr))",
              gap: "14px",
            }}
          >
            {sorted.map((o) => {
              const cooking = o.status === "cooking";
              const highlight = s.highlightId === o.id;
              const elapsed = now > 0 ? elapsedMin(o.createdAt, now) : null;
              const headerBg = ticketHeaderColor(o.status, elapsed);
              const urgent = cooking && elapsed != null && elapsed >= 15;
              return (
                <div
                  key={o.id}
                  style={{
                    background: "var(--surface)",
                    borderRadius: "18px",
                    border: highlight ? "2px solid var(--red)" : "none",
                    boxShadow: "0 2px 12px rgba(0,0,0,.07)",
                    overflow: "hidden",
                    animation: highlight ? "kpulse 1s ease-out 2" : undefined,
                  }}
                >
                  {/* カラーヘッダーバー（経過時間で色が変化） */}
                  <div
                    style={{
                      background: headerBg,
                      color: "#fff",
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ fontSize: "19px", fontWeight: 800 }}>
                      {s.tableName(o.table)}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {elapsed != null && cooking && (
                        <span style={{ fontSize: "14px", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                          {urgent ? "⚠ " : ""}
                          {elapsed}分
                        </span>
                      )}
                      <span
                        style={{
                          background: "rgba(255,255,255,.25)",
                          borderRadius: "999px",
                          padding: "3px 10px",
                          fontSize: "12px",
                          fontWeight: 700,
                        }}
                      >
                        {cooking ? "提供前" : "提供済み"}
                      </span>
                    </div>
                  </div>

                  <div style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-2)" }}>
                        {now > 0 ? hm(o.createdAt) : "—"}
                      </span>
                      {o.proxy && (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            color: "var(--text-2)",
                            background: "var(--hairline)",
                            borderRadius: "999px",
                            padding: "2px 8px",
                          }}
                        >
                          スタッフ代理
                        </span>
                      )}
                    </div>
                    {o.items.map((it, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "6px 0",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: "var(--text-2)",
                            fontVariantNumeric: "tabular-nums",
                            minWidth: "16px",
                            flexShrink: 0,
                          }}
                        >
                          {i + 1}.
                        </span>
                        <span style={{ flex: 1, fontSize: "17px", fontWeight: 700 }}>
                          {it.name}
                          {optionsLabel(it.options) && (
                            <span style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "var(--red-dark)" }}>
                              {optionsLabel(it.options)}
                            </span>
                          )}
                        </span>
                        <span style={{ fontSize: "20px", fontWeight: 800, color: accent, fontVariantNumeric: "tabular-nums" }}>
                          ×{it.qty}
                        </span>
                      </div>
                    ))}
                    <button
                      onClick={() => s.confirmStatus(o)}
                      style={{
                        width: "100%",
                        marginTop: "10px",
                        padding: "11px",
                        borderRadius: "12px",
                        border: "none",
                        fontFamily: "inherit",
                        fontSize: "14px",
                        fontWeight: 700,
                        cursor: "pointer",
                        background: cooking ? "var(--green)" : "var(--hairline)",
                        color: cooking ? "#fff" : "var(--text-2)",
                      }}
                    >
                      {cooking ? "提供済みにする" : "調理中に戻す"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
