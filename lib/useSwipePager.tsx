"use client";

import { useEffect, useRef, useState } from "react";
import {
  resolveSwipeTarget,
  resolveDragOffset,
  startedInsideHorizontalScroller,
  DRAG_START_THRESHOLD,
  SWIPE_DIRECTION_RATIO,
  SETTLE_MS,
  SETTLE_EASING,
} from "./useSwipeCategory";

/**
 * 左右スワイプでページ(カテゴリ/タブ)を切り替えるページャー。
 * useSwipeCategoryとの違いは、**隣のページの中身も同時に描画して、
 * 指の動きと一緒に見えながら入ってくる**こと（本物のカルーセル）。
 *
 * 仕組み:
 * - 現在ページは通常フローに置き、コンテナの高さは現在ページが決める。
 * - ドラッグ/アニメーション中だけ、前後のページを absolute で±100%の位置に
 *   重ねて描画し、全ページを同じoffsetで平行移動する。
 * - 指を離すと必ず「前/次/元」のいずれかのページ位置に吸着する。
 *   切替時はoffsetをページ幅まで滑らせ、完了した瞬間に現在ページを
 *   差し替えてoffsetを0へ瞬間リセットする（隣ページがちょうど画面位置0に
 *   来たときに差し替えるので、見た目は途切れない）。
 *
 * 使い方:
 *   const pager = useSwipePager({ items, current, onChange });
 *   <div {...pager.handlers}>{pager.wrap((v) => <ページの中身 />)}</div>
 *   handlersはwrapより広い領域（カード全体など）に付けてもよい。
 */
export function useSwipePager({
  items,
  current,
  onChange,
}: {
  /** 表示順そのままのページ一覧（"すべて"を含むカテゴリ一覧や、管理タブのkey一覧） */
  items: string[];
  current: string;
  onChange: (v: string) => void;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const widthRef = useRef(0);
  const [offset, setOffset] = useState(0);
  const [settling, setSettling] = useState(false);
  // ドラッグ〜収束アニメーションの間だけtrue。この間だけ隣ページを描画する
  // （常時3ページ描画は重いので、触っていない間は現在ページだけにする）。
  const [interacting, setInteracting] = useState(false);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
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
      if (Math.abs(dx) < DRAG_START_THRESHOLD && Math.abs(dy) < DRAG_START_THRESHOLD) return;
      if (Math.abs(dx) <= Math.abs(dy) * SWIPE_DIRECTION_RATIO) {
        reset(); // 縦スクロール優位。このジェスチャーは横スワイプとして扱わない
        return;
      }
      dragging.current = true;
      widthRef.current = rootRef.current?.clientWidth || window.innerWidth;
      setInteracting(true); // ここから隣ページを描画
    }
    setOffset(resolveDragOffset(current, items, dx));
  };

  const finishInteraction = () => {
    later(() => {
      setInteracting(false);
      setSettling(false);
    }, SETTLE_MS + 40);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    const s = start.current;
    const wasDragging = dragging.current;
    reset();
    if (!s) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const next = resolveSwipeTarget(current, items, dx, t.clientY - s.y);

    if (!wasDragging) {
      setOffset(0);
      setInteracting(false);
      if (next) onChange(next); // 追従が始まる前の素早いフリックでも切り替えは効かせる
      return;
    }

    setSettling(true);
    if (next) {
      // 隣のページがちょうど画面位置0へ来るまで滑らせる
      const w = widthRef.current || window.innerWidth;
      setOffset(dx < 0 ? -w : w);
      later(() => {
        // 差し替えとoffsetリセットを同時に行う。切替先ページは直前まで
        // ちょうど同じ画面位置に見えていたので、見た目は途切れない。
        onChange(next);
        setSettling(false);
        setOffset(0);
        setInteracting(false);
      }, SETTLE_MS + 20);
    } else {
      setOffset(0); // 条件を満たさなかった/端だった。元の位置へ滑って戻る
      finishInteraction();
    }
  };

  const onTouchCancel = () => {
    reset();
    clearTimers();
    setSettling(true);
    setOffset(0);
    finishInteraction();
  };

  const transition = settling ? `transform ${SETTLE_MS}ms ${SETTLE_EASING}` : undefined;
  const idx = items.indexOf(current);
  const prevItem = idx > 0 ? items[idx - 1] : null;
  const nextItem = idx >= 0 && idx < items.length - 1 ? items[idx + 1] : null;

  const paneStyle = (side: -1 | 1): React.CSSProperties => ({
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    transform: `translate3d(calc(${side * 100}% + ${offset}px), 0, 0)`,
    transition,
  });

  /** ページの中身をカルーセルとして描画する。rootStyleはコンテナへの追加スタイル。 */
  const wrap = (renderPage: (v: string) => React.ReactNode, rootStyle?: React.CSSProperties) => (
    <div ref={rootRef} style={{ position: "relative", ...rootStyle }}>
      <div
        style={{
          transform: offset === 0 ? undefined : `translate3d(${offset}px, 0, 0)`,
          transition,
        }}
      >
        {renderPage(current)}
      </div>
      {interacting && prevItem != null && <div style={paneStyle(-1)}>{renderPage(prevItem)}</div>}
      {interacting && nextItem != null && <div style={paneStyle(1)}>{renderPage(nextItem)}</div>}
    </div>
  );

  return {
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel },
    wrap,
  };
}
