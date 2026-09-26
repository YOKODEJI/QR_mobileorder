"use client";

import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/store/useAppStore";
import { isSupabaseConfigured } from "@/lib/supabase";
import { elapsedMin, useNow } from "@/lib/time";
import { tableSummary } from "@/lib/handy";
import { BellIcon } from "@/components/ui/Icon";

/** 卓一覧。空席をタップ → 来店受付 → そのまま注文入力へ。着席中をタップ → 卓画面へ */
export default function TableGrid({
  onOpenTable,
  onOrder,
}: {
  onOpenTable: (id: string) => void;
  onOrder: (id: string) => void;
}) {
  const s = useAppStore(
    useShallow((st) => ({
      tables: st.tables,
      orders: st.orders,
      calls: st.calls,
      openTable: st.openTable,
      closeDialog: st.closeDialog,
    }))
  );
  const now = useNow();
  // Supabase未設定（ローカル開発）では卓の開閉が無いので、常に着席中として扱う
  const gated = isSupabaseConfigured();

  const receive = (id: string, name: string) =>
    useAppStore.setState({
      dialog: {
        title: `${name} の来店受付`,
        body: "お客様を案内した卓を開いて、注文を入れられるようにします。",
        confirmText: "受付して注文へ",
        danger: false,
        onConfirm: async () => {
          s.closeDialog();
          await s.openTable(id);
          // 受付に失敗したら openTable が元に戻してトーストを出すので、開いたときだけ進む
          if (useAppStore.getState().tables.find((t) => t.id === id)?.openSince) onOrder(id);
        },
      },
    });

  if (s.tables.length === 0) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-2)" }}>
        卓が登録されていません。管理画面の「テーブル / 会計」から卓を追加してください。
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))",
        gap: "10px",
        padding: "14px 12px 40px",
      }}
    >
      {s.tables.map((t) => {
        const open = !gated || !!t.openSince;
        const sum = tableSummary(s.orders, t.id);
        const calling = s.calls.some((c) => c.table === t.id);
        const minutes = open && t.openSince && now > 0 ? elapsedMin(t.openSince, now) : null;
        return (
          <button
            key={t.id}
            onClick={() => (open ? onOpenTable(t.id) : receive(t.id, t.name))}
            aria-label={`${t.name}（${open ? "着席中" : "空席"}）`}
            style={{
              position: "relative",
              minHeight: "92px",
              padding: "12px 10px",
              borderRadius: "18px",
              border: open ? "2px solid var(--accent)" : "1px solid var(--glass-edge)",
              background: open ? "var(--surface)" : "var(--glass)",
              boxShadow: open ? "0 2px 10px rgba(0,0,0,.08)" : "none",
              fontFamily: "inherit",
              color: "var(--text)",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "6px",
              textAlign: "left",
            }}
          >
            <span style={{ fontSize: "17px", fontWeight: 800, lineHeight: 1.2 }}>{t.name}</span>
            {open ? (
              <span style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "12px", color: "var(--text-2)" }}>
                {minutes != null && <span>{minutes}分</span>}
                {sum.pendingQty > 0 ? (
                  <span style={{ fontWeight: 800, color: "#c2410c" }}>作成中 {sum.pendingQty}</span>
                ) : (
                  <span>{sum.orderCount > 0 ? "提供済み" : "注文なし"}</span>
                )}
              </span>
            ) : (
              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>空席</span>
            )}
            {calling && (
              <span
                aria-label="呼び出し中"
                style={{
                  position: "absolute",
                  top: "8px",
                  right: "8px",
                  width: "26px",
                  height: "26px",
                  borderRadius: "50%",
                  background: "#a8791a",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <BellIcon size={14} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
