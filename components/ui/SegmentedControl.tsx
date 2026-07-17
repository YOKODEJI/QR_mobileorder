"use client";

import { segBtn } from "@/lib/styles";

interface Seg<T extends string> {
  value: T;
  label: string;
}

export default function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
}: {
  segments: Seg<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        background: "var(--control-tint)",
        borderRadius: "12px",
        padding: "3px",
        gap: "3px",
      }}
    >
      {segments.map((s) => (
        <button
          key={s.value}
          onClick={() => onChange(s.value)}
          style={segBtn(value === s.value)}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
