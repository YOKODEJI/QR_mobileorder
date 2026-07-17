# 07. マルチテナント分離（スタッフ・客の双方をstore_id/卓に限定）

2026-07-17 実装。ユーザーが「方式B（1つのSupabaseプロジェクトを複数店舗で共有）」を選択したため、
その前提として必要な分離を実装した。ステップ10（スタッフ）とステップ11（客）の2段階。

## やったこと

### ステップ10: スタッフの store_id 分離

「ログイン済み=スタッフ（全店舗データにアクセス可）」という単純化を廃止し、
`staff(user_id, store_id)` の紐付けで各スタッフを**自店舗のデータにのみ**制限した。

1. **`staff_store_id()` 関数**: 呼び出しユーザー(`auth.uid()`)が属する店舗idを返す。
   RLSポリシー・RPC双方の「自店舗チェック」の唯一の判定源。
2. **RLSポリシー全面書き換え**: `stores`/`categories`/`tables`/`menu_items`/`orders`/`order_items`/
   `staff_calls`/`checkouts` の authenticated 向けポリシーを `store_id = staff_store_id()` に限定。
3. **`close_table`/`regenerate_table_token` に store_id 検証を追加**: 呼び出し元の
   `staff_store_id()` と引数の `p_store` が一致しなければ `forbidden: store mismatch` で拒否。
4. **`submit_order` Edge Function のバグ修正**: 代理注文(`proxy:true`)の検証が「ログイン済みかどうか」
   しか見ておらず、**A店スタッフの資格情報のままstoreIdをB店に差し替えて代理注文を送りつけられる穴**が
   あった。呼び出しユーザーの `staff.store_id` が今回の `storeId` と一致する場合のみ `effectiveProxy=true`
   にするよう修正。
5. **`AdminAuthGate`**: ログイン後 `staff_store_id()` RPC を呼び、このデプロイの `STORE_ID` と
   一致しなければ強制サインアウト＋「このアカウントはこの店舗のスタッフとして登録されていません」表示。

### ステップ11: 客(anon)の卓単位分離（Supabase Anonymous Auth）

客は認証を持たないため、RLSの `using()` だけでは店舗間/卓間を絞れない（クライアントが送る値は
偽装可能）という壁があった。**Supabase Anonymous Auth** で客にも実 `auth.uid()` を発行し、
スタッフと同じ原則（`auth.uid()` → 何らかのid の紐付けをRLSの判定源にする）で客も分離した。

1. **`table_sessions` テーブルを本来の用途で有効化**: `user_id`列を追加（客のanon auth.uid()と
   1対1）。もともと「M2後半で本格利用」として用意されていた未使用テーブル。
2. **`open_session` RPC を拡張**: qr_token照合成功時、匿名認証済み(`auth.uid()`あり)なら
   `table_sessions` に upsert（既存セッションがあれば卓を今回のものに更新）。
3. **`has_table_session(p_table)` 関数**: 呼び出しユーザーが今その卓の有効な閲覧セッションを
   持っているか。`orders`/`order_items`/`staff_calls` の客向けRLSの判定源。
4. **`close_table`/`regenerate_table_token` でセッション失効**: 会計時・QR再発行時、その卓の
   有効な `table_sessions` を `closed` にする（退店客・旧QRの端末は以後見えなくなる）。
5. **RLSポリシー**: `orders`/`order_items`/`staff_calls` の `anon` 向け `using(true)` を撤去し、
   `authenticated`（匿名認証客）向けの `has_table_session()` ベースのポリシーに置き換え。
   `stores`/`categories`/`tables`/`menu_items` は元々 `anon` に公開済み（印刷メニュー相当の
   低リスク情報のため店舗間分離は見送り、`anon`用ポリシーは維持）だが、匿名認証すると
   ロールが `authenticated` に変わり `anon` 向けポリシーが適用されなくなるため、
   `is_anonymous`クレームで判定する客向けポリシーを追加で用意した。
6. **`tables.qr_token`/`session_token` を `authenticated` からも列単位で封鎖**: `authenticated`
   ロールは「本物のスタッフ」と「匿名認証した客」の両方が使うため、列GRANTでは区別できない。
   列を封鎖し、スタッフのQR管理画面は新設の `fetch_table_tokens()` RPC(`staff_store_id()`で
   自店舗に限定)経由に一本化（`lib/data.ts` の `dbFetchTableTokens` を更新）。
7. **クライアント**: `CustomerShell` が来店時に `ensureAnonymousSession()`（`lib/supabase.ts`
   新設）で `signInAnonymously()` を実行してから `open_session` を呼ぶ。失敗しても
   （匿名認証がダッシュボードで無効化されている等）console警告のみで通常の注文フロー
   （token方式）は継続する設計（フェイルセーフ確認済み。後述）。
   `AdminAuthGate` は `session.user.is_anonymous` を見て、匿名（客）セッションを
   「未ログイン」として通常のログインフォームを出す（「登録されていません」エラーと区別）。

### 動作確認（ローカルdevサーバー・本番Supabase相手・実施済み）

- tsc / `npm test`(vitest 17件) / `npm run build` すべてグリーン
- ブラウザで `/order/1` にアクセス → 匿名認証は現状ダッシュボード未設定のため
  `Anonymous sign-ins are disabled` エラーがconsoleに出るが、**アプリはクラッシュせず
  通常通りメニュー表示まで到達**（フェイルセーフ動作を確認）
- `/admin` にアクセス（未ログイン） → 通常のログインフォームが表示され、
  「登録されていません」エラーは出ない（`is_anonymous`判定の分岐を確認）

## デプロイ手順（本番適用時・ユーザー実行）

### ⚠ 必ず「閉店中」に実施すること

step11 が `orders`/`order_items`/`staff_calls` の **anon向け閲覧ポリシーを外す**ため、
「step11実行 〜 pushしたクライアントがVercelに反映される」までの数分間、
**客は注文できるが自分の注文履歴・調理状況を見られない**状態になる
（客が匿名認証(authenticated)に切り替わるのはクライアントのデプロイ後のため）。

- 影響を受けるのは客のみ。スタッフ(`/admin`)は step10 完了時点で正常。
- 注文・会計そのものは全工程を通じて動作する（place_orderはservice_role経由のため）。
- 営業中に無停止で行いたい場合は、step11から「anonポリシーのdrop」だけを外して先に適用し、
  push完了を確認してから別途dropする2段階移行が必要（今回は閉店中実施を前提に簡略化）。

### 手順（この順番で連続して実行する）

1. **Supabaseダッシュボード** → Authentication → Sign In / Providers →
   **「Allow anonymous sign-ins」を有効化**。これをやらないと `signInAnonymously()` が
   失敗し続け、step11適用後に客が注文状況を見られないままになる。
2. **SQL Editor** で `supabase/step10-tenant-isolation.sql` を丸ごと実行
   （staffバックフィル＋`staff_store_id()`＋RLSのstore_idスコープ化）。
   → 次のstep4より必ず先に実行すること。staffテーブルが空のまま新しい
   `submit_order` を配ると、スタッフの代理注文が全て弾かれる。
3. **SQL Editor** で `supabase/step11-customer-sessions.sql` を丸ごと実行
   （table_sessions連携＋`has_table_session()`＋客向けRLS＋`fetch_table_tokens()`）。
4. `npx supabase functions deploy submit_order`
   （Edge Functionの代理注文検証バグ修正を反映。Docker不要）
5. `git push` → Vercel自動デプロイ
   （`AdminAuthGate.tsx`/`CustomerShell.tsx`/`lib/supabase.ts`/`lib/data.ts` 他）

> `supabase/functions.sql` の再実行は**不要**。step11 が変更対象の関数
> （`open_session`/`close_table`/`regenerate_table_token`）を全て再定義しており、
> `place_order` は今回変更していないため。`functions.sql` は新規構築時の正本として維持。

## 動作確認チェックリスト（デプロイ後）

- [ ] `node --env-file=.env.local scripts/test-rls.mjs` 全項目パス（既存の回帰確認）
- [ ] `node --env-file=.env.local scripts/test-tenant-isolation.mjs` 全項目パス
- [ ] `node --env-file=.env.local scripts/test-customer-session.mjs <table1_id> <qr1> <table2_id> <qr2>`
      全項目パス（対象2卓のid/qr_tokenはSQL Editorで取得: `select id, qr_token from tables
      where store_id = '<STORE_ID>' order by sort limit 2;`）
- [ ] `node --env-file=.env.local scripts/test-security.mjs` 全項目パス（テーブル1のid/qr_tokenは
      都度SQL Editorで取得し直すこと）
- [ ] 実際に `/admin` にログインできる（既存スタッフアカウントが正しく `staff` テーブルに
      バックフィルされていること。ログインできない/「登録されていません」と出る場合は
      `select * from staff;` で該当 `user_id` の行があるか確認）
- [ ] 厨房・テーブル会計・メニュー管理・会計履歴が従来通り表示・操作できる（既存店の回帰確認）
- [ ] QR発行画面が正常に表示される（`fetch_table_tokens()` RPC化の回帰確認）
- [ ] 客画面（`/order/[id]?k=...`）から注文が通り、自分の注文状況が見える（`submit_order`修正＋
      匿名認証の回帰確認。console に `Anonymous sign-ins are disabled` が出ていないか確認）
- [ ] テーブル会計・QR再発行が正常に動作する（store_id検証＋table_sessions失効の回帰確認）

## 2店舗目を追加するとき

1. `stores` に新しい店舗行を追加（または既存の手順通り新規Supabaseプロジェクトを使う場合は不要）
2. その店舗のスタッフを Supabase Authentication でユーザー作成
3. SQL Editor で `insert into staff (store_id, user_id, role) values ('<新store_id>', '<新user_id>', 'owner');`
   （`step10` のバックフィルは「既存ユーザー全員を店舗1に」なので、2店舗目には使わない）
4. 新店舗用の Vercel プロジェクト（or 同一プロジェクトの別ドメイン）で `NEXT_PUBLIC_STORE_ID` を新店舗のidに設定

客側はステップ11の仕組みにより追加設定なしで自動的に卓・店舗単位に分離される
（`table_sessions`はどの店舗のどの卓かを都度記録するため）。

## 既知の残課題（意図的に許容している範囲）

- `stores`/`categories`/`tables`(id/name/sortのみ)/`menu_items` は依然として店舗間で
  相互に閲覧可能（`anon`・匿名認証客とも`using(true)`系のまま）。印刷メニュー・卓名程度の
  公開情報であり、実害は小さいと判断し許容。将来もし気になれば `customer_store_id()`
  （ステップ11で用意済み・未使用）でこれらも絞り込み可能。
- 匿名ユーザー(`auth.users`に`is_anonymous=true`で溜まる)の定期整理は未実装。件数が増えても
  実害は小さい（1行あたり数百バイト程度）が、気になる場合はSupabaseの推奨する定期削除
  （例: pg_cronで`is_anonymous=true`かつ`created_at`が古い行を削除）を検討する。
