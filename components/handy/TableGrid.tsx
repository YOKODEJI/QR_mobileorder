"use client";

import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/store/useAppStore";
import { isSupabaseConfigured } from "@/lib/supabase";
import { elapsedMin, useNow } from "@/lib/time";
import { tableSummary } from "@/lib/handy";
import { BellIcon } from "@/components/ui/Icon";

/** 卓一覧。空席をタップ → 来店受付 → そのまま注文入力へ。着席中をタップ → 卓画面へ。
 *  2列の大きなタイル。着席中は白地に太い枠、空席は灰色の地で、色と言葉の両方で見分ける */
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
      openDialog: st.openDialog,
      closeDialog: st.closeDialog,
    }))
  );
  const now = useNow();
  // Supabase未設定（ローカル開発）では卓の開閉が無いので、常に着席中として扱う
  const gated = isSupabaseConfigured();

  const receive = (id: string, name: string) =>
    s.openDialog({
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
    });

  if (s.tables.length === 0) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-2)", fontSize: "16px" }}>
        卓が登録されていません。右上の「卓の編集」から追加してください。
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: "10px",
        padding: "12px 12px calc(24px + env(safe-area-inset-bottom))",
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
              minHeight: "104px",
              padding: "12px 14px",
              borderRadius: "10px",
              border: open ? "2.5px solid var(--text)" : "1.5px solid var(--rule)",
              background: open ? "var(--surface)" : "var(--inset)",
              fontFamily: "inherit",
              color: "var(--text)",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "8px",
              textAlign: "left",
            }}
          >
            <span
              style={{
                fontSize: "30px",
                fontWeight: 800,
                lineHeight: 1.1,
                color: open ? "var(--text)" : "var(--text-2)",
                // 長い卓名（「カウンター A」など）は折り返す
                overflowWrap: "anywhere",
              }}
            >
              {t.name}
            </span>
            {open ? (
              <span style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px", fontSize: "15px", fontWeight: 700 }}>
                {sum.pendingQty > 0 ? (
                  <span style={{ padding: "3px 8px", borderRadius: "3px", background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 800 }}>
                    提供前 {sum.pendingQty}
                  </span>
                ) : (
                  <span style={{ color: "var(--text-2)" }}>{sum.orderCount > 0 ? "提供済み" : "注文なし"}</span>
                )}
                {minutes != null && <span style={{ color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>{minutes}分</span>}
              </span>
            ) : (
              <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-2)" }}>空席</span>
            )}
            {calling && (
              <span
                aria-label="呼び出し中"
                style={{
                  position: "absolute",
                  top: "10px",
                  right: "10px",
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  background: "var(--amber-dark)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <BellIcon size={16} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
