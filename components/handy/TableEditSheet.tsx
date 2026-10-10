"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore, type TableRec } from "@/store/useAppStore";
import { isSupabaseConfigured } from "@/lib/supabase";
import { tableSummary } from "@/lib/handy";
import Sheet from "@/components/handy/Sheet";
import { disabledLook, stepButton, textInput } from "@/components/handy/ui";

/** 卓の編集（追加・名前変更・並び替え・削除）。オーナーとスタッフが使う。着席中の卓は削除できない */
export default function TableEditSheet({ onClose }: { onClose: () => void }) {
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
  const gated = isSupabaseConfigured();
  const canAdd = !busy && newName.trim() !== "";

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
      body: `卓「${t.name}」を一覧から消します。あとから同じ名前で追加し直せます。`,
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
      subtitle="名前は欄をタップして書き換え、↑↓で並び替え"
      onClose={onClose}
      footer={
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
              borderRadius: "14px",
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
      }
    >
      {s.tables.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text-2)", padding: "30px 0" }}>
          卓がありません。下の欄から追加してください。
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {s.tables.map((t, i) => {
            const occupied = (gated && !!t.openSince) || tableSummary(s.orders, t.id).orderCount > 0;
            const first = i === 0;
            const last = i === s.tables.length - 1;
            return (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px",
                  borderRadius: "14px",
                  background: "var(--surface)",
                  border: "1px solid var(--hairline-strong)",
                }}
              >
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
                {/* 名前が他の端末で変わったら入力欄も作り直す */}
                <NameField key={t.name} table={t} />
                {occupied ? (
                  <span style={{ flexShrink: 0, width: "56px", textAlign: "center", fontSize: "14px", fontWeight: 700, color: "var(--text-2)" }}>
                    着席中
                  </span>
                ) : (
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
