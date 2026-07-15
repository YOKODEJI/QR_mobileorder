"use client";

import { useState } from "react";

/** iOS風のボトムシート・ピッカー（ネイティブ<select>の代わり）。タップで選択肢シートを開く。 */
export default function Picker({
  value,
  options,
  onChange,
  label,
  accent,
  triggerStyle,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  label?: string;
  accent: string;
  triggerStyle?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          border: "none",
          background: "#f0f0f2",
          color: "#1c1c1e",
          borderRadius: "999px",
          padding: "6px 10px 6px 14px",
          fontSize: "13px",
          fontWeight: 700,
          fontFamily: "inherit",
          cursor: "pointer",
          ...triggerStyle,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
        <span style={{ fontSize: "9px", color: "#a0a0a5" }}>▾</span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.35)",
            zIndex: 80,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "480px",
              background: "#f2f2f7",
              borderRadius: "20px 20px 0 0",
              padding: "10px 12px 24px",
              maxHeight: "70vh",
              overflowY: "auto",
              animation: "sheetup .3s ease-out",
            }}
          >
            <div
              style={{
                width: "38px",
                height: "5px",
                borderRadius: "999px",
                background: "#d1d1d6",
                margin: "0 auto 12px",
              }}
            />
            {label && (
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#8e8e93",
                  textAlign: "center",
                  marginBottom: "8px",
                  textTransform: "uppercase",
                  letterSpacing: ".04em",
                }}
              >
                {label}
              </div>
            )}
            <div style={{ background: "#fff", borderRadius: "14px", overflow: "hidden" }}>
              {options.map((opt, i) => (
                <button
                  key={opt}
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    border: "none",
                    borderTop: i === 0 ? "none" : "1px solid #f0f0f2",
                    background: "transparent",
                    padding: "14px 16px",
                    fontSize: "16px",
                    fontFamily: "inherit",
                    color: opt === value ? accent : "#1c1c1e",
                    fontWeight: opt === value ? 700 : 400,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {opt}
                  {opt === value && <span style={{ color: accent, fontWeight: 800 }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
