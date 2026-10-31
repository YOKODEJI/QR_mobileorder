"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore, type TableRec } from "@/store/useAppStore";
import { isSupabaseConfigured } from "@/lib/supabase";
import { tableSummary } from "@/lib/handy";
import Sheet from "@/components/handy/Sheet";
import MoveTableSheet from "@/components/handy/MoveTableSheet";
import { card, disabledLook, stepButton, textInput } from "@/components/handy/ui";

/** 卓の編集（卓移動・追加・名前変更・並び替え・削除）。着席中の卓は削除できない。
 *  卓の追加・名前・並び・削除は店の決まり（lib/storeRules.ts）で許された役割だけ。卓移動は誰でもできる（着席中の卓だけ出す） */
export default function TableEditSheet({
  canEdit,
  onClose,
  onMoved,
}: {
  canEdit: boolean;
  onClose: () => void;
  onMoved: (fromId: string, toId: string) => void;
}) {
  const s = useAppStore(
    useShallow((st) => ({
      tables: st.tables,
      orders: st.orders,
      addTableNamed: st.addTableNamed,
      shiftTable: st.shiftTable,
      removeTable: st.removeTable,
      openDialog: st.openDialog,
      closeDialog: st.closeDialog,
    }))
  );
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const gated = isSupabaseConfigured();
  const canAdd = !busy && newName.trim() !== "";
  const isOccupied = (t: TableRec) => (gated && !!t.openSince) || tableSummary(s.orders, t.id).orderCount > 0;
  // 卓の編集ができない役割には、卓移動ができる着席中の卓だけを出す
  const shown = canEdit ? s.tables : s.tables.filter(isOccupied);

  const add = async () => {
    if (!canAdd) return;
    setBusy(true);
    const ok = await s.addTableNamed(newName);
    setBusy(false);
    if (ok) setNewName("");
  };

  const shift = async (id: string, dir: -1 | 1) => {
    if (busy) return;
    setBusy(true);
    await s.shiftTable(id, dir);
    setBusy(false);
  };

  const remove = (t: TableRec) =>
    s.openDialog({
      title: `${t.name} を削除`,
      body: "",
      confirmText: "削除する",
      danger: true,
      onConfirm: async () => {
        s.closeDialog();
        setBusy(true);
        await s.removeTable(t.id);
        setBusy(false);
      },
    });

  return (
    <Sheet
      title="卓の編集"
      onClose={onClose}
      footer={
        !canEdit ? undefined : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          style={{ display: "flex", gap: "8px" }}
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="追加する卓の名前"
            aria-label="追加する卓の名前"
            maxLength={20}
            enterKeyHint="done"
            style={{ ...textInput, flex: 1, fontWeight: 700 }}
          />
          <button
            type="submit"
            disabled={!canAdd}
            style={{
              flexShrink: 0,
              minHeight: "46px",
              padding: "0 18px",
              borderRadius: "8px",
              border: "none",
              background: "var(--accent)",
              color: "var(--accent-ink)",
              fontFamily: "inherit",
              fontSize: "16px",
              fontWeight: 800,
              cursor: "pointer",
              ...disabledLook(!canAdd),
            }}
          >
            追加
          </button>
        </form>
        )
      }
    >
      {shown.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text-2)", padding: "30px 0" }}>
          {canEdit ? "卓がありません" : "着席中の卓がありません"}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {shown.map((t, i) => {
            const occupied = isOccupied(t);
            const first = i === 0;
            const last = i === shown.length - 1;
            return (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px",
                  ...card,
                }}
              >
                {canEdit && (
                  <>
                    <button
                      onClick={() => shift(t.id, -1)}
                      disabled={busy || first}
                      aria-label={`${t.name} を前へ`}
                      style={{ ...stepButton, width: "40px", fontSize: "18px", ...disabledLook(busy || first) }}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => shift(t.id, 1)}
                      disabled={busy || last}
                      aria-label={`${t.name} を後ろへ`}
                      style={{ ...stepButton, width: "40px", fontSize: "18px", ...disabledLook(busy || last) }}
                    >
                      ↓
                    </button>
                  </>
                )}
                {/* 名前が他の端末で変わったら入力欄も作り直す */}
                {canEdit ? (
                  <NameField key={t.name} table={t} />
                ) : (
                  <span style={{ flex: 1, minWidth: 0, padding: "0 6px", fontSize: "20px", fontWeight: 700 }}>{t.name}</span>
                )}
                {occupied && (
                  <button
                    onClick={() => setMovingId(t.id)}
                    disabled={busy}
                    aria-label={`${t.name} を移動`}
                    style={{
                      flexShrink: 0,
                      minHeight: "40px",
                      padding: "0 14px",
                      borderRadius: "10px",
                      border: "1.5px solid var(--hairline-strong)",
                      background: "var(--surface)",
                      color: "var(--text)",
                      fontFamily: "inherit",
                      fontSize: "16px",
                      fontWeight: 700,
                      cursor: "pointer",
                      ...disabledLook(busy),
                    }}
                  >
                    移動
                  </button>
                )}
                {canEdit && !occupied && (
                  <button
                    onClick={() => remove(t)}
                    disabled={busy}
                    style={{
                      flexShrink: 0,
                      width: "56px",
                      minHeight: "40px",
                      borderRadius: "10px",
                      border: "none",
                      background: "transparent",
                      color: "var(--red-dark)",
                      fontFamily: "inherit",
                      fontSize: "16px",
                      fontWeight: 700,
                      cursor: "pointer",
                      ...disabledLook(busy),
                    }}
                  >
                    削除
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {movingId && (
        <MoveTableSheet
          fromId={movingId}
          onClose={() => setMovingId(null)}
          onMoved={(to) => {
            const from = movingId;
            setMovingId(null);
            onMoved(from, to);
          }}
        />
      )}
    </Sheet>
  );
}

/** 名前の欄。入力を終えたとき（フォーカスが外れる・確定キー）に保存する */
function NameField({ table }: { table: TableRec }) {
  const renameTable = useAppStore((st) => st.renameTable);
  const [value, setValue] = useState(table.name);

  const commit = async () => {
    const name = value.trim();
    if (!name || name === table.name) {
      setValue(table.name);
      return;
    }
    if (!(await renameTable(table.id, name))) setValue(table.name);
  };

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      aria-label={`${table.name} の名前`}
      maxLength={20}
      enterKeyHint="done"
      style={{ ...textInput, flex: 1, minWidth: 0, fontSize: "18px", fontWeight: 700 }}
    />
  );
}
