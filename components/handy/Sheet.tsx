"use client";

/** ハンディ画面の下から出るシート（卓移動・レジ用の一覧で共通） */
export default function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(0,0,0,.32)",
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxHeight: "86dvh",
          display: "flex",
          flexDirection: "column",
          background: "var(--glass-strong)",
          backdropFilter: "blur(30px) saturate(180%)",
          WebkitBackdropFilter: "blur(30px) saturate(180%)",
          borderTop: "1px solid var(--glass-edge)",
          borderRadius: "24px 24px 0 0",
          padding: "16px 14px calc(16px + env(safe-area-inset-bottom))",
          animation: "sheetup .3s ease-out",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <span style={{ flex: 1, fontSize: "19px", fontWeight: 800 }}>{title}</span>
          <button
            onClick={onClose}
            style={{
              padding: "8px 14px",
              borderRadius: "999px",
              border: "none",
              background: "var(--control-tint)",
              color: "var(--text)",
              fontFamily: "inherit",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            閉じる
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>{children}</div>
        {footer && <div style={{ marginTop: "14px" }}>{footer}</div>}
      </div>
    </div>
  );
}
