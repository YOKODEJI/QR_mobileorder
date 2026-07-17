import type { CSSProperties } from "react";

/* プロトタイプの style helper を移植（QRオーダーシステム.dc.html 695-702行） */

export const segBtn = (active: boolean): CSSProperties => ({
  padding: "7px 20px",
  border: "none",
  borderRadius: "9px",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "14px",
  fontWeight: active ? 700 : 600,
  background: active ? "var(--surface)" : "transparent",
  color: active ? "var(--text)" : "var(--text-2)",
  boxShadow: active
    ? "0 1px 3px rgba(0,0,0,.14), 0 1px 1px rgba(0,0,0,.04)"
    : "none",
  transition: "all .15s",
  whiteSpace: "nowrap",
});

export const chipStyle = (active: boolean, accent: string): CSSProperties => ({
  padding: "8px 15px",
  borderRadius: "999px",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "13px",
  whiteSpace: "nowrap",
  border: active ? "1px solid transparent" : "1px solid var(--glass-edge)",
  background: active ? accent : "var(--glass)",
  backdropFilter: active ? undefined : "blur(14px) saturate(180%)",
  WebkitBackdropFilter: active ? undefined : "blur(14px) saturate(180%)",
  boxShadow: active
    ? "inset 0 1px 0 rgba(255,255,255,.3)"
    : "inset 0 1px 0 var(--glass-spec)",
  color: active ? "var(--accent-ink)" : "var(--text-2)",
  fontWeight: active ? 700 : 600,
  flexShrink: 0,
});

export const itemCardStyle = (soldOut: boolean): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "11px 12px",
  background: "var(--glass)",
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  border: "1px solid var(--glass-edge)",
  borderRadius: "20px",
  boxShadow: "inset 0 1px 0 var(--glass-spec), var(--glass-shadow)",
  opacity: soldOut ? 0.55 : 1,
});

export const addBtnStyle = (accent: string): CSSProperties => ({
  padding: "12px 22px",
  borderRadius: "14px",
  border: "none",
  background: accent,
  color: "var(--accent-ink)",
  fontFamily: "inherit",
  fontWeight: 700,
  fontSize: "15px",
  cursor: "pointer",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.3)",
});

export const stepAddStyle = (accent: string): CSSProperties => ({
  width: "44px",
  height: "44px",
  borderRadius: "14px",
  border: "none",
  background: accent,
  color: "var(--accent-ink)",
  fontSize: "24px",
  fontWeight: 600,
  cursor: "pointer",
  lineHeight: 1,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.3)",
});

export const stepSubStyle = (accent: string): CSSProperties => ({
  width: "44px",
  height: "44px",
  borderRadius: "14px",
  border: "1px solid var(--glass-edge)",
  background: "var(--glass-strong)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  color: accent,
  fontSize: "24px",
  fontWeight: 600,
  cursor: "pointer",
  lineHeight: 1,
  boxShadow: "inset 0 1px 0 var(--glass-spec)",
});

export const proxyCardStyle = (soldOut: boolean): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  padding: "9px 10px",
  background: soldOut ? "var(--chip-tint)" : "var(--surface)",
  border: "none",
  borderRadius: "14px",
  boxShadow: soldOut ? "none" : "0 1px 5px rgba(0,0,0,.05)",
  opacity: soldOut ? 0.6 : 1,
});

export const proxyAddStyle = (accent: string): CSSProperties => ({
  width: "32px",
  height: "32px",
  borderRadius: "9px",
  border: "none",
  background: accent,
  color: "#fff",
  fontSize: "18px",
  fontWeight: 600,
  cursor: "pointer",
  lineHeight: 1,
});

export const proxySubStyle = (accent: string): CSSProperties => ({
  width: "32px",
  height: "32px",
  borderRadius: "9px",
  border: "none",
  background: "var(--hairline)",
  color: accent,
  fontSize: "18px",
  fontWeight: 600,
  cursor: "pointer",
  lineHeight: 1,
});
