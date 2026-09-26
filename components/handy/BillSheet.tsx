"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/store/useAppStore";
import { billLines } from "@/lib/handy";
import Sheet from "@/components/handy/Sheet";

/** レジ用の一覧。USENレジに打ち込むときに見る（金額は持たないので品名・杯数・飲み方だけ）。
 *  「レジで会計した」で卓を閉じる（close_table。未提供の分は厨房に残る） */
export default function BillSheet({
  tableId,
  onClose,
  onClosedTable,
}: {
  tableId: string;
  onClose: () => void;
  onClosedTable: () => void;
}) {
  const s = useAppStore(
    useShallow((st) => ({
      orders: st.orders,
      tableName: st.tableName,
      selectStaffTable: st.selectStaffTable,
      checkout: st.checkout,
      closeDialog: st.closeDialog,
    }))
  );
  const [busy, setBusy] = useState(false);
  const lines = billLines(s.orders, tableId);
  const total = lines.reduce((a, l) => a + l.qty, 0);
  const unserved = s.orders
    .filter((o) => o.table === tableId && !o.checkedOutAt && o.status === "cooking")
    .reduce((a, o) => a + o.items.reduce((x, it) => x + it.qty, 0), 0);

  const confirmClose = () =>
    useAppStore.setState({
      dialog: {
        title: `${s.tableName(tableId)} を閉じる`,
        body:
          (unserved > 0
            ? `⚠ まだ出していないドリンクが ${unserved} 杯あります。閉じても、出し終えるまで厨房には残ります。\n\n`
            : "") + "USENレジでの会計が終わっていることを確かめてから閉じてください。",
        confirmText: "会計済みにして閉じる",
        danger: false,
        onConfirm: async () => {
          s.closeDialog();
          setBusy(true);
          s.selectStaffTable(tableId);
          await s.checkout(null, 0, false);
          setBusy(false);
          // 失敗時は checkout がトーストを出して卓を開いたまま残す
          if (!useAppStore.getState().tables.find((t) => t.id === tableId)?.openSince) onClosedTable();
        },
      },
    });

  return (
    <Sheet
      title={`${s.tableName(tableId)} のレジ用一覧`}
      onClose={onClose}
      footer={
        <button
          onClick={confirmClose}
          disabled={busy || total === 0}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "16px",
            border: "none",
            background: total === 0 ? "var(--text-3)" : "var(--accent)",
            color: "var(--accent-ink)",
            fontFamily: "inherit",
            fontSize: "17px",
            fontWeight: 800,
            cursor: busy || total === 0 ? "default" : "pointer",
          }}
        >
          {busy ? "閉じています…" : "レジで会計した（卓を閉じる）"}
        </button>
      }
    >
      {lines.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text-2)", padding: "30px 0" }}>注文はありません</div>
      ) : (
        <div style={{ background: "var(--surface)", borderRadius: "14px", padding: "4px 14px" }}>
          {lines.map((l, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "10px",
                padding: "10px 0",
                borderTop: i === 0 ? "none" : "1px solid var(--hairline)",
              }}
            >
              <span style={{ flex: 1, fontSize: "16px", fontWeight: 700 }}>
                {l.name}
                {l.optionsText && (
                  <span style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-2)" }}>
                    {l.optionsText}
                  </span>
                )}
              </span>
              <span style={{ fontSize: "18px", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{l.qty}</span>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 0",
              borderTop: "2px solid var(--hairline)",
              fontWeight: 800,
            }}
          >
            <span>合計</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{total} 点</span>
          </div>
        </div>
      )}
    </Sheet>
  );
}
