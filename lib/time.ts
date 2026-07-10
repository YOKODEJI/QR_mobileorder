/* 時刻ユーティリティ。注文は ISO文字列で保持し、表示だけ整形する（日跨ぎでも順序が壊れない） */

import { useEffect, useState } from "react";

/**
 * 現在時刻(ms)を一定間隔で返すフック。
 * SSRとの不一致を避けるため、マウント前は 0 を返す（呼び出し側は 0 の間は時刻表示を伏せる）。
 */
export function useNow(intervalMs = 20000): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function hm(iso: string): string {
  const d = new Date(iso);
  return (
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0")
  );
}

/** 注文からの経過分数（負値は0に丸め） */
export function elapsedMin(iso: string, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}
