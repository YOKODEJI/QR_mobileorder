"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/store/useAppStore";
import { isSupabaseConfigured } from "@/lib/supabase";
import { loadSnapshot, subscribeRealtime, subscribeConnection } from "@/lib/data";

/**
 * Supabase が設定されていれば、業務データをDBから読み込み、
 * 変更をリアルタイム購読（+ポーリングのフォールバック）でストアに反映する。
 * 未設定なら何もしない（アプリはローカルのまま動く）。
 */
export default function SupabaseSync() {
  const hydrate = useAppStore((s) => s.hydrate);
  const setConnected = useAppStore((s) => s.setConnected);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;

    const reload = async () => {
      const snap = await loadSnapshot();
      if (!cancelled && snap) hydrate(snap);
    };

    reload(); // 初回ロード

    // Realtime: 変更をデバウンスして全件再取得（docs/04 B-2 準拠）
    const debounced = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(reload, 250);
    };
    const unsubRealtime = subscribeRealtime(debounced);
    const unsubConn = subscribeConnection(setConnected);

    // ポーリングのフォールバック（Realtimeが切れても最悪拾う）
    const poll = setInterval(reload, 20000);

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      unsubRealtime();
      unsubConn();
      clearInterval(poll);
    };
  }, [hydrate, setConnected]);

  return null;
}
