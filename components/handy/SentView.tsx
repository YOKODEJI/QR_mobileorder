"use client";

import { card, itemName, primaryButton, secondaryButton, subText } from "@/components/handy/ui";

/** 送信した注文の1行（完了画面に出す控え） */
export interface SentLine {
  name: string;
  /** 飲み方など（無ければ空） */
  optionsText: string;
  /** 品の数とは別の数（瓶に付けるグラスの数）。品名と分けて出す */
  counts: { label: string; value: number }[];
  note: string;
  qty: number;
}

/** 注文を厨房へ送ったあとの完了画面。送れたことと、何を送ったかを確かめてから次へ進む */
export default function SentView({
  tableName,
  lines,
  onTables,
  onTable,
  onMore,
}: {
  tableName: string;
  lines: SentLine[];
  onTables: () => void;
  onTable: () => void;
  onMore: () => void;
}) {
  const total = lines.reduce((a, l) => a + l.qty, 0);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "14px", padding: "20px 12px calc(20px + env(safe-area-inset-bottom))" }}>
      <div role="status" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "10px 0 4px" }}>
        <span
          aria-hidden
          style={{
            width: "72px",
            height: "72px",
            borderRadius: "50%",
            background: "var(--green)",
            color: "#fff",
            fontSize: "40px",
            fontWeight: 800,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "pop .3s var(--ease-spring)",
          }}
        >
          ✓
        </span>
        <span style={{ fontSize: "24px", fontWeight: 800, lineHeight: 1.3 }}>厨房へ送信しました</span>
        <span style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-2)" }}>
          {tableName}・{total}点
        </span>
      </div>

      <div style={{ ...card, padding: "4px 14px" }}>
        {lines.map((l, i) => (
          <div key={i} style={{ padding: "9px 0", borderTop: i === 0 ? "none" : "1px solid var(--hairline)" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={itemName}>{l.name}</span>
                {l.optionsText && <span style={subText}>{l.optionsText}</span>}
                {l.note && <span style={subText}>※ {l.note}</span>}
              </span>
              <span style={{ fontSize: "20px", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>×{l.qty}</span>
            </div>
            {l.counts.map((c) => (
              <div key={c.label} style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "2px" }}>
                <span style={{ ...itemName, flex: 1, minWidth: 0 }}>{c.value === 0 ? `${c.label}なし` : c.label}</span>
                {c.value > 0 && <span style={{ fontSize: "20px", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>×{c.value}</span>}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={onMore} style={secondaryButton}>
            続けて注文する
          </button>
          <button onClick={onTable} style={secondaryButton}>
            この卓を見る
          </button>
        </div>
        <button onClick={onTables} style={primaryButton}>
          卓一覧へ戻る
        </button>
      </div>
    </div>
  );
}
