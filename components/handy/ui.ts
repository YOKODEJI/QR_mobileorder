import type { CSSProperties } from "react";

/* ハンディ（/handy）と厨房（/kitchen）で共通の見た目。
 * 画面ごとに同じ値を書き散らさず、ここで1か所に持つ。
 *
 * 内部の道具なので、見栄えより視認性を優先する:
 *   ・文字は 14 / 16 / 18 / 20px の4段。品名・卓名など「読んで押すもの」は 18px 以上・太字
 *   ・補助の文字も薄くしすぎない（.handy の --text-2。globals.css）
 *   ・指で押すものは高さ 48px 以上、主操作は 56px
 *   ・状態は色だけに頼らず、必ず言葉（提供前・売切・空席）を添える
 *
 * 形の決まり（2026-10-10。「AIっぽく見せないデザイン指針」）: 頑丈な店の道具に見えるように、
 *   ・すりガラス・影・丸い札（ピル型）・左の色線は使わない。面は白、区切りは罫線（--rule）
 *   ・角は小さく: ボタン・行・入力欄 8px、卓のタイル 10px、状態の印 3px、数の札 6px
 *   ・強調色（--accent）は主操作・提供前・数だけ。選択中は墨（--text）で塗る */

/** ハンディはスマホで使う前提。広い画面で開いても、スマホの幅のまま中央に置く */
export const PHONE_MAX_WIDTH = "560px";

/** 画面の主操作（追加注文・注文内容を確認する・卓を閉じる）。1画面に1つ */
export const primaryButton: CSSProperties = {
  width: "100%",
  minHeight: "56px",
  padding: "14px 16px",
  borderRadius: "8px",
  border: "none",
  background: "var(--accent)",
  color: "var(--accent-ink)",
  fontFamily: "inherit",
  fontSize: "18px",
  fontWeight: 800,
  cursor: "pointer",
};

/** 主操作の隣に並ぶ操作（卓移動・レジ用の一覧） */
export const secondaryButton: CSSProperties = {
  flex: 1,
  minHeight: "50px",
  padding: "12px",
  borderRadius: "8px",
  border: "1.5px solid var(--rule)",
  background: "var(--surface)",
  color: "var(--text)",
  fontFamily: "inherit",
  fontSize: "16px",
  fontWeight: 700,
  cursor: "pointer",
};

/** ヘッダーやシートの端に置く小さなボタン（戻る・閉じる・卓の編集）。白地に罫線の四角 */
export const smallButton: CSSProperties = {
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  minHeight: "40px",
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1.5px solid var(--rule)",
  background: "var(--surface)",
  color: "var(--text)",
  fontFamily: "inherit",
  fontSize: "15px",
  fontWeight: 700,
  cursor: "pointer",
};

/** 数量の − ＋ や並び替えの ↑ ↓（正方形） */
export const stepButton: CSSProperties = {
  flexShrink: 0,
  width: "48px",
  height: "48px",
  borderRadius: "8px",
  border: "1.5px solid var(--rule)",
  background: "var(--surface)",
  color: "var(--text)",
  fontFamily: "inherit",
  fontSize: "22px",
  fontWeight: 800,
  cursor: "pointer",
};

/** 文字の入力欄（検索・卓の名前・備考）。16px未満だとiPhoneで入力時に画面が拡大される */
export const textInput: CSSProperties = {
  width: "100%",
  minHeight: "46px",
  padding: "11px 12px",
  borderRadius: "8px",
  border: "1.5px solid var(--rule)",
  background: "var(--surface)",
  color: "var(--text)",
  fontFamily: "inherit",
  fontSize: "16px",
  fontWeight: 600,
};

/** 画面下に固定する操作エリア */
export const bottomBar: CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 20,
  maxWidth: PHONE_MAX_WIDTH,
  margin: "0 auto",
  padding: "10px 12px calc(10px + env(safe-area-inset-bottom))",
  background: "var(--surface)",
  borderTop: "1.5px solid var(--text)",
};

/** 一覧の1行（品目など、面として押せるもの） */
export const rowCard: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  width: "100%",
  minHeight: "64px",
  padding: "10px 14px",
  borderRadius: "8px",
  border: "1.5px solid var(--rule)",
  background: "var(--surface)",
  color: "var(--text)",
  fontFamily: "inherit",
  textAlign: "left",
  cursor: "pointer",
};

/** 状態を示す四角い印（提供前・提供済み・売切） */
export const statusTag: CSSProperties = {
  display: "inline-block",
  padding: "4px 9px",
  borderRadius: "3px",
  fontSize: "14px",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

/** 並んだ選択肢から1つ選ぶボタン（一合／グラス、飲み方、グラスの数）。
 *  白地に黒い文字と太い枠にする。色つきのボタンを並べるより文字が読みやすく、主操作（色つき）とも区別がつく */
export const choiceButton: CSSProperties = {
  minHeight: "68px",
  padding: "12px 8px",
  borderRadius: "8px",
  border: "2.5px solid var(--text)",
  background: "var(--surface)",
  color: "var(--text)",
  fontFamily: "inherit",
  fontSize: "20px",
  fontWeight: 800,
  cursor: "pointer",
};

/** 数を示す札（入力中の杯数・点数） */
export const countBadge: CSSProperties = {
  flexShrink: 0,
  minWidth: "34px",
  height: "34px",
  padding: "0 9px",
  borderRadius: "6px",
  background: "var(--accent)",
  color: "var(--accent-ink)",
  fontSize: "18px",
  fontWeight: 800,
  fontVariantNumeric: "tabular-nums",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

/** 品名・卓名など、一覧で読むいちばん大事な文字 */
export const itemName: CSSProperties = {
  display: "block",
  fontSize: "18px",
  fontWeight: 700,
  lineHeight: 1.3,
};

/** 品名の下に添える文字（飲み方・備考・カテゴリ） */
export const subText: CSSProperties = {
  display: "block",
  fontSize: "15px",
  fontWeight: 600,
  color: "var(--text-2)",
  lineHeight: 1.35,
};

/** 一覧の区切りの見出し */
export const sectionTitle: CSSProperties = {
  margin: "4px 2px 6px",
  fontSize: "14px",
  fontWeight: 800,
  letterSpacing: ".08em",
  color: "var(--text-2)",
};

/** 押せるものを一時的に無効にしたときの見た目 */
export const disabledLook = (off: boolean): CSSProperties =>
  off ? { opacity: 0.4, cursor: "default" } : {};

/** 押した手応え（対応している端末だけ。iPhone は非対応なので何も起きない） */
export function tapFeedback(): void {
  try {
    navigator.vibrate?.(10);
  } catch {
    /* ignore */
  }
}
