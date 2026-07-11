"use client";

import { useEffect, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import LoadingScreen from "@/components/ui/LoadingScreen";

type AuthState = "loading" | "in" | "out";

/**
 * /admin を保護する認証ゲート。
 * - Supabase未設定（ローカル開発）なら素通し。
 * - 設定済みならセッションを確認。未ログインならログインフォームを表示。
 * ※ これはUI層の保護。DBレベルの最終的な制御は RLS 厳格化（ステップ5）で行う。
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
    sb.auth.getSession().then(({ data }) => {
      if (mounted) setState(data.session ? "in" : "out");
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setState(session ? "in" : "out");
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (state === "loading") return <LoadingScreen label="認証を確認中…" />;
  if (state === "out") return <LoginForm />;
  return <>{children}</>;
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    background: "#f0f0f2",
    fontSize: "16px",
    fontFamily: "inherit",
    color: "#1c1c1e",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f2f2f7",
        padding: "20px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', var(--font-noto-sans-jp), 'Noto Sans JP', sans-serif",
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: "360px",
          maxWidth: "100%",
          background: "#fff",
          borderRadius: "22px",
          padding: "28px 24px",
          boxShadow: "0 12px 34px rgba(0,0,0,.08)",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div style={{ fontSize: "20px", fontWeight: 800, marginBottom: "4px" }}>
          管理ツール ログイン
        </div>
        <div style={{ fontSize: "13px", color: "#8e8e93", marginBottom: "8px" }}>
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
          <div style={{ fontSize: "13px", color: "#ff3b30", fontWeight: 600 }}>{error}</div>
        )}
        <button
          type="submit"
          disabled={busy}
          style={{
            marginTop: "6px",
            padding: "14px",
            borderRadius: "12px",
            border: "none",
            background: busy ? "#c7c7cc" : "var(--accent)",
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
