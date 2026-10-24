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
import { useBackGuard } from "@/lib/backGuard";
import { prepareChime, unlockAudio, playOrderChime } from "@/lib/notifySound";

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
  // 画面が自動で消えるのを止められなかった（その端末では、画面が消えると注文も音も届かない）
  const [wakeLockFailed, setWakeLockFailed] = useState(false);
  const [wakeHintClosed, setWakeHintClosed] = useState(false);
  // 端末の「戻る」で厨房の画面が閉じないようにする
  useBackGuard();

  // 通知音を先に作っておく（最初のタップの確認音から、消音モードでも消えない鳴らし方にできるように）
  useEffect(() => {
    void prepareChime();
  }, []);

  // iPadは画面を隠す・ロックすると音声が止まる。戻ってきたとき、また画面に触れたときに開放し直す
  useEffect(() => {
    if (!started) return;
    const resume = () => {
      if (document.visibilityState === "visible") unlockAudio();
    };
    document.addEventListener("visibilitychange", resume);
    document.addEventListener("pointerdown", resume);
    return () => {
      document.removeEventListener("visibilitychange", resume);
      document.removeEventListener("pointerdown", resume);
    };
  }, [started]);

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
    if (!wl) {
      void Promise.resolve().then(() => setWakeLockFailed(true));
      return;
    }
    let sentinel: WakeLockSentinelLike | null = null;
    const acquire = () =>
      wl.request("screen").then(
        (s) => {
          sentinel = s;
          setWakeLockFailed(false);
        },
        () => setWakeLockFailed(true) // 省電力モード等で拒否されても厨房表示は続ける（案内だけ出す）
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

      {started && wakeLockFailed && !wakeHintClosed && (
        <div
          role="note"
          style={{
            position: "relative",
            zIndex: 1,
            margin: "12px 18px 0",
            padding: "12px 14px",
            borderRadius: "16px",
            background: "var(--amber-bg)",
            border: "1px solid var(--amber-edge)",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            fontSize: "15px",
            lineHeight: 1.6,
          }}
        >
          <span style={{ flex: 1 }}>
            この端末では、画面が自動で消えるのを止められませんでした。画面が消えると、注文が届かず通知音も鳴りません。
            iPadなら「設定 → 画面表示と明るさ → 自動ロック」を「なし」にしてください。
          </span>
          <button onClick={() => setWakeHintClosed(true)} style={{ ...smallButton, flexShrink: 0 }}>
            閉じる
          </button>
        </div>
      )}

      <main style={{ flex: 1, position: "relative", zIndex: 1 }}>
        {loading ? <LoadingScreen /> : <KitchenDisplay />}
      </main>

      {!started && (
        <button
          onClick={() => {
            unlockAudio(); // iPadはタップの中で音声を開放しておかないと、あとの通知音が鳴らない
            playOrderChime(); // 音が出るか、その場で確かめられる
            setStarted(true);
          }}
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
          <span style={{ fontSize: "15px", opacity: 0.85 }}>通知音と、画面が消えない設定を有効にします（確認の音が1回鳴ります）</span>
        </button>
      )}

      <SupabaseSync staff />
      <AlertDialog />
      <Toast />
    </div>
  );
}
