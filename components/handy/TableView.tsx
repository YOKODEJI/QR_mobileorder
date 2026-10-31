"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/store/useAppStore";
import { hm, useNow } from "@/lib/time";
import { optionsLabel, splitCountOptions } from "@/lib/options";
import { BellIcon } from "@/components/ui/Icon";
import BillSheet from "@/components/handy/BillSheet";
import { bottomBar, card, itemName, primaryButton, smallButton, statusTag, subText } from "@/components/handy/ui";

/** 注文一覧（卓画面の「注文一覧」タブ）。この卓のドリンクと提供状況を新しい順に出し、下のボタンからレジ用の一覧へ */
export default function TableView({ tableId, onClosedTable }: { tableId: string; onClosedTable: () => void }) {
  const [billOpen, setBillOpen] = useState(false);
  // 注文の取消は、押し間違えないよう「取り消す」を押してからだけ出す
  const [cancelMode, setCancelMode] = useState(false);
  const s = useAppStore(
    useShallow((st) => ({
      orders: st.orders,
      itemOptions: st.itemOptions,
      calls: st.calls,
      confirmClearCall: st.confirmClearCall,
      cancelOrderUnit: st.cancelOrderUnit,
      openDialog: st.openDialog,
      closeDialog: st.closeDialog,
    }))
  );
  const now = useNow();
  const orders = s.orders
    .filter((o) => o.table === tableId && !o.checkedOutAt)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const calls = s.calls.filter((c) => c.table === tableId);
  const cancelling = cancelMode && orders.length > 0;

  const confirmCancel = (order: (typeof orders)[number], it: (typeof orders)[number]["items"][number]) => {
    const opts = optionsLabel(splitCountOptions(s.itemOptions[it.menuItemId], it.options).rest);
    s.openDialog({
      title: `${it.name}${opts ? `（${opts}）` : ""} を1つ取り消しますか？`,
      body: order.status === "cooking" ? "" : "提供済みの品です",
      confirmText: "取り消す",
      danger: true,
      onConfirm: () => {
        s.closeDialog();
        s.cancelOrderUnit(order.id, it.menuItemId, it.options ?? []);
      },
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div style={{ flex: 1, padding: "12px 12px 110px", display: "flex", flexDirection: "column", gap: "10px" }}>
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

        {orders.length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => setCancelMode(!cancelling)}
              style={{ ...smallButton, ...(cancelling ? { background: "var(--text)", color: "#fff", border: "1px solid var(--text)" } : { color: "var(--red-dark)" }) }}
            >
              {cancelling ? "取消を終わる" : "注文を取り消す"}
            </button>
          </div>
        )}

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
                {o.items.map((it, i) => {
                  // グラスの数は品の数とは別の数なので、品名の行には混ぜず、下の行に分けて出す
                  const split = splitCountOptions(s.itemOptions[it.menuItemId], it.options);
                  const opts = optionsLabel(split.rest);
                  return (
                    <div key={i} style={{ padding: "6px 0", borderTop: i === 0 ? "none" : "1px solid var(--hairline)" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={itemName}>{it.name}</span>
                          {opts && <span style={subText}>{opts}</span>}
                          {it.note && <span style={subText}>※ {it.note}</span>}
                        </span>
                        <span style={{ fontSize: "20px", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>×{it.qty}</span>
                        {cancelling && (
                          <button
                            onClick={() => confirmCancel(o, it)}
                            aria-label={`${it.name}を1つ取り消す`}
                            style={{
                              alignSelf: "center",
                              flexShrink: 0,
                              minHeight: "44px",
                              padding: "8px 14px",
                              borderRadius: "12px",
                              border: "none",
                              background: "var(--red)",
                              color: "#fff",
                              fontFamily: "inherit",
                              fontSize: "16px",
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                          >
                            取消
                          </button>
                        )}
                      </div>
                      {split.counts.map((c) => (
                        <div key={c.label} style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "2px" }}>
                          <span style={{ ...itemName, flex: 1, minWidth: 0 }}>{c.value === 0 ? `${c.label}なし` : c.label}</span>
                          {c.value > 0 && <span style={{ fontSize: "20px", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>×{c.value}</span>}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      <div style={bottomBar}>
        <button onClick={() => setBillOpen(true)} style={primaryButton}>
          レジ用の一覧
        </button>
      </div>

      {billOpen && (
        <BillSheet
          tableId={tableId}
          onClose={() => setBillOpen(false)}
          onClosedTable={() => {
            setBillOpen(false);
            onClosedTable();
          }}
        />
      )}
    </div>
  );
}
