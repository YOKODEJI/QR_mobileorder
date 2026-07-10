"use client";

import { useAppStore } from "@/store/useAppStore";

export default function AlertDialog() {
  const dialog = useAppStore((s) => s.dialog);
  const closeDialog = useAppStore((s) => s.closeDialog);
  if (!dialog) return null;

  return (
    <div
      onClick={closeDialog}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.35)",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "300px",
          maxWidth: "100%",
          background: "rgba(250,250,250,.98)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRadius: "20px",
          boxShadow: "0 24px 60px rgba(0,0,0,.4)",
          overflow: "hidden",
          animation: "pop .22s ease-out",
        }}
      >
        <div style={{ padding: "20px 18px 16px", textAlign: "center" }}>
          <div style={{ fontSize: "19px", fontWeight: 700, marginBottom: "8px" }}>
            {dialog.title}
          </div>
          <div
            style={{
              fontSize: "17px",
              color: "#6b6b70",
              lineHeight: 1.6,
              whiteSpace: "pre-line",
            }}
          >
            {dialog.body}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            borderTop: "1px solid rgba(0,0,0,.1)",
          }}
        >
          <button
            onClick={closeDialog}
            style={{
              flex: 1,
              padding: "13px",
              border: "none",
              background: "transparent",
              color: "#007aff",
              fontSize: "16px",
              fontFamily: "inherit",
              cursor: "pointer",
              borderRight: "1px solid rgba(0,0,0,.1)",
            }}
          >
            キャンセル
          </button>
          <button
            onClick={dialog.onConfirm}
            style={{
              flex: 1,
              padding: "13px",
              border: "none",
              background: "transparent",
              color: dialog.danger ? "#ff3b30" : "#007aff",
              fontSize: "16px",
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {dialog.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
