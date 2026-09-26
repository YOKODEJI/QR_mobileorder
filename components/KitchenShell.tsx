"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase";
import KitchenDisplay from "@/components/kitchen/KitchenDisplay";
import SupabaseSync from "@/components/SupabaseSync";
import AlertDialog from "@/components/ui/AlertDialog";
import Toast from "@/components/ui/Toast";
import LoadingScreen from "@/components/ui/LoadingScreen";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', var(--font-noto-sans-jp), 'Noto Sans JP', sans-serif";

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
      style={{
        minHeight: "100vh",
        background: "var(--app-bg)",
        fontFamily: FONT,
        color: "var(--text)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div aria-hidden className="ambient-wash" />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          padding: "12px 20px 0",
          position: "relative",
          zIndex: 1,
        }}
      >
        <span style={{ fontWeight: 800, fontSize: "17px" }}>
          {storeName}
          <span style={{ fontSize: "12px", color: "var(--text-2)", marginLeft: "8px", fontWeight: 600 }}>厨房</span>
        </span>
        {isSupabaseConfigured() && (
          <button
            onClick={() => getSupabase()?.auth.signOut()}
            style={{
              padding: "7px 14px",
              borderRadius: "999px",
              border: "none",
              background: "var(--control-tint)",
              color: "var(--text-2)",
              fontFamily: "inherit",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ログアウト
          </button>
        )}
      </div>

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
