"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/store/useAppStore";
import { isSupabaseConfigured } from "@/lib/supabase";
import { tableSummary } from "@/lib/handy";
import Sheet from "@/components/handy/Sheet";
import { disabledLook, glassPanel } from "@/components/handy/ui";

/** 卓移動。相席は無い運用なので、空いている卓だけを候補に出す */
export default function MoveTableSheet({
  fromId,
  onClose,
  onMoved,
}: {
  fromId: string;
  onClose: () => void;
  onMoved: (toId: string) => void;
}) {
  const s = useAppStore(
    useShallow((st) => ({
      tables: st.tables,
      orders: st.orders,
      tableName: st.tableName,
      moveTable: st.moveTable,
      openDialog: st.openDialog,
      closeDialog: st.closeDialog,
    }))
  );
  const [busy, setBusy] = useState(false);
  const gated = isSupabaseConfigured();
  const empty = s.tables.filter(
    (t) => t.id !== fromId && (!gated || !t.openSince) && tableSummary(s.orders, t.id).orderCount === 0
  );

  const choose = (toId: string) =>
    s.openDialog({
      title: "卓移動",
      body: `${s.tableName(fromId)} → ${s.tableName(toId)}`,
      confirmText: "移動する",
      danger: false,
      onConfirm: async () => {
        s.closeDialog();
        setBusy(true);
        const ok = await s.moveTable(fromId, toId);
        setBusy(false);
        if (ok) onMoved(toId);
      },
    });

  return (
    <Sheet title={`${s.tableName(fromId)} の移動先`} onClose={onClose}>
      {empty.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text-2)", fontSize: "16px", padding: "30px 0" }}>空いている卓がありません</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px" }}>
          {empty.map((t) => (
            <button
              key={t.id}
              disabled={busy}
              onClick={() => choose(t.id)}
              style={{
                minHeight: "72px",
                padding: "10px",
                ...glassPanel,
                borderRadius: "16px",
                fontFamily: "inherit",
                fontSize: "26px",
                fontWeight: 800,
                color: "var(--text)",
                cursor: "pointer",
                ...disabledLook(busy),
              }}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
