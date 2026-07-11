"use client";

export default function LoadingScreen({ label = "読み込み中…" }: { label?: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        padding: "60px 20px",
        minHeight: "300px",
      }}
    >
      <span
        style={{
          width: "34px",
          height: "34px",
          borderRadius: "50%",
          border: "3px solid #e4e4ea",
          borderTopColor: "var(--accent)",
          animation: "spin .8s linear infinite",
        }}
      />
      <span style={{ fontSize: "14px", color: "#8e8e93" }}>{label}</span>
    </div>
  );
}
