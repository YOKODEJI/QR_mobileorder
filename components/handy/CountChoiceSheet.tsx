"use client";

import { useState } from "react";
import type { CountSteps } from "@/lib/options";
import Sheet from "@/components/handy/Sheet";
import CountStepper from "@/components/handy/CountStepper";
import { disabledLook, primaryButton, stepButton, tapFeedback } from "@/components/handy/ui";

const MAX_QTY = 20;

/** 品目を押したときに、本体の数と、付ける数（瓶に付けるグラスの数）を＋−で合わせてから入れるシート。
 *  どちらも最初は1。付ける数は「この注文ぜんぶで」の数で、伝票や一覧では品名と分けて出す（例: 「瓶ビール ×2」「グラス ×3」） */
export default function CountChoiceSheet({
  itemName,
  title,
  count,
  onAdd,
  onClose,
}: {
  itemName: string;
  /** 何の数か（例: 「グラスの数」） */
  title: string;
  count: CountSteps;
  onAdd: (optionId: string, qty: number) => void;
  onClose: () => void;
}) {
  const initial = count.steps.find((s) => s.value === 1) ?? count.steps[0];
  const [selectedId, setSelectedId] = useState(initial.option.id);
  const [qty, setQty] = useState(1);
  const changeQty = (next: number) => {
    setQty(Math.max(1, Math.min(MAX_QTY, next)));
    tapFeedback();
  };
  const big: React.CSSProperties = { ...stepButton, width: "72px", height: "64px", fontSize: "30px" };

  return (
    <Sheet
      title={itemName}
      onClose={onClose}
      footer={
        <button onClick={() => onAdd(selectedId, qty)} style={primaryButton}>
          追加する
        </button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div
          role="group"
          aria-label={`${itemName}の数`}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
            padding: "14px 16px 18px",
            borderRadius: "14px",
            background: "var(--chip-tint)",
          }}
        >
          <span style={{ fontSize: "18px", fontWeight: 800 }}>{itemName}の数</span>
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <button onClick={() => changeQty(qty - 1)} disabled={qty <= 1} aria-label={`${itemName}を1つ減らす`} style={{ ...big, ...disabledLook(qty <= 1) }}>
              −
            </button>
            <span
              aria-live="polite"
              style={{ minWidth: "84px", textAlign: "center", fontSize: "44px", fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}
            >
              {qty}
            </span>
            <button
              onClick={() => changeQty(qty + 1)}
              disabled={qty >= MAX_QTY}
              aria-label={`${itemName}を1つ増やす`}
              style={{ ...big, ...disabledLook(qty >= MAX_QTY) }}
            >
              ＋
            </button>
          </div>
        </div>
        <CountStepper title={title} count={count} selectedId={selectedId} onChange={(o) => setSelectedId(o.id)} large />
      </div>
    </Sheet>
  );
}
