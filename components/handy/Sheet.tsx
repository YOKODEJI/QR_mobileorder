"use client";

import { PHONE_MAX_WIDTH, pillButton } from "@/components/handy/ui";

/** ハンディ・厨房の画面の下から出るシート。
 *  title の下に header（検索やタブなど、スクロールしないもの）、真ん中に children（スクロールする）、下に footer。 */
export default function Sheet({
  title,
  subtitle,
  onClose,
  children,
  header,
  footer,
  maxWidth = PHONE_MAX_WIDTH,
  tall = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  /** 広い画面で横に伸びすぎないようにする（既定はスマホの幅） */
  maxWidth?: string;
  /** 中身の量で高さが変わらないようにする（絞り込みで一覧が増減するシート向け） */
  tall?: boolean;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(0,0,0,.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth,
          ...(tall ? { height: "86dvh" } : { maxHeight: "86dvh" }),
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          background: "var(--app-bg)",
          borderRadius: "24px 24px 0 0",
          padding: "10px 14px calc(16px + env(safe-area-inset-bottom))",
          animation: "sheetup .3s ease-out",
        }}
      >
        <div aria-hidden style={{ width: "38px", height: "5px", borderRadius: "999px", background: "var(--soldout-bg)", margin: "0 auto" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "20px", fontWeight: 800, lineHeight: 1.25 }}>{title}</div>
            {subtitle && <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-2)", marginTop: "2px" }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={pillButton}>
            閉じる
          </button>
        </div>
        {header}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>{children}</div>
        {footer}
      </div>
    </div>
  );
}
