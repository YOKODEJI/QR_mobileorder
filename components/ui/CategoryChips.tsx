"use client";

/** 種類（カテゴリ）の切替。先頭に「すべて」。横に並べ、入り切らない分は横スクロール */
export default function CategoryChips({
  categories,
  value,
  onChange,
}: {
  categories: string[];
  value: string;
  onChange: (cat: string) => void;
}) {
  return (
    <div role="tablist" className="no-scrollbar" style={{ display: "flex", gap: "8px", overflowX: "auto", flexShrink: 0 }}>
      {["すべて", ...categories].map((c) => {
        const on = value === c;
        return (
          <button
            key={c}
            role="tab"
            aria-selected={on}
            onClick={(e) => {
              onChange(c);
              // 選んだ種類が端で切れていたら、見える位置まで寄せる
              e.currentTarget.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
            }}
            style={{
              flexShrink: 0,
              minHeight: "42px",
              padding: "8px 16px",
              borderRadius: "999px",
              border: on ? "1px solid var(--accent)" : "1px solid var(--hairline-strong)",
              background: on ? "var(--accent)" : "var(--surface)",
              color: on ? "var(--accent-ink)" : "var(--text)",
              fontFamily: "inherit",
              fontSize: "16px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}
