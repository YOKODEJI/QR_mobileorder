"use client";

import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { WarningIcon } from "@/components/ui/Icon";

/** 画面下部に積み上がる非ブロッキングの通知（DB書込失敗など）。数秒で自動的に消える。 */
export default function Toast() {
  const { toasts, dismissToast } = useAppStore(
    useShallow((s) => ({ toasts: s.toasts, dismissToast: s.dismissToast }))
  );

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: "24px",
        transform: "translateX(-50%)",
        zIndex: 90,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        alignItems: "center",
        width: "min(92vw, 420px)",
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismissToast(t.id)}
          style={{
            pointerEvents: "auto",
            cursor: "pointer",
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(28,28,30,.92)",
            backdropFilter: "blur(10px)",
            color: "#fff",
            borderRadius: "14px",
            padding: "13px 16px",
            fontSize: "13px",
            fontWeight: 600,
            lineHeight: 1.4,
            boxShadow: "0 8px 24px rgba(0,0,0,.25)",
            animation: "sheetup .25s var(--ease-spring)",
          }}
        >
          <WarningIcon size={15} style={{ flexShrink: 0 }} />
          {t.message}
        </div>
      ))}
    </div>
  );
}
