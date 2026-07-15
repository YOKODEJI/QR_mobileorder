# 07. マルチテナント分離（スタッフのstore_id紐付け）

2026-07-17 実装。ユーザーが「方式B（1つのSupabaseプロジェクトを複数店舗で共有）」を選択したため、
その前提として必要な「スタッフのstore_id分離」を実装した。

## やったこと

「ログイン済み=スタッフ（全店舗データにアクセス可）」という単純化を廃止し、
`staff(user_id, store_id)` の紐付けで各スタッフを**自店舗のデータにのみ**制限した。

1. **`staff_store_id()` 関数**（`schema.sql` / `step10-tenant-isolation.sql`）: 呼び出しユーザー
   (`auth.uid()`) が属する店舗idを返す。RLSポリシー・RPC双方の「自店舗チェック」の唯一の判定源。
2. **RLSポリシー全面書き換え**: `stores`/`categories`/`tables`/`menu_items`/`orders`/`order_items`/
   `staff_calls`/`checkouts` の authenticated 向けポリシーを、`store_id = staff_store_id()` に限定。
   anon（客）向けの閲覧ポリシーは変更なし（後述の既知の残課題を参照）。
3. **`close_table`/`regenerate_table_token` に store_id 検証を追加**（`functions.sql`）: 呼び出し元の
   `staff_store_id()` と引数の `p_store` が一致しなければ `forbidden: store mismatch` で拒否。
4. **`submit_order` Edge Function のバグ修正**: 代理注文(`proxy:true`)の検証が「ログイン済みかどうか」
   しか見ておらず、**A店スタッフの資格情報のままstoreIdをB店に差し替えて代理注文を送りつけられる穴**が
   あった。呼び出しユーザーの `staff.store_id` が今回の `storeId` と一致する場合のみ `effectiveProxy=true`
   にするよう修正。
5. **`AdminAuthGate`**: ログイン後 `staff_store_id()` RPC を呼び、このデプロイの `STORE_ID` と
   一致しなければ強制サインアウト＋「このアカウントはこの店舗のスタッフとして登録されていません」表示。
   UI層の多層防御（DBレベルの最終防御はRLS）。

## デプロイ手順（本番適用時・ユーザー実行）

**必ずこの順番で実行すること**（②③の間はUIが正常でも一部RPCがエラーになる可能性があるため、
なるべく連続して実行する）。

1. Supabase SQL Editor で `supabase/step10-tenant-isolation.sql` を丸ごと実行
   - `staff` テーブルに既存の `auth.users` 全員を今の `STORE_ID` のスタッフとしてバックフィル
   - `staff_store_id()` 関数を作成
   - 全RLSポリシーを store_id スコープに書き換え
2. 続けて `supabase/functions.sql` を丸ごと再実行（`close_table`/`regenerate_table_token` に
   store_id 検証を追加した版で関数を再定義。実行権限のGRANT/REVOKEも含む）
3. `npx supabase functions deploy submit_order`（Edge Functionの代理注文検証バグ修正を反映）
4. アプリコード（`AdminAuthGate.tsx` 他）を `git push` → Vercel自動デプロイ

## 動作確認チェックリスト（デプロイ後）

- [ ] `node --env-file=.env.local scripts/test-rls.mjs` 全項目パス（既存の回帰確認）
- [ ] `node --env-file=.env.local scripts/test-tenant-isolation.mjs` 全項目パス
- [ ] `node --env-file=.env.local scripts/test-security.mjs` 全項目パス（テーブル1のid/qr_tokenは
      都度SQL Editorで取得し直すこと）
- [ ] 実際に `/admin` にログインできる（既存スタッフアカウントが正しく `staff` テーブルに
      バックフィルされていること。ログインできない/「登録されていません」と出る場合は
      `select * from staff;` で該当 `user_id` の行があるか確認）
- [ ] 厨房・テーブル会計・メニュー管理・会計履歴が従来通り表示・操作できる（既存店の回帰確認）
- [ ] 客画面（`/order/[id]?k=...`）から注文が通る（`submit_order` Edge Function修正の回帰確認）
- [ ] テーブル会計・QR再発行が正常に動作する（`close_table`/`regenerate_table_token`のstore_id検証追加の回帰確認）

## 2店舗目を追加するとき

1. `stores` に新しい店舗行を追加（または既存の手順通り新規Supabaseプロジェクトを使う場合は不要）
2. その店舗のスタッフを Supabase Authentication でユーザー作成
3. SQL Editor で `insert into staff (store_id, user_id, role) values ('<新store_id>', '<新user_id>', 'owner');`
   （`step10` のバックフィルは「既存ユーザー全員を店舗1に」なので、2店舗目には使わない）
4. 新店舗用の Vercel プロジェクト（or 同一プロジェクトの別ドメイン）で `NEXT_PUBLIC_STORE_ID` を新店舗のidに設定

## 既知の残課題（未着手）: 客(anon)の読み取り範囲

**今回は対応を見送った。** スタッフ側の分離（上記）は完了したが、客(anon)側は依然として
以下の状態のまま:

- `orders`/`order_items`/`staff_calls` の anon 閲覧ポリシーは `using (true)` のまま
  ＝ **同じSupabaseプロジェクトに2店舗目のデータが乗ると、客が自分の店以外の生の注文・呼出データを
  直接REST APIで読める**（アプリのUIは自店舗分だけ表示するが、anonキーはブラウザのJSに公開されて
  いるため、直接fetchすれば他店データも取得できてしまう）。
- `stores`/`categories`/`tables`/`menu_items` も同様に anon は `using (true)` のまま
  （店舗設定・メニュー・卓名が他店から見える）。ただしこちらは印刷メニューと同程度の公開情報なので
  相対的に低リスクと判断し、今回は許容。
- 同一店舗内でも、客は自分の卓以外の注文・呼出を読める（元々の既知の課題、変更なし）。

### 対応を見送った理由

これを正しく塞ぐには、anon（未認証の客）に「どの卓/店舗のセッションか」を安全に紐付ける
仕組みが要る。現状のRLSの `using()` 句はリクエストごとの信頼できる識別子を持たないanonに対しては
原理的に無力（クライアントから渡される値は何でも偽装できるため）。この夜間の無人作業で
本番の客注文フロー（Realtime含む）に影響するリスクの高い変更を検証なしに投入するのは
避けるべきと判断し、設計のみ以下に残す。

### 実装候補（次にやるとき用）

| 案 | 概要 | 長所 | 短所 |
|---|---|---|---|
| **A. Supabase Anonymous Auth** | 客の初回アクセス時に `signInAnonymously()` で実auth.uid()を発行、`table_sessions`に`user_id`↔`table_id`を記録してRLSで絞る | 既存のRLS/Realtime機構をそのまま使える。最も筋が良い | 客セッション管理の実装がやや増える。sign-out/期限切れの扱いを設計要 |
| **B. Realtime Broadcast (DB発火)** | `realtime.broadcast_changes()`トリガーで卓ごとのチャネルにbroadcast、客はそのチャネルだけ購読 | postgres_changesの権限問題を回避 | 初期SELECT(loadSnapshot)の絞り込みは別途RPC化が必要。Broadcast Authorization設定が要る |
| **C. RPCベースの読み取り+ポーリング** | `get_table_view(p_table, p_token)` RPCで自卓分だけ返す。Realtimeは諦めてポーリング間隔を短縮 | 実装は一番簡単 | 客画面のリアルタイム性が落ちる(現状の魅力の一部を失う) |

**推奨: A**。ただし2店舗目を実際にこの共有プロジェクトへ追加する**前**に、いずれかの対応を
完了させること。1店舗のみの運用が続く間は実害がない（自分の店のデータしか無いため）。
