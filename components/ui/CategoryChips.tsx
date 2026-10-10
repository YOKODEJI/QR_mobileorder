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
              padding: "8px 14px",
              borderRadius: "12px",
              // 選択中は墨で塗る（強調色は主操作と「提供前」に取っておく）
              border: on ? "1px solid var(--text)" : "1px solid var(--glass-edge)",
              background: on ? "var(--text)" : "var(--glass-strong)",
              boxShadow: on ? "none" : "inset 0 1px 0 var(--glass-spec)",
              color: on ? "#fff" : "var(--text)",
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
