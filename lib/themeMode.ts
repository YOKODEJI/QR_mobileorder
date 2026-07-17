/** 管理画面の見た目（ライト/ダーク/自動）。店舗全体の設定ではなく、
 *  この端末・このブラウザだけのローカル設定として保持する（localStorage）。
 *  CSS側は :root[data-theme="dark"] だけを見るシンプルな作りにしてあるので、
 *  ここでは「今どちらを表示すべきか」を決めて属性を付け外しするだけでよい。 */
export type ThemeMode = "light" | "dark" | "system";

const KEY = "qr-admin-theme-mode";

/** 既定はライト固定（過去に自動追従で表示崩れが起きたため、無指定時はライト）。 */
export function getStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const v = window.localStorage.getItem(KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "light";
}

function resolve(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

/** 実際に<html>へ反映する。Reactの状態を経由せず直接DOMを操作するので、
 *  どこから呼んでも即座に画面へ反映される。 */
export function applyThemeMode(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  if (resolve(mode) === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export function setThemeMode(mode: ThemeMode) {
  window.localStorage.setItem(KEY, mode);
  applyThemeMode(mode);
}
