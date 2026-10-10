"use client";

import type { CountSteps, MenuOption } from "@/lib/options";
import { disabledLook, stepButton, tapFeedback } from "@/components/handy/ui";

/** 数を＋−で合わせる（瓶に付けるグラスの数など）。選べる数は steps にあるものだけ */
export default function CountStepper({
  title,
  count,
  selectedId,
  onChange,
  large = false,
}: {
  /** 何の数か（例: 「グラスの数」） */
  title: string;
  count: CountSteps;
  selectedId: string | undefined;
  onChange: (option: MenuOption) => void;
  /** 品目を押した直後のシート用に、見出しを上に置いて大きく出す */
  large?: boolean;
}) {
  const index = Math.max(
    0,
    count.steps.findIndex((s) => s.option.id === selectedId)
  );
  const current = count.steps[index];
  const prev = count.steps[index - 1];
  const next = count.steps[index + 1];
  const move = (to: typeof current | undefined) => {
    if (!to) return;
    onChange(to.option);
    tapFeedback();
  };
  const button = (off: boolean): React.CSSProperties => ({
    ...stepButton,
    ...(large ? { width: "72px", height: "64px", fontSize: "30px" } : {}),
    ...disabledLook(off),
  });

  return (
    <div
      role="group"
      aria-label={title}
      style={{
        display: "flex",
        flexDirection: large ? "column" : "row",
        alignItems: "center",
        gap: "12px",
        padding: large ? "14px 16px 18px" : "8px 10px",
        borderRadius: "8px",
        background: "var(--inset)",
        border: "1.5px solid var(--rule)",
      }}
    >
      <span style={{ flex: large ? "none" : 1, minWidth: 0, fontSize: large ? "18px" : "16px", fontWeight: 800 }}>{title}</span>
      <div style={{ display: "flex", alignItems: "center", gap: large ? "20px" : "12px" }}>
        <button onClick={() => move(prev)} disabled={!prev} aria-label={`${title}を1つ減らす`} style={button(!prev)}>
          −
        </button>
        <span
          aria-live="polite"
          style={{
            minWidth: large ? "84px" : "48px",
            textAlign: "center",
            fontSize: large ? "44px" : "22px",
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          {current.value}
          <span style={{ fontSize: large ? "18px" : "14px", marginLeft: "2px" }}>個</span>
        </span>
        <button onClick={() => move(next)} disabled={!next} aria-label={`${title}を1つ増やす`} style={button(!next)}>
          ＋
        </button>
      </div>
    </div>
  );
}
