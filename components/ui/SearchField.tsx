"use client";

import { textInput } from "@/components/handy/ui";

/** 品名などを探す入力欄。注文入力と厨房の売切切替で共通 */
export default function SearchField({
  value,
  onChange,
  placeholder = "品名で探す",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      enterKeyHint="search"
      style={{ ...textInput, padding: "12px 14px" }}
    />
  );
}
