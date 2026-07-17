"use client";

import { useEffect } from "react";
import { applyThemeMode, getStoredThemeMode } from "@/lib/themeMode";

/** マウント時に保存済みのライト/ダーク設定を<html>へ反映し、「自動」選択時は
 *  端末側のダーク設定の変化も追従する。画面には何も描画しない。 */
export default function ThemeModeController() {
  useEffect(() => {
    applyThemeMode(getStoredThemeMode());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (getStoredThemeMode() === "system") applyThemeMode("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return null;
}
