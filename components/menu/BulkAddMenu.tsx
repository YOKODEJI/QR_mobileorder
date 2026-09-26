"use client";

import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { parseBulkMenu } from "@/lib/handy";

/** メニューのまとめて登録（ハンディモードの店向け。金額・在庫は持たないので品名とカテゴリだけ） */
export default function BulkAddMenu({ defaultCat }: { defaultCat: string }) {
  const bulkAddMenu = useAppStore((s) => s.bulkAddMenu);
  const pushToast = useAppStore((s) => s.pushToast);
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
  };

  return (
    <div
      style={{
        background: "var(--glass)",
        backdropFilter: "blur(22px) saturate(180%)",
        WebkitBackdropFilter: "blur(22px) saturate(180%)",
        border: "1px solid var(--glass-edge)",
        borderRadius: "22px",
        padding: "20px 22px",
        boxShadow: "inset 0 1px 0 var(--glass-spec), var(--glass-shadow)",
      }}
    >
      <div style={{ fontSize: "17px", fontWeight: 800 }}>まとめて登録</div>
      <div style={{ fontSize: "12px", color: "var(--text-2)", margin: "4px 0 12px", lineHeight: 1.6 }}>
        1行に1品。「焼酎 / 富乃宝山」のようにカテゴリを付けるか、「【焼酎】」の行の下に品名を並べます。
        無いカテゴリは自動で作り、同じカテゴリに同じ名前がある品は飛ばします。
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder={"【焼酎】\n富乃宝山\n佐藤 黒\nワイン / CAVA"}
        aria-label="まとめて登録する品目"
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: "12px",
          border: "none",
          background: "var(--hairline)",
          fontSize: "15px",
          fontFamily: "inherit",
          color: "var(--text)",
          resize: "vertical",
          lineHeight: 1.6,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginTop: "10px" }}>
        <span style={{ fontSize: "13px", color: "var(--text-2)" }}>
          {items.length > 0 ? `${items.length}品を読み取りました` : ""}
        </span>
        <button
          onClick={submit}
          disabled={busy || items.length === 0}
          style={{
            padding: "11px 22px",
            borderRadius: "999px",
            border: "none",
            background: items.length === 0 ? "var(--text-3)" : "var(--accent)",
            color: "#fff",
            fontFamily: "inherit",
            fontSize: "14px",
            fontWeight: 700,
            cursor: busy || items.length === 0 ? "default" : "pointer",
          }}
        >
          {busy ? "登録中…" : "まとめて登録"}
        </button>
      </div>
    </div>
  );
}
