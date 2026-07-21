"use client";

import { chipStyle } from "@/lib/styles";
import type { CatFilter } from "@/store/useAppStore";
import { useAppStore } from "@/store/useAppStore";

export default function ChipRow({
  value,
  onChange,
  accent,
  borderBottom = false,
  wrap = false,
}: {
  value: CatFilter;
  onChange: (c: CatFilter) => void;
  accent: string;
  borderBottom?: boolean;
  wrap?: boolean;
}) {
  const categories = useAppStore((s) => s.categories);
  const filters: CatFilter[] = ["すべて", ...categories];
  return (
    <div
      // カテゴリ切替スワイプ(lib/useSwipeCategory.ts)の除外判定に使う目印。
      // このチップ行自体が横スクロールするため、カテゴリ切替スワイプの対象から
      // 明示的に除外し、チップ行内でのドラッグは常にチップ行自身の横スクロールに使わせる。
      data-hscroll={wrap ? undefined : "true"}
      style={{
        display: "flex",
        flexWrap: wrap ? "wrap" : "nowrap",
        gap: "8px",
        overflowX: wrap ? "visible" : "auto",
        padding: "12px 14px",
        borderBottom: borderBottom ? "1px solid var(--hairline)" : undefined,
      }}
    >
      {filters.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          style={chipStyle(value === c, accent)}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
