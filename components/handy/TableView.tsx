"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/store/useAppStore";
import { hm, useNow } from "@/lib/time";
import { optionsLabel } from "@/lib/options";
import { BellIcon } from "@/components/ui/Icon";
import MoveTableSheet from "@/components/handy/MoveTableSheet";
import BillSheet from "@/components/handy/BillSheet";
import { bottomBar, card, itemName, primaryButton, secondaryButton, statusTag, subText } from "@/components/handy/ui";

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
      <div style={{ flex: 1, padding: "12px 12px 190px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {calls.map((c) => (
          <div
            key={c.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: "var(--amber-bg)",
              border: "1px solid var(--amber-edge)",
              borderRadius: "14px",
              padding: "10px 12px",
            }}
          >
            <BellIcon size={20} style={{ color: "var(--amber-dark)", flexShrink: 0 }} />
            <span style={{ flex: 1, fontWeight: 800, fontSize: "16px", color: "#1c1c1e" }}>呼び出し中</span>
            <button
              onClick={() => s.confirmClearCall(c.id)}
              style={{
                minHeight: "40px",
                padding: "8px 14px",
                borderRadius: "12px",
                border: "none",
                background: "var(--amber-dark)",
                color: "#fff",
                fontFamily: "inherit",
                fontSize: "15px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              対応済み
            </button>
          </div>
        ))}

        {orders.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-2)", fontSize: "16px", padding: "48px 0" }}>まだ注文はありません</div>
        ) : (
          orders.map((o) => {
            const cooking = o.status === "cooking";
            return (
              <div
                key={o.id}
                style={{
                  ...card,
                  // 提供前の伝票は、強調色の太い枠と右上の印で分かるようにする（左の色線は使わない）
                  border: cooking ? "2px solid var(--accent)" : card.border,
                  padding: "10px 14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>
                    {now > 0 ? hm(o.createdAt) : "—"}
                  </span>
                  <span
                    style={{
                      ...statusTag,
                      // 提供前は色つき、提供済みは白地に黒文字とチェック。色の濃淡だけに頼らない
                      background: cooking ? "var(--accent)" : "var(--surface)",
                      color: cooking ? "var(--accent-ink)" : "var(--text)",
                      border: cooking ? "1.5px solid var(--accent)" : "1.5px solid var(--hairline-strong)",
                    }}
                  >
                    {cooking ? "提供前" : "✓ 提供済み"}
                  </span>
                </div>
                {o.items.map((it, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: "8px",
                      padding: "6px 0",
                      borderTop: i === 0 ? "none" : "1px solid var(--hairline)",
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={itemName}>{it.name}</span>
                      {optionsLabel(it.options) && <span style={subText}>{optionsLabel(it.options)}</span>}
                      {it.note && <span style={subText}>※ {it.note}</span>}
                    </span>
                    <span style={{ fontSize: "20px", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>×{it.qty}</span>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

      <div style={bottomBar}>
        <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
          <button onClick={() => setSheet("move")} style={secondaryButton}>
            卓移動
          </button>
          <button onClick={() => setSheet("bill")} style={secondaryButton}>
            レジ用の一覧
          </button>
        </div>
        <button onClick={onOrder} style={primaryButton}>
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
