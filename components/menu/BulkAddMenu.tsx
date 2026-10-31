"use client";

import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { parseBulkMenu } from "@/lib/handy";

/** 品をまとめて追加する（ハンディモードの店向け。金額・在庫は持たないので品名だけ）。
 *  「商品を追加」の枠の中に、ふだんは閉じた1行として置く。開くと、1行に1品ずつ書く欄が出る */
export default function BulkAddMenu({ defaultCat }: { defaultCat: string }) {
  const bulkAddMenu = useAppStore((s) => s.bulkAddMenu);
  const pushToast = useAppStore((s) => s.pushToast);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const items = parseBulkMenu(text, defaultCat);

  const submit = async () => {
    if (busy || items.length === 0) return;
    setBusy(true);
    const added = await bulkAddMenu(items);
    setBusy(false);
    if (added == null) return;
    const skipped = items.length - added;
    pushToast(`${added}品を追加しました${skipped > 0 ? `（すでにある${skipped}品は飛ばしました）` : ""}`);
    setText("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          marginTop: "12px",
          padding: "6px 0",
          border: "none",
          background: "transparent",
          color: "var(--accent)",
          fontFamily: "inherit",
          fontSize: "14px",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        ＋ 何品かまとめて追加する
      </button>
    );
  }

  return (
    <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid var(--hairline)" }}>
      <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "10px" }}>まとめて追加（{defaultCat}）</div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder={"富乃宝山\n佐藤 黒\n赤霧島"}
        aria-label="まとめて追加する品名（1行に1品）"
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: "12px",
          border: "none",
          background: "var(--hairline)",
          fontSize: "16px",
          fontFamily: "inherit",
          color: "var(--text)",
          resize: "vertical",
          lineHeight: 1.6,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
        <button
          onClick={() => {
            setOpen(false);
            setText("");
          }}
          style={{
            padding: "11px 16px",
            borderRadius: "8px",
            border: "none",
            background: "var(--control-tint)",
            color: "var(--text-2)",
            fontFamily: "inherit",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          やめる
        </button>
        <button
          onClick={submit}
          disabled={busy || items.length === 0}
          style={{
            padding: "11px 22px",
            borderRadius: "8px",
            border: "none",
            background: items.length === 0 ? "var(--text-3)" : "var(--accent)",
            color: "#fff",
            fontFamily: "inherit",
            fontSize: "14px",
            fontWeight: 700,
            cursor: busy || items.length === 0 ? "default" : "pointer",
          }}
        >
          {busy ? "追加中…" : items.length > 0 ? `${items.length}品を追加` : "追加"}
        </button>
      </div>
    </div>
  );
}
