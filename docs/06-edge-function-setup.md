# ステップ3: Edge Function デプロイ手順（あなたの作業）

注文を「サーバー側の1トランザクション」で確定し、**同時注文の在庫オーバーセル・二重注文・会計の不整合**を根本的に防ぎます。
所要 10分ほど。コマンドは `qr-order-app/` フォルダで実行してください。

## 1. SQL関数を作成（SQL Editor）
Supabase の **SQL Editor** で、リポジトリの [`supabase/functions.sql`](../supabase/functions.sql) を貼り付けて **Run**。
→ `place_order`（注文の原子的確定）と `close_table`（会計の原子的確定）が作られます。

## 2. Supabase CLI でログイン
CLIは導入済み（devDependency）。以下を順に実行：

```bash
# 1) ログイン（ブラウザが開き、トークンが表示される→貼り付け）
npx supabase login

# 2) プロジェクト初期化（config.toml 作成。プロンプトは基本 N でOK）
npx supabase init

# 3) このプロジェクトに紐付け
npx supabase link --project-ref yhjzssvolqieutytoxlk

# 4) 関数をデプロイ
npx supabase functions deploy submit_order
```

> `supabase init` が「already exists」等を出しても問題ありません（既存ファイルは保持されます）。
> `link` でDBパスワードを聞かれたら、プロジェクト作成時に控えたパスワードを入力。

## 3. アプリのフラグを立てる
`qr-order-app/.env.local` に次の行を追加（または `NEXT_PUBLIC_ORDER_VIA_FUNCTION=` を書き換え）：

```
NEXT_PUBLIC_ORDER_VIA_FUNCTION=true
```

## 4. 私に知らせる
「デプロイした」と教えてください。開発サーバーを再起動し、
- 注文が Edge Function 経由で入ること
- **在庫を超える同時注文が弾かれること**（オーバーセル防止）
- 二重送信しても1件しか入らないこと（冪等）
を一緒に検証します。

---

## 補足
- 関数は `SUPABASE_SERVICE_ROLE_KEY`（Supabaseが関数環境に自動注入）でRLSを越えて実行します。**このキーはサーバー(関数)内だけ**で使われ、ブラウザには出ません。
- フラグ `NEXT_PUBLIC_ORDER_VIA_FUNCTION` が `true` でない間は、従来どおり直接書き込みで動きます（デプロイ前でもアプリは壊れません）。
- 会計(`close_table`)はスタッフ操作なので Edge Function を介さず RPC を直接呼びます（フラグONで有効）。
