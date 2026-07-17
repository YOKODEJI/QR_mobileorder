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
          background: "var(--hairline)",
          color: "var(--text)",
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
        <span style={{ fontSize: "9px", color: "var(--text-3)" }}>▾</span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.32)",
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
              background: "var(--glass-strong)",
              backdropFilter: "blur(30px) saturate(180%)",
              WebkitBackdropFilter: "blur(30px) saturate(180%)",
              border: "1px solid var(--glass-edge)",
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
                background: "var(--soldout-bg)",
                margin: "0 auto 12px",
              }}
            />
            {label && (
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "var(--text-2)",
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
                    borderTop: i === 0 ? "none" : "1px solid var(--hairline)",
                    background: "transparent",
                    padding: "14px 16px",
                    fontSize: "16px",
                    fontFamily: "inherit",
                    color: opt === value ? accent : "var(--text)",
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
