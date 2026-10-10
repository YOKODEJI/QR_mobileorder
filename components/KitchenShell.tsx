"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase";
import KitchenDisplay from "@/components/kitchen/KitchenDisplay";
import SupabaseSync from "@/components/SupabaseSync";
import AlertDialog from "@/components/ui/AlertDialog";
import Toast from "@/components/ui/Toast";
import LoadingScreen from "@/components/ui/LoadingScreen";
import { smallButton } from "@/components/handy/ui";

type WakeLockSentinelLike = { release: () => Promise<void> };

/** 厨房タブレット専用の画面（/kitchen）。厨房ディスプレイだけを全画面で出し、画面を消さない */
export default function KitchenShell() {
  const storeName = useAppStore((s) => s.settings.storeName);
  const theme = useAppStore((s) => s.settings.theme);
  const loaded = useAppStore((s) => s.loaded);
  const syncSoundPref = useAppStore((s) => s.syncSoundPref);
  const loading = isSupabaseConfigured() && !loaded;
  // ブラウザは一度画面に触れるまで音を鳴らせない。最初のタップで音と画面点灯の維持を有効にする
  const [started, setStarted] = useState(false);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", theme);
  }, [theme]);

  useEffect(() => {
    syncSoundPref();
  }, [syncSoundPref]);

  useEffect(() => {
    if (!started) return;
    const wl = (navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
    }).wakeLock;
    if (!wl) return;
    let sentinel: WakeLockSentinelLike | null = null;
    const acquire = () =>
      wl.request("screen").then(
        (s) => (sentinel = s),
        () => {} // 省電力モード等で拒否されても厨房表示は続ける
      );
    // 画面を隠すと自動で解除されるので、戻ってきたら取り直す
    const onVisible = () => {
      if (document.visibilityState === "visible") acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      sentinel?.release().catch(() => {});
    };
  }, [started]);

  return (
    <div
      className="kitchen-ui"
      style={{
        minHeight: "100dvh",
        background: "var(--app-bg)",
        color: "var(--text)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div aria-hidden className="ambient-wash" />
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          padding: "12px 18px 0",
          position: "relative",
          zIndex: 1,
        }}
      >
        <h1 style={{ margin: 0, fontWeight: 800, fontSize: "17px" }}>
          {storeName}
          <span style={{ fontSize: "13px", color: "var(--text-2)", marginLeft: "8px", fontWeight: 600 }}>厨房</span>
        </h1>
        {isSupabaseConfigured() && (
          <button
            onClick={() => getSupabase()?.auth.signOut()}
            style={{ ...smallButton, border: "none", background: "transparent", boxShadow: "none", color: "var(--text-2)", fontSize: "13px" }}
          >
            ログアウト
          </button>
        )}
      </header>

      <main style={{ flex: 1, position: "relative", zIndex: 1 }}>
        {loading ? <LoadingScreen /> : <KitchenDisplay />}
      </main>

      {!started && (
        <button
          onClick={() => setStarted(true)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            border: "none",
            background: "rgba(0,0,0,.55)",
            color: "#fff",
            fontFamily: "inherit",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: "30px", fontWeight: 800 }}>タップして開始</span>
          <span style={{ fontSize: "15px", opacity: 0.85 }}>通知音と、画面が消えない設定を有効にします</span>
        </button>
      )}

      <SupabaseSync staff />
      <AlertDialog />
      <Toast />
    </div>
  );
}
