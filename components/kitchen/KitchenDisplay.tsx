"use client";

import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { hm, elapsedMin, useNow } from "@/lib/time";
import { BellIcon, BellSlashIcon, WarningIcon } from "@/components/ui/Icon";
import { optionsLabel } from "@/lib/options";
import SoldOutSheet from "@/components/kitchen/SoldOutSheet";

/** 提供前伝票の経過時間による色エスカレーション */
function ticketHeaderColor(status: "cooking" | "served", elapsed: number | null): string {
  if (status === "served") return "var(--ticket-done)";
  if (elapsed == null) return "var(--ticket)";
  if (elapsed >= 15) return "var(--red)"; // 15分超: 赤（急げ）
  if (elapsed >= 8) return "var(--amber)"; // 8分超: 琥珀
  return "var(--ticket)";
}

const pill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  minHeight: "36px",
  padding: "8px 12px",
  borderRadius: "8px",
  fontSize: "14px",
  fontWeight: 700,
  border: "none",
  fontFamily: "inherit",
};

const notice: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  borderRadius: "8px",
  padding: "12px 16px",
  marginBottom: "16px",
};

export default function KitchenDisplay() {
  const s = useAppStore(
    useShallow((st) => ({
      calls: st.calls,
      confirmClearCall: st.confirmClearCall,
      confirmStatus: st.confirmStatus,
      connected: st.connected,
      highlightId: st.highlightId,
      orders: st.orders,
      handy: st.settings.orderMode === "handy",
      soundOn: st.soundOn,
      tableName: st.tableName,
      toggleSound: st.toggleSound,
    }))
  );
  const now = useNow();
  const [soldOutOpen, setSoldOutOpen] = useState(false);
  const soldOutCount = useAppStore((st) => st.menu.filter((m) => m.soldOut).length);

  // FIFO: 提供前を先に、各グループ内は古い順（先に入った注文を先に作る）
  const sorted = [...s.orders].sort((a, b) => {
    const sa = a.status === "cooking" ? 0 : 1;
    const sb = b.status === "cooking" ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  const pendingCount = s.orders.filter((o) => o.status === "cooking" && !o.checkedOutAt).length;
  const calls = [...s.calls].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  // 会計済み・未提供の繰越伝票が残っている卓に、次のお客様の注文が入っている（step17の要注意状態）
  const conflictTables = [...new Set(s.orders.filter((o) => o.checkedOutAt).map((o) => o.table))].filter((t) =>
    s.orders.some((o) => o.table === t && !o.checkedOutAt)
  );

  return (
    <div style={{ padding: "16px 18px 40px", maxWidth: "1140px", margin: "0 auto", width: "100%" }}>
      {/* ヘッダー: いま作る件数と、音・売切の切替 */}
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
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
          <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-2)" }}>提供前</span>
          <span style={{ fontSize: "30px", fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{pendingCount}</span>
          <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-2)" }}>件</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span
            style={{
              ...pill,
              background: s.connected ? "var(--green-bg)" : "var(--red-bg)",
              color: s.connected ? "var(--green-dark)" : "var(--red-dark)",
            }}
          >
            <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: s.connected ? "var(--green)" : "var(--red)" }} />
            {s.connected ? "接続中" : "オフライン"}
          </span>
          <button
            onClick={s.toggleSound}
            style={{
              ...pill,
              cursor: "pointer",
              background: s.soundOn ? "var(--amber-bg)" : "var(--control-tint)",
              color: s.soundOn ? "var(--amber-dark)" : "var(--text-2)",
            }}
          >
            {s.soundOn ? <BellIcon size={13} /> : <BellSlashIcon size={13} />}
            {s.soundOn ? "通知音 ON" : "通知音 OFF"}
          </button>
          <button
            onClick={() => setSoldOutOpen(true)}
            style={{
              ...pill,
              cursor: "pointer",
              background: soldOutCount > 0 ? "var(--red-bg)" : "var(--control-tint)",
              color: soldOutCount > 0 ? "var(--red-dark)" : "var(--text)",
            }}
          >
            売切{soldOutCount > 0 ? `（${soldOutCount}）` : ""}
          </button>
        </div>
      </div>
      {soldOutOpen && <SoldOutSheet onClose={() => setSoldOutOpen(false)} />}

      {/* スタッフ呼び出し */}
      {calls.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
          {calls.map((c) => (
            <div key={c.id} style={{ ...notice, marginBottom: 0, background: "var(--amber-bg)", border: "1px solid var(--amber-edge)" }}>
              <BellIcon size={20} style={{ color: "var(--amber-dark)", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 800, fontSize: "15px" }}>{s.tableName(c.table)} が呼び出し中</span>
                {now > 0 && (
                  <span style={{ fontSize: "13px", color: "var(--amber-dark)", marginLeft: "8px" }}>{elapsedMin(c.createdAt, now)}分前</span>
                )}
              </div>
              <button onClick={() => s.confirmClearCall(c.id)} style={{ ...pill, cursor: "pointer", background: "var(--amber-dark)", color: "#fff" }}>
                対応済み
              </button>
            </div>
          ))}
        </div>
      )}

      {conflictTables.length > 0 && (
        <div style={{ ...notice, background: "var(--red-bg-2)", border: "1px solid var(--red-bg)" }}>
          <WarningIcon size={18} style={{ color: "var(--red-dark)", flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, color: "var(--red-dark)", fontSize: "14px" }}>
              {conflictTables.map((t) => s.tableName(t)).join("・")}：会計済みの未提供伝票が残ったまま、新しい注文が入っています
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-2)" }}>前のお客様の未提供分（グレーの伝票）を先に提供し、伝票を閉じてください。</div>
          </div>
        </div>
      )}

      {!s.connected && (
        <div style={{ ...notice, background: "var(--red-bg-2)", border: "1px solid var(--red-bg)" }}>
          <WarningIcon size={18} style={{ color: "var(--red-dark)", flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, color: "var(--red-dark)", fontSize: "14px" }}>接続が切断されています</div>
            <div style={{ fontSize: "13px", color: "var(--text-2)" }}>新しい注文を受信できません。ネットワークを確認してください。</div>
          </div>
        </div>
      )}

      {/* 伝票 */}
      {sorted.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text-2)", padding: "80px 0", fontSize: "17px" }}>新しい注文を待っています…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(258px, 1fr))", gap: "14px" }}>
          {sorted.map((o) => {
            const cooking = o.status === "cooking";
            const carryOver = !!o.checkedOutAt; // 会計済み・未提供の繰越伝票(step17)
            const highlight = s.highlightId === o.id;
            const elapsed = now > 0 ? elapsedMin(o.createdAt, now) : null;
            const headerBg = carryOver ? "var(--ticket-done)" : ticketHeaderColor(o.status, elapsed);
            const urgent = !carryOver && cooking && elapsed != null && elapsed >= 15;
            return (
              <article
                key={o.id}
                aria-label={`${s.tableName(o.table)} の伝票`}
                style={{
                  background: "var(--surface)",
                  borderRadius: "10px",
                  // 影は使わず、罫線の枠で区切る
                  border: highlight ? "2.5px solid var(--red)" : "1.5px solid var(--rule)",
                  overflow: "hidden",
                  animation: highlight ? "kpulse 1s ease-out 2" : undefined,
                }}
              >
                {/* 卓名のバー（経過時間で色が変わる） */}
                <div style={{ background: headerBg, color: "#fff", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "22px", fontWeight: 800 }}>{s.tableName(o.table)}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {elapsed != null && cooking && (
                      <span style={{ fontSize: "15px", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                        {urgent ? "⚠ " : ""}
                        {elapsed}分
                      </span>
                    )}
                    <span style={{ background: "rgba(255,255,255,.25)", borderRadius: "3px", padding: "3px 9px", fontSize: "13px", fontWeight: 700 }}>
                      {carryOver ? "会計済・未提供" : cooking ? "提供前" : "提供済み"}
                    </span>
                  </div>
                </div>

                <div style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "13px", color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>{now > 0 ? hm(o.createdAt) : "—"}</span>
                    {/* ハンディの店は全部スタッフの注文なので、印は出さない */}
                    {o.proxy && !s.handy && (
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-2)", background: "var(--hairline)", borderRadius: "3px", padding: "2px 8px" }}>
                        スタッフ代理
                      </span>
                    )}
                  </div>
                  {o.items.map((it, i) => {
                    const opts = optionsLabel(it.options);
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "7px 0", borderTop: i === 0 ? "none" : "1px solid var(--hairline-2)" }}>
                        <span style={{ flex: 1, fontSize: "19px", fontWeight: 700, lineHeight: 1.3 }}>
                          {it.name}
                          {/* 飲み方（一合・ロック・Cドリンク）は品名と同じ強さで。備考だけ赤 */}
                          {opts && (
                            <span style={{ display: "inline-block", marginLeft: "8px", padding: "2px 8px", borderRadius: "3px", background: "var(--chip-tint)", fontSize: "15px", fontWeight: 800, verticalAlign: "2px" }}>
                              {opts}
                            </span>
                          )}
                          {it.note && (
                            <span style={{ display: "block", fontSize: "15px", fontWeight: 700, color: "var(--red-dark)" }}>※ {it.note}</span>
                          )}
                        </span>
                        <span style={{ fontSize: "22px", fontWeight: 800, color: "var(--accent)", fontVariantNumeric: "tabular-nums", lineHeight: 1.3 }}>
                          ×{it.qty}
                        </span>
                      </div>
                    );
                  })}
                  <button
                    onClick={() => s.confirmStatus(o)}
                    style={{
                      width: "100%",
                      marginTop: "10px",
                      minHeight: "46px",
                      padding: "11px",
                      borderRadius: "8px",
                      border: "none",
                      fontFamily: "inherit",
                      fontSize: "15px",
                      fontWeight: 700,
                      cursor: "pointer",
                      background: cooking ? "var(--green)" : "var(--hairline)",
                      color: cooking ? "#fff" : "var(--text-2)",
                    }}
                  >
                    {carryOver ? "提供完了（伝票を閉じる）" : cooking ? "提供済みにする" : "提供前に戻す"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
