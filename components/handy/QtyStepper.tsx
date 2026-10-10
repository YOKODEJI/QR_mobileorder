"use client";

import { stepButton, tapFeedback } from "@/components/handy/ui";

/** 入力中の数を − ＋ で合わせる（注文入力の行。お客様の注文画面と同じ並び） */
export default function QtyStepper({
  qty,
  label,
  onDec,
  onInc,
}: {
  qty: number;
  /** 何の数か（読み上げ用。例: 「生ビール」「日本酒（一合）」） */
  label: string;
  onDec: () => void;
  onInc: () => void;
}) {
  const button: React.CSSProperties = { ...stepButton, width: "44px", height: "44px" };
  return (
    <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: "6px" }}>
      <button
        onClick={() => {
          onDec();
          tapFeedback();
        }}
        aria-label={`${label}を1つ減らす`}
        style={button}
      >
        −
      </button>
      <span
        aria-live="polite"
        style={{ minWidth: "30px", textAlign: "center", fontSize: "22px", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "var(--accent)" }}
      >
        {qty}
      </span>
      <button
        onClick={() => {
          onInc();
          tapFeedback();
        }}
        aria-label={`${label}を1つ増やす`}
        style={{ ...button, background: "var(--accent)", color: "var(--accent-ink)", border: "none" }}
      >
        ＋
      </button>
    </span>
  );
}
