"use client";

import { useEffect, useState } from "react";

/** この画面を作った版の印（ビルドした時刻。next.config.ts で埋め込む） */
export const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "";

/** 版の印を「10/24 18:40」の形にする（画面の隅に出して、どの版が動いているかを確かめられるように） */
export function buildLabel(id: string = BUILD_ID): string {
  const d = new Date(id);
  if (Number.isNaN(d.getTime())) return "";
  // 日本時間で出す（サーバーとiPadで時刻の地域が違っても、同じ表示になるように）
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  );
  return `${parts.month}/${parts.day} ${parts.hour}:${parts.minute}`;
}

const CHECK_MS = 5 * 60 * 1000;

/** 新しい版を公開したのに、端末が古い版のまま動き続けていたら知らせる。
 *  厨房のタブレットやホーム画面に追加したアプリは、閉じずに何日も開いたままになり、直しが届かないため
 *  （2026-10-24 iPadの通知音の直しが届いているか分からなかった件）。
 *  勝手に読み込み直すと、厨房の「タップして開始」がやり直しになり音が鳴らなくなるので、押してもらう */
export default function UpdateNotice() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (!BUILD_ID) return;
    const check = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/version", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((v: { build?: string } | null) => {
          if (v?.build && v.build !== BUILD_ID) setStale(true);
        })
        .catch(() => {});
    };
    const first = window.setTimeout(check, 3000);
    const timer = window.setInterval(check, CHECK_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  if (!stale) return null;
  return (
    <button
      onClick={() => window.location.reload()}
      style={{
        position: "fixed",
        left: "50%",
        top: "calc(10px + env(safe-area-inset-top))",
        transform: "translateX(-50%)",
        zIndex: 90,
        maxWidth: "calc(100% - 24px)",
        padding: "12px 18px",
        borderRadius: "14px",
        border: "none",
        background: "var(--text)",
        color: "#fff",
        fontFamily: "inherit",
        fontSize: "16px",
        fontWeight: 800,
        lineHeight: 1.4,
        boxShadow: "0 10px 30px -10px rgba(0,0,0,.5)",
        cursor: "pointer",
      }}
    >
      新しい版があります。ここを押して読み込み直してください
    </button>
  );
}
