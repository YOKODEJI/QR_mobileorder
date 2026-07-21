"use client";

import { useRef } from "react";

/** 横スクロール可能な要素の内側から始まったタッチかどうかを判定する。
 *  メニュー管理の行(.menu-rows)のように、そのタッチ自体を消費すべき
 *  横スクロール領域では、カテゴリスワイプを発火させない。 */
function startedInsideHorizontalScroller(target: EventTarget | null): boolean {
  let el = target instanceof HTMLElement ? target : null;
  while (el) {
    const style = getComputedStyle(el);
    const scrollable = style.overflowX === "auto" || style.overflowX === "scroll";
    if (scrollable && el.scrollWidth > el.clientWidth + 1) return true;
    el = el.parentElement;
  }
  return false;
}

const SWIPE_MIN_DISTANCE = 60;
const SWIPE_DIRECTION_RATIO = 1.5; // 横移動量がこの倍率を超えて縦移動量より大きい時だけ発火

/** スワイプ判定の純粋ロジック（DOM/Reactに依存しない部分だけを切り出し、単体テスト可能にしている）。
 *  次に切り替えるべきカテゴリ名を返す。発火条件を満たさない/端で止まる場合はnull。 */
export function resolveSwipeTarget(
  current: string,
  categories: string[],
  dx: number,
  dy: number
): string | null {
  if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return null;
  if (Math.abs(dx) <= Math.abs(dy) * SWIPE_DIRECTION_RATIO) return null; // 縦スクロール優位なら無視

  const idx = categories.indexOf(current);
  if (idx === -1) return null;
  if (dx < 0 && idx < categories.length - 1) return categories[idx + 1];
  if (dx > 0 && idx > 0) return categories[idx - 1];
  return null;
}

/**
 * 左右スワイプでカテゴリフィルタを切り替える（客画面・代理注文・メニュー管理で共通）。
 * 返り値のonTouchStart/onTouchEndを、対象のスクロール領域(要素)に付けるだけで使える。
 *
 * 誤爆対策:
 * - 横移動量が縦移動量の1.5倍を超えるときだけ発火（縦スクロール中の誤爆を防ぐ）。
 * - 横移動量が60px未満は無視。
 * - タッチ開始点が横スクロール可能な要素(メニュー管理の行など)の内側なら無効化。
 * - 端（先頭/末尾）では循環せず停止する。
 */
export function useSwipeCategory({
  categories,
  current,
  onChange,
}: {
  /** "すべて"を含む、表示順そのままのカテゴリ一覧 */
  categories: string[];
  current: string;
  onChange: (c: string) => void;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    if (startedInsideHorizontalScroller(e.target)) {
      start.current = null;
      return;
    }
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const next = resolveSwipeTarget(current, categories, t.clientX - s.x, t.clientY - s.y);
    if (next) onChange(next);
  };

  return { onTouchStart, onTouchEnd };
}
