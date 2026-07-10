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
  background: active ? "#fff" : "transparent",
  color: active ? "#1c1c1e" : "#6b6b70",
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
  border: "none",
  background: active ? accent : "rgba(118,118,128,.1)",
  color: active ? "#fff" : "#3c3c43",
  fontWeight: active ? 700 : 600,
  flexShrink: 0,
});

export const itemCardStyle = (soldOut: boolean): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "11px 12px",
  background: soldOut ? "#f7f7f9" : "#fff",
  border: "1px solid #f0f0f2",
  borderRadius: "16px",
  opacity: soldOut ? 0.6 : 1,
});

export const addBtnStyle = (accent: string): CSSProperties => ({
  padding: "12px 22px",
  borderRadius: "12px",
  border: "none",
  background: accent,
  color: "#fff",
  fontFamily: "inherit",
  fontWeight: 700,
  fontSize: "15px",
  cursor: "pointer",
});

export const stepAddStyle = (accent: string): CSSProperties => ({
  width: "44px",
  height: "44px",
  borderRadius: "12px",
  border: "none",
  background: accent,
  color: "#fff",
  fontSize: "24px",
  fontWeight: 600,
  cursor: "pointer",
  lineHeight: 1,
});

export const stepSubStyle = (accent: string): CSSProperties => ({
  width: "44px",
  height: "44px",
  borderRadius: "12px",
  border: "none",
  background: "#f0f0f2",
  color: accent,
  fontSize: "24px",
  fontWeight: 600,
  cursor: "pointer",
  lineHeight: 1,
});

export const proxyCardStyle = (soldOut: boolean): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  padding: "9px 10px",
  background: soldOut ? "#f7f7f9" : "#fff",
  border: "1px solid #f0f0f2",
  borderRadius: "12px",
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
  background: "#f0f0f2",
  color: accent,
  fontSize: "18px",
  fontWeight: 600,
  cursor: "pointer",
  lineHeight: 1,
});
