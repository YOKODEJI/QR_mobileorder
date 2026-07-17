"use client";

import { useEffect, useState } from "react";
import { getSupabase, isSupabaseConfigured, STORE_ID } from "@/lib/supabase";
import LoadingScreen from "@/components/ui/LoadingScreen";

type AuthState = "loading" | "in" | "out" | "wrong-store";

/**
 * /admin を保護する認証ゲート。
 * - Supabase未設定（ローカル開発）なら素通し。
 * - 設定済みならセッションを確認。未ログインならログインフォームを表示。
 * - ログイン済みでも、そのアカウントが「この店舗(STORE_ID)のスタッフ」でなければ
 *   強制サインアウトしてアクセス拒否する（staff.user_id→store_id紐付け、
 *   staff_store_id() RPC経由。1つのSupabaseプロジェクトを複数店舗で共有しても、
 *   他店のスタッフ資格情報でこの店舗の管理画面に入れないようにするための多層防御）。
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

  if (state === "loading") return <LoadingScreen label="認証を確認中…" />;
  if (state === "wrong-store")
    return <LoginForm initialError="このアカウントはこの店舗のスタッフとして登録されていません。" />;
  if (state === "out") return <LoginForm />;
  return <>{children}</>;
}

function LoginForm({ initialError }: { initialError?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
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
        padding: "20px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', var(--font-noto-sans-jp), 'Noto Sans JP', sans-serif",
      }}
    >
      {/* ガラスは背後に何か無いと透明感が見えない。特定の色に依らないニュートラルな
          淡い形状を敷いて、blurが実際に屈折して見えるようにする（ログイン前は
          店舗テーマが未読み込みのため、accentではなくグレー系で統一）。 */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(44% 38% at 12% 10%, rgba(120,120,140,.20), transparent 70%), " +
            "radial-gradient(50% 42% at 90% 86%, rgba(90,100,130,.18), transparent 72%), " +
            "radial-gradient(36% 30% at 82% 6%, rgba(160,160,170,.16), transparent 70%)",
        }}
      />
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
        <div style={{ fontSize: "20px", fontWeight: 800, marginBottom: "4px" }}>
          管理ツール ログイン
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
