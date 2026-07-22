"use client";

import { useRef } from "react";

/** 横スクロール可能な要素の内側から始まったタッチかどうかを判定する。
 *  メニュー管理の行(.menu-rows)やカテゴリのチップ行(ChipRow)のように、
 *  そのタッチ自体を消費すべき横スクロール領域では、カテゴリスワイプを発火させない。
 *
 *  ChipRowには明示的な `data-hscroll` を付けてあるので最優先でそれを見る
 *  （scrollWidth/clientWidthの比較だけに頼ると、初回描画直後でレイアウトが
 *  確定しきっていない・境界値で丸めが効く等のタイミング次第で誤判定しうるため、
 *  「そこは常に横スクロール領域である」と分かっている場所は目印で確実に判定する）。
 *  それ以外(.menu-rowsなど、目印を付けていない汎用の横スクロール領域)は
 *  従来通りoverflow-x + scrollWidthの実測で判定する。 */
function startedInsideHorizontalScroller(target: EventTarget | null): boolean {
  let el = target instanceof HTMLElement ? target : null;
  while (el) {
    if (el.hasAttribute("data-hscroll")) return true;
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
 * 左右スワイプで値(カテゴリ/管理タブ等の文字列の並び)を切り替える汎用フック
 * （客画面・代理注文・メニュー管理のカテゴリ切替、管理ツールのタブ切替で共通利用）。
 * 返り値のonTouchStart/onTouchEndを、対象のスクロール領域(要素)に付けるだけで使える。
 *
 * 誤爆対策:
 * - 横移動量が縦移動量の1.5倍を超えるときだけ発火（縦スクロール中の誤爆を防ぐ）。
 * - 横移動量が60px未満は無視。
 * - タッチ開始点が横スクロール可能な要素(メニュー管理の行など)の内側なら無効化。
 * - 端（先頭/末尾）では循環せず停止する。
 * - stopPropagation()で常にこのタッチジェスチャーを自分の領域内で握り潰す。
 *   これにより、カテゴリ切替(内側)と管理タブ切替(外側=AdminShellのmain)を
 *   同じ画面に入れ子で置いても、1回のスワイプが両方を同時に発火させない
 *   （より具体的な内側の領域が常に優先される）。
 */
export function useSwipeCategory({
  categories,
  current,
  onChange,
}: {
  /** "すべて"を含む、表示順そのままのカテゴリ一覧（管理タブ切替の場合はタブのkey一覧） */
  categories: string[];
  current: string;
  onChange: (c: string) => void;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (startedInsideHorizontalScroller(e.target)) {
      start.current = null;
      return;
    }
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    const s = start.current;
    start.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const next = resolveSwipeTarget(current, categories, t.clientX - s.x, t.clientY - s.y);
    if (next) onChange(next);
  };

  return { onTouchStart, onTouchEnd };
}
