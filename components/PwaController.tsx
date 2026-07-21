"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";

const DISMISS_KEY = "pwaInstallDismissedAt";
const DISMISS_DAYS = 14; // この期間は再度出さない（毎回出ると邪魔なため）

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safariはdisplay-modeを見ないので専用プロパティで判定
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** 管理画面(/admin)専用: Service Worker登録 + ホーム画面追加バナー。
 *  客用ページ(/order/[table])には一切マウントしない。 */
export default function PwaController() {
  const accent = useAppStore((s) => s.settings.theme);
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/admin-sw.js", { scope: "/admin/" })
        .catch((e) => console.error("admin-sw registration failed:", e));
    }

    if (isStandalone()) return; // 既にインストール済みなら案内不要

    const lastDismissed = Number(localStorage.getItem(DISMISS_KEY) ?? "0");
    const recentlyDismissed = Date.now() - lastDismissed < DISMISS_DAYS * 86400000;
    setDismissed(recentlyDismissed);
    if (recentlyDismissed) return;

    if (isIos()) {
      setShowIosHint(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
    setDeferredPrompt(null);
    setShowIosHint(false);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    // Chrome/Edge等のprompt()はChromiumの型のみが持つ独自メソッド（DOM標準Eventにはない）
    await (deferredPrompt as Event & { prompt: () => Promise<void> }).prompt();
    setDeferredPrompt(null);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  if (dismissed || (!deferredPrompt && !showIosHint)) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: "12px",
        right: "12px",
        bottom: "12px",
        zIndex: 100,
        background: "var(--glass-strong)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        border: "1px solid var(--glass-edge)",
        borderRadius: "18px",
        padding: "14px 16px",
        boxShadow: "inset 0 1px 0 var(--glass-spec), var(--glass-shadow)",
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--text)" }}>
          ホーム画面に追加できます
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-2)", marginTop: "2px" }}>
          {showIosHint
            ? "共有ボタン → 「ホーム画面に追加」からアプリのように起動できます"
            : "アプリのようにアイコンから直接起動できます"}
        </div>
      </div>
      {!showIosHint && (
        <button
          onClick={install}
          style={{
            border: "none",
            background: accent,
            color: "#fff",
            borderRadius: "999px",
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          追加する
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label="閉じる"
        style={{
          border: "none",
          background: "var(--control-tint)",
          color: "var(--text-2)",
          borderRadius: "50%",
          width: "28px",
          height: "28px",
          fontSize: "13px",
          cursor: "pointer",
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  );
}
