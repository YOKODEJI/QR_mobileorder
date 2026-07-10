"use client";

import { useAppStore } from "@/store/useAppStore";
import { hm, elapsedMin, useNow } from "@/lib/time";

/** 提供前伝票の経過時間による色エスカレーション */
function ticketHeaderColor(
  status: "cooking" | "served",
  elapsed: number | null
): string {
  if (status === "served") return "#34c759"; // 提供済み: 緑
  if (elapsed == null) return "#2c2c2e"; // 未計測: 落ち着いた黒
  if (elapsed >= 15) return "#ff3b30"; // 15分超: 赤（急げ）
  if (elapsed >= 8) return "#e0902a"; // 8分超: 琥珀
  return "#2c2c2e"; // それ未満: 落ち着いた黒
}

export default function KitchenDisplay() {
  const s = useAppStore();
  const accent = s.settings.theme;
  const now = useNow();

  const photoById: Record<string, string> = {};
  s.menu.forEach((m) => {
    if (m.photo) photoById[m.id] = m.photo;
  });

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
      <div style={{ background: "#fff", borderRadius: "24px", padding: "20px 22px", boxShadow: "0 12px 34px rgba(0,0,0,.06)" }}>
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
                background: s.connected ? "#e3f7ea" : "#ffe5e3",
                color: s.connected ? "#248a3d" : "#d70015",
              }}
            >
              <span
                style={{
                  width: "9px",
                  height: "9px",
                  borderRadius: "50%",
                  background: s.connected ? "#34c759" : "#ff3b30",
                }}
              />
              {s.connected ? "接続中" : "オフライン"}
            </span>
            <button
              onClick={s.toggleSound}
              style={{
                ...pill,
                cursor: "pointer",
                background: s.soundOn ? "#fff3d6" : "rgba(118,118,128,.12)",
                color: s.soundOn ? "#a8791a" : "#8e8e93",
              }}
            >
              {s.soundOn ? "🔔 通知音 ON" : "🔕 通知音 OFF"}
            </button>
            <button
              onClick={s.toggleConnection}
              style={{
                ...pill,
                cursor: "pointer",
                background: "rgba(118,118,128,.12)",
                color: "#6b6b70",
              }}
            >
              {s.connected ? "切断をシミュレート" : "再接続する"}
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
                  <span style={{ fontSize: "20px" }}>🔔</span>
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
                    onClick={() => s.clearCall(c.id)}
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
              background: "#fff0ef",
              border: "1px solid #ffd4d1",
              borderRadius: "14px",
              padding: "12px 16px",
              marginBottom: "16px",
            }}
          >
            <span style={{ fontSize: "18px" }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, color: "#d70015", fontSize: "14px" }}>
                接続が切断されています
              </div>
              <div style={{ fontSize: "13px", color: "#6b6b70" }}>
                新しい注文を受信できません。ネットワークを確認してください。
              </div>
            </div>
          </div>
        )}

        {/* 伝票グリッド */}
        {sorted.length === 0 ? (
          <div style={{ textAlign: "center", color: "#8e8e93", padding: "60px 0", fontSize: "15px" }}>
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
                    background: "#fff",
                    borderRadius: "18px",
                    border: highlight ? "2px solid #ff3b30" : "1px solid #ececee",
                    boxShadow: "0 4px 14px rgba(0,0,0,.04)",
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
                        <span style={{ fontSize: "14px", fontWeight: 800 }}>
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
                      <span style={{ fontSize: "12px", color: "#8e8e93" }}>
                        {now > 0 ? hm(o.createdAt) : "—"}
                      </span>
                      {o.proxy && (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            color: "#8e8e93",
                            background: "#f0f0f2",
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
                        {photoById[it.menuItemId] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photoById[it.menuItemId]}
                            alt=""
                            style={{ width: "34px", height: "34px", borderRadius: "9px", objectFit: "cover" }}
                          />
                        )}
                        <span style={{ flex: 1, fontSize: "17px", fontWeight: 700 }}>{it.name}</span>
                        <span style={{ fontSize: "20px", fontWeight: 800, color: accent }}>
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
                        background: cooking ? "#34c759" : "#f0f0f2",
                        color: cooking ? "#fff" : "#6b6b70",
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
