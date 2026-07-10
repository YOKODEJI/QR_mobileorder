"use client";

import { chipStyle } from "@/lib/styles";
import type { CatFilter } from "@/store/useAppStore";
import { CAT_FILTERS } from "@/store/useAppStore";

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
  return (
    <div
      style={{
        display: "flex",
        flexWrap: wrap ? "wrap" : "nowrap",
        gap: "8px",
        overflowX: wrap ? "visible" : "auto",
        padding: "12px 14px",
        borderBottom: borderBottom ? "1px solid #f0f0f2" : undefined,
      }}
    >
      {CAT_FILTERS.map((c) => (
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
