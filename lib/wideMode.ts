"use client";

import { useSyncExternalStore } from "react";

// 厨房の「全画面」。上の見出しやタブを隠して、伝票だけを広く出す（2026-10-31 長谷川さん）。
//   ・ブラウザの全画面表示（Fullscreen API）に対応した端末（iPad・PC・Android）では、アドレスバーなども消える
//   ・対応していない端末（iPhone）でも、見出しやタブは隠れる
//   ・ホーム画面に追加したアプリ（standalone）は、もともとアドレスバーが無い
// 全画面を終えるのは、厨房の「全画面を終わる」ボタン、端末の「戻る」、Esc、画面の端からのスワイプのどれでも。

type FsDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

let wide = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const inFullscreen = () => {
  const d = document as FsDoc;
  return !!(document.fullscreenElement || d.webkitFullscreenElement);
};

/** ブラウザ側で全画面が解かれたとき（Esc・スワイプ）、こちらの表示も元に戻す */
function onFullscreenChange() {
  if (wide && !inFullscreen()) {
    wide = false;
    emit();
  }
}

function subscribe(l: () => void) {
  if (listeners.size === 0) {
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
  }
  listeners.add(l);
  return () => {
    listeners.delete(l);
    if (listeners.size === 0) {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
    }
  };
}

/** 全画面表示にしているか */
export function useWideMode(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => wide,
    () => false
  );
}

/** 全画面表示の入り切り。画面をタップした操作の中で呼ぶこと（ブラウザの決まり） */
export function setWideMode(on: boolean): void {
  wide = on;
  emit();
  try {
    if (on) {
      const el = document.documentElement as FsEl;
      if (!inFullscreen()) {
        const p = el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen?.();
        // 全画面にできない端末でも、見出しを隠した表示のままにする
        if (p && typeof (p as Promise<void>).catch === "function") (p as Promise<void>).catch(() => {});
      }
    } else if (inFullscreen()) {
      const d = document as FsDoc;
      const p = document.exitFullscreen ? document.exitFullscreen() : d.webkitExitFullscreen?.();
      if (p && typeof (p as Promise<void>).catch === "function") (p as Promise<void>).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}
