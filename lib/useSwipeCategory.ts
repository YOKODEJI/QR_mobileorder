"use client";

// 左右スワイプ切替の共有ロジック（判定の純粋関数と定数）。
// 実際のカルーセル描画とタッチハンドリングは lib/useSwipePager.tsx が担う。
// このファイルはDOM/Reactに依存する部分を最小限にし、判定ロジックを
// 単体テスト可能な形で切り出しておく置き場。

/** 横スクロール可能な要素の内側から始まったタッチかどうかを判定する。
 *  メニュー管理の行(.menu-rows)やカテゴリのチップ行(ChipRow)のように、
 *  そのタッチ自体を消費すべき横スクロール領域では、ページスワイプを発火させない。
 *
 *  ChipRowには明示的な `data-hscroll` を付けてあるので最優先でそれを見る
 *  （scrollWidth/clientWidthの比較だけに頼ると、初回描画直後でレイアウトが
 *  確定しきっていない・境界値で丸めが効く等のタイミング次第で誤判定しうるため、
 *  「そこは常に横スクロール領域である」と分かっている場所は目印で確実に判定する）。
 *  それ以外(.menu-rowsなど、目印を付けていない汎用の横スクロール領域)は
 *  従来通りoverflow-x + scrollWidthの実測で判定する。 */
export function startedInsideHorizontalScroller(target: EventTarget | null): boolean {
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

export const SWIPE_MIN_DISTANCE = 60;
/** 横移動量がこの倍率を超えて縦移動量より大きい時だけ発火 */
export const SWIPE_DIRECTION_RATIO = 1.5;
/** 指の追従を始めるまでの遊び。これ未満は縦スクロールかタップの可能性があるので動かさない。 */
export const DRAG_START_THRESHOLD = 12;
/** 端(先頭/末尾)で引っ張ったときの抵抗。1に近いほどよく動く。 */
export const EDGE_RESISTANCE = 0.25;
/** 指を離した後の収束アニメーションの長さ。ゆったりめ。 */
export const SETTLE_MS = 420;
/** 減速して静かに止まるイージング（標準のease-outより終端が柔らかい） */
export const SETTLE_EASING = "cubic-bezier(0.25, 0.8, 0.35, 1)";

/** スワイプ判定の純粋ロジック（DOM/Reactに依存しない部分だけを切り出し、単体テスト可能にしている）。
 *  次に切り替えるべきページ名を返す。発火条件を満たさない/端で止まる場合はnull。 */
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

/** 指の移動量から、実際にコンテンツをずらす量を求める。
 *  端（先頭で右へ / 末尾で左へ）はそれ以上進めないので、抵抗をかけて
 *  「引っかかっている」ことを手触りで伝える（iOSのバウンスと同じ考え方）。 */
export function resolveDragOffset(
  current: string,
  categories: string[],
  dx: number
): number {
  const idx = categories.indexOf(current);
  if (idx === -1) return 0;
  const atStart = idx === 0;
  const atEnd = idx === categories.length - 1;
  if ((dx > 0 && atStart) || (dx < 0 && atEnd)) return dx * EDGE_RESISTANCE;
  return dx;
}
