# Supabase セットアップ手順（あなたの作業）

M2の配線を始めるために、Supabase プロジェクトを用意します。所要 10〜15分。
アカウント作成・ログインは本人操作が必要なため、ここだけお願いします。完了したら知らせてください。

## 手順

### 1. アカウント作成
1. https://supabase.com/ を開き **Start your project** → GitHub かメールでサインアップ。
2. 無料プランでOK（開発用）。

### 2. プロジェクト作成
1. **New project** をクリック。
2. 入力:
   - **Name**: `qr-order`（任意）
   - **Database Password**: 強めのパスワードを生成し**控えておく**（後で使う場合あり）。
   - **Region**: `Northeast Asia (Tokyo)` を推奨（日本なら低遅延）。
3. **Create new project** → 1〜2分で準備完了。

### 3. スキーマ投入
1. 左メニュー **SQL Editor** → **New query**。
2. リポジトリの [`supabase/schema.sql`](../supabase/schema.sql) の中身を全てコピペ → **Run**。
   - 「Success. No rows returned」でOK。
3. 続けて [`supabase/seed.sql`](../supabase/seed.sql) を貼って **Run**。
   - 実行後、**Messages/Notices** に `Seed 完了: store_id = xxxxxxxx-...` が出ます。
   - この **store_id（uuid）をコピー**しておく（次で使う）。
   - もし notice が見当たらなければ、`select id, name from stores;` を実行して uuid を取得。

### 4. URL と anon キーを取得
1. 左メニュー **Project Settings（歯車）→ API**。
2. 次の2つを控える:
   - **Project URL**（例 `https://abcd1234.supabase.co`）
   - **anon public** キー（`API Keys` の "anon" / "publishable"。公開用キーで秘密鍵ではありません）

### 5. アプリに設定
`qr-order-app/.env.local.example` を `.env.local` にコピーし、3つを埋める:
```
NEXT_PUBLIC_SUPABASE_URL=https://＜あなたのプロジェクト＞.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=＜anon public キー＞
NEXT_PUBLIC_STORE_ID=＜seedで出た store_id＞
```
> `.env.local` は git 管理外（コミットされません）。

### 6. 私に知らせる
「入れた」と一言ください。こちらで読み取り＋リアルタイム配線を行い、
別タブ（客用/厨房）で注文が即同期するところまで検証します。

---

## 補足（安全性）
- 今の RLS ポリシーは**開発用（誰でも読み書き可）**です。単一店舗のデモ用なので当面これで進め、
  スタッフ認証を入れる段階で store_id ベースに必ず絞ります（`docs/04-milestone2-plan.md` B-1/10）。
- anon キーはクライアントに埋め込む前提の公開キーです。**サービスロールキー（service_role）は絶対に**
  `.env.local` に入れたり私に共有したりしないでください（あれはサーバ専用の秘密鍵）。
