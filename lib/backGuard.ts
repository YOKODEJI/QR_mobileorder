"use client";

import { useEffect, useRef } from "react";

// 端末の「戻る」（Androidの戻るボタン・戻るジェスチャー、iPhoneの画面端からのスワイプ）で、
// ホーム画面に追加したアプリが閉じてしまうのを防ぐ。
// ハンディ・厨房・管理画面は1つのページの中で画面を切り替えているので、ブラウザから見ると「前のページ」が無く、
// 戻るを押すとアプリそのものが終わってしまう。そこで、履歴に1つ足しておき、戻るが押されたら
// 「いま開いているものを1つ閉じる」（シート → 注文入力 → 卓 → 卓一覧）に読み替える。
//
// 足すのは画面に触れたとき。Chrome は、触れずに足された履歴を「戻る」で飛ばすため。
// 触れずに戻るを続けて押すと、3回目あたりでアプリが閉じる（閉じる手段は残しておく）。

type Handler = () => void;

/** いま開いているものを閉じる手続き。あとから開いたものが後ろに入る */
const handlers: Handler[] = [];

/** active の間、「戻る」でこの手続きを呼ぶ（開いているシート・ダイアログ・奥の画面） */
export function useBackHandler(active: boolean, onBack: Handler): void {
  const latest = useRef(onBack);
  useEffect(() => {
    latest.current = onBack;
  });
  useEffect(() => {
    if (!active) return;
    const handler = () => latest.current();
    handlers.push(handler);
    return () => {
      const i = handlers.indexOf(handler);
      if (i >= 0) handlers.splice(i, 1);
    };
  }, [active]);
}

/** 画面のいちばん外側（ハンディ・厨房・管理画面）で1回だけ呼ぶ */
export function useBackGuard(): void {
  useEffect(() => {
    let armed = false;
    const arm = () => {
      if (armed) return;
      armed = true;
      window.history.pushState({ backGuard: true }, "");
    };
    const onPop = () => {
      armed = false;
      handlers[handlers.length - 1]?.();
      // すぐ足し直す（続けて戻るを押しても、奥の画面から順に戻れるように）
      arm();
    };
    window.addEventListener("pointerdown", arm, true);
    window.addEventListener("keydown", arm, true);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("pointerdown", arm, true);
      window.removeEventListener("keydown", arm, true);
      window.removeEventListener("popstate", onPop);
    };
  }, []);
}
