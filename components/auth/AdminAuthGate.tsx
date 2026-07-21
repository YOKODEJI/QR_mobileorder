"use client";

import { useEffect, useState } from "react";
import { getSupabase, isSupabaseConfigured, STORE_ID } from "@/lib/supabase";
import { fetchStoreSettings } from "@/lib/data";
import { recordActivity, isIdleExpired, clearActivity, IDLE_LIMIT_MS } from "@/lib/idleTimeout";
import LoadingScreen from "@/components/ui/LoadingScreen";

type AuthState = "loading" | "in" | "out" | "wrong-store" | "idle-out";

// 操作が無かったか判定する間隔。IDLE_LIMIT_MS(12時間)に対して十分細かく、
// かつバッテリー消費が気にならない頻度として5分ごと。
const IDLE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * /admin を保護する認証ゲート。
 * - Supabase未設定（ローカル開発）なら素通し。
 * - 設定済みならセッションを確認。未ログインならログインフォームを表示。
 * - ログイン済みでも、そのアカウントが「この店舗(STORE_ID)のスタッフ」でなければ
 *   強制サインアウトしてアクセス拒否する（staff.user_id→store_id紐付け、
 *   staff_store_id() RPC経由。1つのSupabaseプロジェクトを複数店舗で共有しても、
 *   他店のスタッフ資格情報でこの店舗の管理画面に入れないようにするための多層防御）。
 * - 12時間操作が無ければ自動的にサインアウトする（lib/idleTimeout.ts）。
 *   Supabaseのセッション自体は開いていれば自動更新され続けるため、この判定は
 *   自前でlocalStorageに記録した最終操作時刻を基準に行っている。
 * ※ これはUI層の保護。DBレベルの最終的な制御はRLS（staff_store_id()ベース）で行う。
 */
export default function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(
    isSupabaseConfigured() ? "loading" : "in"
  );

  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !isSupabaseConfigured()) {
      setState("in");
      return;
    }
    let mounted = true;

    // 客ページ(CustomerShell)が匿名認証(signInAnonymously)したセッションが
    // 同じブラウザに残っている場合は「未ログイン」として通常のログインフォームを出す
    // （"このアカウントは登録されていません"は本物のスタッフ資格情報向けのエラーなので、
    // 客が/adminに来ただけのケースと区別する）。
    const checkStoreMatch = async (session: { user?: { is_anonymous?: boolean } } | null) => {
      if (!session || session.user?.is_anonymous) {
        if (mounted) setState("out");
        return;
      }
      const { data: storeId, error } = await sb.rpc("staff_store_id");
      if (!mounted) return;
      if (error || !storeId || storeId !== STORE_ID) {
        await sb.auth.signOut();
        if (mounted) setState("wrong-store");
        return;
      }
      // セッション自体は生きていても、この端末で12時間操作が無ければ
      // 放置ログアウト扱いにする（ページを開きっぱなしで一晩経った場合等）。
      if (isIdleExpired()) {
        clearActivity();
        await sb.auth.signOut();
        if (mounted) setState("idle-out");
        return;
      }
      recordActivity();
      setState("in");
    };

    sb.auth.getSession().then(({ data }) => checkStoreMatch(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      checkStoreMatch(session);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // ログイン中のみ: 操作を検知して最終操作時刻を更新し、定期的に放置時間を判定する。
  useEffect(() => {
    if (state !== "in") return;
    const sb = getSupabase();
    if (!sb) return;

    // click/keydown/touchstartだけで十分（マウス移動まで拾うと書き込みが増えすぎる）。
    const onActivity = () => recordActivity();
    const events: (keyof WindowEventMap)[] = ["click", "keydown", "touchstart"];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const checkIdle = async () => {
      if (!isIdleExpired()) return;
      clearActivity();
      await sb.auth.signOut(); // onAuthStateChangeがidle-outへ遷移させる
    };
    const timer = setInterval(checkIdle, IDLE_CHECK_INTERVAL_MS);
    // タブがバックグラウンドから復帰した瞬間にも判定する
    // （モバイルではタイマーが止まっている間に12時間経っている場合があるため）。
    const onVisible = () => {
      if (document.visibilityState === "visible") checkIdle();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [state]);

  if (state === "loading") return <LoadingScreen label="認証を確認中…" />;
  if (state === "wrong-store")
    return <LoginForm initialError="このアカウントはこの店舗のスタッフとして登録されていません。" />;
  if (state === "idle-out")
    return <LoginForm initialError="12時間操作が無かったため自動的にログアウトしました。もう一度ログインしてください。" />;
  if (state === "out") return <LoginForm />;
  return <>{children}</>;
}

function LoginForm({ initialError }: { initialError?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [busy, setBusy] = useState(false);
  const [storeName, setStoreName] = useState<string | null>(null);

  // ログイン前でも店舗名/テーマは取得できる(storesは公開読み取り)。
  // 見出しに店名を出し、ボタン等のアクセントも店舗テーマに揃える。
  useEffect(() => {
    let mounted = true;
    fetchStoreSettings().then((s) => {
      if (!mounted || !s) return;
      if (s.storeName) setStoreName(s.storeName);
      if (s.theme) document.documentElement.style.setProperty("--accent", s.theme);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    setError(null);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError("メールアドレスまたはパスワードが正しくありません。");
  };

  const input: React.CSSProperties = {
    width: "100%",
    padding: "13px 15px",
    borderRadius: "12px",
    border: "none",
    background: "var(--hairline)",
    fontSize: "16px",
    fontFamily: "inherit",
    color: "var(--text)",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--app-bg)",
        color: "var(--text)",
        padding: "20px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', var(--font-noto-sans-jp), 'Noto Sans JP', sans-serif",
      }}
    >
      {/* ガラスは背後に何か無いと透明感が見えない。画面全体を覆う連続的な階調を敷く
          （ログイン前は店舗テーマ未読み込みのため、accentではなくニュートラルで統一）。 */}
      <div aria-hidden className="ambient-wash" />
      <form
        onSubmit={submit}
        style={{
          position: "relative",
          zIndex: 1,
          width: "360px",
          maxWidth: "100%",
          background: "var(--glass-strong)",
          backdropFilter: "blur(26px) saturate(180%)",
          WebkitBackdropFilter: "blur(26px) saturate(180%)",
          border: "1px solid var(--glass-edge)",
          borderRadius: "22px",
          padding: "28px 24px",
          boxShadow: "inset 0 1px 0 var(--glass-spec), var(--glass-shadow)",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div style={{ fontSize: "20px", fontWeight: 800, marginBottom: "4px", textWrap: "balance" }}>
          {storeName ? `${storeName} 管理画面 ログイン` : "管理画面 ログイン"}
        </div>
        <div style={{ fontSize: "13px", color: "var(--text-2)", marginBottom: "8px" }}>
          スタッフ用のメールアドレスとパスワードでログインしてください。
        </div>
        <input
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
          style={input}
        />
        <input
          type="password"
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          style={input}
        />
        {error && (
          <div style={{ fontSize: "13px", color: "var(--red)", fontWeight: 600 }}>{error}</div>
        )}
        <button
          type="submit"
          disabled={busy}
          style={{
            marginTop: "6px",
            padding: "14px",
            borderRadius: "12px",
            border: "none",
            background: busy ? "var(--text-3)" : "var(--accent)",
            color: "#fff",
            fontSize: "16px",
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "ログイン中…" : "ログイン"}
        </button>
      </form>
    </div>
  );
}
