"use client";

import { useRef, useState } from "react";

/* クリック / ドラッグ&ドロップで画像を設定できる汎用スロット（ローカル保持） */
export default function PhotoSlot({
  height,
  radius = 0,
  label = "写真をドラッグ＆ドロップ／タップで追加",
  value,
  onChange,
}: {
  height: number;
  radius?: number;
  label?: string;
  value?: string | null;
  onChange?: (url: string | null) => void;
}) {
  const [local, setLocal] = useState<string | null>(value ?? null);
  const inputRef = useRef<HTMLInputElement>(null);
  const img = value !== undefined ? value : local;

  const handleFile = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const url = r.result as string;
      if (onChange) onChange(url);
      else setLocal(url);
    };
    r.readAsDataURL(f);
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        handleFile(e.dataTransfer.files?.[0]);
      }}
      style={{
        height: `${height}px`,
        borderRadius: `${radius}px`,
        cursor: "pointer",
        overflow: "hidden",
        background: img ? "transparent" : "#f7f7f9",
        border: img ? "none" : "2px dashed #d1d1d6",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span
          style={{ fontSize: "12px", color: "#8e8e93", fontWeight: 600, padding: "0 12px", textAlign: "center" }}
        >
          {label}
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
