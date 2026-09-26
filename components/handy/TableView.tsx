"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/store/useAppStore";
import { hm, useNow } from "@/lib/time";
import { optionsLabel } from "@/lib/options";
import { BellIcon } from "@/components/ui/Icon";
import MoveTableSheet from "@/components/handy/MoveTableSheet";
import BillSheet from "@/components/handy/BillSheet";

/** 卓画面。この卓のドリンクと提供状況を新しい順に出し、下のボタンから追加注文・卓移動・レジ用の一覧へ */
export default function TableView({
  tableId,
  onOrder,
  onMoved,
  onClosedTable,
}: {
  tableId: string;
  onOrder: () => void;
  onMoved: (toId: string) => void;
  onClosedTable: () => void;
}) {
  const [sheet, setSheet] = useState<"move" | "bill" | null>(null);
  const s = useAppStore(
    useShallow((st) => ({
      orders: st.orders,
      calls: st.calls,
      confirmClearCall: st.confirmClearCall,
    }))
  );
  const now = useNow();
  const orders = s.orders
    .filter((o) => o.table === tableId && !o.checkedOutAt)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const calls = s.calls.filter((c) => c.table === tableId);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div style={{ flex: 1, padding: "14px 12px 170px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {calls.map((c) => (
          <div
            key={c.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: "#fff8e6",
              border: "1px solid #ffe2a8",
              borderRadius: "14px",
              padding: "10px 12px",
            }}
          >
            <BellIcon size={18} style={{ color: "#a8791a", flexShrink: 0 }} />
            <span style={{ flex: 1, fontWeight: 800, fontSize: "15px", color: "#1c1c1e" }}>呼び出し中</span>
            <button
              onClick={() => s.confirmClearCall(c.id)}
              style={{
                padding: "8px 14px",
                borderRadius: "999px",
                border: "none",
                background: "#a8791a",
                color: "#fff",
                fontFamily: "inherit",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              対応済み
            </button>
          </div>
        ))}

        {orders.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-2)", padding: "48px 0" }}>まだ注文はありません</div>
        ) : (
          orders.map((o) => {
            const cooking = o.status === "cooking";
            return (
              <div
                key={o.id}
                style={{
                  background: "var(--surface)",
                  borderRadius: "16px",
                  boxShadow: "0 1px 6px rgba(0,0,0,.06)",
                  padding: "10px 14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-2)" }}>{now > 0 ? hm(o.createdAt) : "—"}</span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 800,
                      padding: "3px 10px",
                      borderRadius: "999px",
                      background: cooking ? "#ffedd5" : "var(--hairline)",
                      color: cooking ? "#c2410c" : "var(--text-2)",
                    }}
                  >
                    {cooking ? "作成中" : "提供済み"}
                  </span>
                </div>
                {o.items.map((it, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "baseline", gap: "8px", padding: "4px 0" }}>
                    <span style={{ flex: 1, fontSize: "16px", fontWeight: 700 }}>
                      {it.name}
                      {optionsLabel(it.options) && (
                        <span style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-2)" }}>
                          {optionsLabel(it.options)}
                        </span>
                      )}
                      {it.note && (
                        <span style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-2)" }}>
                          ※ {it.note}
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: "17px", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>×{it.qty}</span>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 20,
          padding: "12px 12px calc(12px + env(safe-area-inset-bottom))",
          background: "var(--glass)",
          backdropFilter: "blur(26px) saturate(180%)",
          WebkitBackdropFilter: "blur(26px) saturate(180%)",
          borderTop: "1px solid var(--glass-edge)",
        }}
      >
        <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
          <button onClick={() => setSheet("move")} style={secondaryButton}>
            卓移動
          </button>
          <button onClick={() => setSheet("bill")} style={secondaryButton}>
            レジ用の一覧
          </button>
        </div>
        <button
          onClick={onOrder}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "16px",
            border: "none",
            background: "var(--accent)",
            color: "var(--accent-ink)",
            fontFamily: "inherit",
            fontSize: "17px",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          ＋ 追加注文
        </button>
      </div>

      {sheet === "move" && (
        <MoveTableSheet
          fromId={tableId}
          onClose={() => setSheet(null)}
          onMoved={(to) => {
            setSheet(null);
            onMoved(to);
          }}
        />
      )}
      {sheet === "bill" && (
        <BillSheet
          tableId={tableId}
          onClose={() => setSheet(null)}
          onClosedTable={() => {
            setSheet(null);
            onClosedTable();
          }}
        />
      )}
    </div>
  );
}

const secondaryButton: React.CSSProperties = {
  flex: 1,
  padding: "12px",
  borderRadius: "14px",
  border: "none",
  background: "var(--control-tint)",
  color: "var(--text)",
  fontFamily: "inherit",
  fontSize: "15px",
  fontWeight: 700,
  cursor: "pointer",
};
