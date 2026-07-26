"use client";

import { useEffect, useRef, useState } from "react";

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
/** 指の追従を始めるまでの遊び。これ未満は縦スクロールかタップの可能性があるので動かさない。 */
const DRAG_START_THRESHOLD = 12;
/** 端(先頭/末尾)で引っ張ったときの抵抗。1に近いほどよく動く。 */
const EDGE_RESISTANCE = 0.25;

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

/**
 * 左右スワイプで値(カテゴリ/管理タブ等の文字列の並び)を切り替える汎用フック
 * （客画面・代理注文・メニュー管理のカテゴリ切替、管理ツールのタブ切替で共通利用）。
 *
 * 指の動きにコンテンツが追従する連続的なモーション:
 * - 指を動かしている間、返り値の style をあてた要素が指と一緒に動く。
 * - 指を離すと、切り替わる場合は残りの距離を滑らせてから次の内容を表示し、
 *   切り替わらない場合は元の位置へ戻る（どちらも同じイージングで自然に繋がる）。
 * - 端では抵抗をかけて「これ以上進めない」ことを手触りで返す。
 *
 * 使い方: onTouchStart/onTouchMove/onTouchEnd を対象領域に、style を
 * 動かしたい中身に付ける（通常は同じ要素でよい）。
 *
 * 誤爆対策:
 * - 横移動量が縦移動量の1.5倍を超えるときだけ発火（縦スクロール中の誤爆を防ぐ）。
 * - 追従を始めるまでに12pxの遊びを設け、タップや縦スクロールでは動かさない。
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
  // 指が横方向のドラッグとして確定したか（縦スクロールと取り合いにならないよう一度決めたら固定）
  const dragging = useRef(false);
  const [offset, setOffset] = useState(0);
  // 指を離した後の「滑らせて戻す/送り出す」アニメーション中か
  const [settling, setSettling] = useState(false);
  // 進行中の後処理タイマー。新しい操作が始まったら必ず片付ける
  // （途中の位置で止まったまま放置されるのを防ぐ）
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  // アンマウント時にタイマーを残さない
  useEffect(() => clearTimers, []);

  const reset = () => {
    start.current = null;
    dragging.current = false;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    clearTimers();
    if (startedInsideHorizontalScroller(e.target)) {
      reset();
      return;
    }
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
    dragging.current = false;
    setSettling(false);
    setOffset(0);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const s = start.current;
    if (!s) return;
    e.stopPropagation();
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;

    if (!dragging.current) {
      // まだ方向が決まっていない。遊びを超えた時点で「横ドラッグか否か」を確定させる。
      if (Math.abs(dx) < DRAG_START_THRESHOLD && Math.abs(dy) < DRAG_START_THRESHOLD) return;
      if (Math.abs(dx) <= Math.abs(dy) * SWIPE_DIRECTION_RATIO) {
        reset(); // 縦スクロール優位。このジェスチャーはもう横スワイプとして扱わない
        return;
      }
      dragging.current = true;
    }
    setOffset(resolveDragOffset(current, categories, dx));
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    const s = start.current;
    const wasDragging = dragging.current;
    reset();
    if (!s) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const next = resolveSwipeTarget(current, categories, dx, t.clientY - s.y);

    if (!wasDragging) {
      setOffset(0);
      if (next) onChange(next); // 追従が始まる前の素早いフリックでも切り替えは効かせる
      return;
    }

    setSettling(true);
    if (next) {
      // 残りの距離を送り出してから中身を差し替える。切替後は新しい内容が
      // 反対側から入ってくるように見せたいので、一旦逆側にずらしてから0へ戻す。
      // タイマーは requestAnimationFrame ではなく setTimeout で繋ぐ。rAFは
      // タブが非表示だと完全に止まるため、途中の位置で固まる恐れがある。
      const dir = dx < 0 ? -1 : 1;
      const w = window.innerWidth;
      setOffset(dir * w);
      later(() => {
        onChange(next);
        setSettling(false);
        setOffset(-dir * w * 0.35); // 反対側へ瞬間移動（アニメーション無し）
        later(() => {
          setSettling(true);
          setOffset(0); // 入場のスライド。ここで必ず定位置へ収まる
        }, 20);
      }, 180);
    } else {
      setOffset(0); // 条件を満たさなかった/端だった。元の位置へ戻す
    }
  };

  // 指を離す前にブラウザ側でタッチが中断された場合（通知の割り込み等）も必ず戻す
  const onTouchCancel = () => {
    reset();
    clearTimers();
    setSettling(true);
    setOffset(0);
  };

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
    /** 動かしたい中身に付けるスタイル。指の動きに追従し、離すと滑らかに収まる。
     *  touch-actionは意図的に設定していない。ここでpan-yを指定すると、
     *  内側にあるカテゴリチップ行(ChipRow)やメニュー管理の行(.menu-rows)の
     *  横スクロールまで巻き添えで無効化されてしまうため
     *  （touch-actionは祖先から子孫へ制約が積み重なる）。方向の取り合いは
     *  DRAG_START_THRESHOLDと縦横比の判定で処理している。 */
    style: {
      transform: offset === 0 ? undefined : `translate3d(${offset}px, 0, 0)`,
      transition: settling ? "transform .18s ease-out" : undefined,
    } as React.CSSProperties,
  };
}
