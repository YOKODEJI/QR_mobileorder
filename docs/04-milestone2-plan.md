# Milestone 2 実装計画（改訂版）

M1レビューで洗い出した穴を織り込んだ、Supabase配線の実装計画。
**canonical はこの `docs/` 配下**（リポジトリ管理）。親の `_planning/` は初期メモ（履歴）。

---

## 0. 前提・スタック
- Supabase（Postgres + Auth + Realtime + Storage + **Edge Functions**）
- デプロイ: Vercel（客用）/ 管理も同一Nextアプリ内でルート分離
- マルチテナント：全業務テーブルに `store_id` + RLS

## 1. 画面分割（M1で確定済みの方針を実装）
- `/order/[token]` … 客用注文（QRの遷移先）。**管理系には到達不可**。認証なし・セッショントークンで店舗/卓を特定。
- `/admin/*` … 管理ツール（厨房 / テーブル会計 / メニュー管理 / 設定 を1つに集約）。**Supabase Auth 必須**。
- M1の同居ページ（`page.tsx`）は開発用に残してよいが、本番導線からは外す。

---

## 2. 【B-1】注文書き込みは Edge Function 経由（RLS直INSERTしない）

匿名客の注文を RLS だけで安全に受けるのは困難（トークン有効性・在庫・冪等を同時に扱えない）。
→ 客用の注文送信は **Supabase Edge Function `submit_order`** を叩く。関数内で以下を一括処理：

1. セッショントークン検証（`table_sessions.status='open'` かつ期限内か）
2. **冪等キー**（クライアント生成UUID）で重複INSERTを弾く（【B-3】）
3. 在庫チェック＆**トランザクションで在庫減算**（`select ... for update`）
4. `orders` + `order_items` を INSERT（name/price はサーバ側で確定してスナップショット）
5. 成功レスポンス（作成された order を返す）

RLSは「読み取り」と「管理者の書き込み」を守る担当。客の書き込み口は関数のみ。

## 3. 【B-3】二重送信の防止（サーバ保証）
- `orders.idempotency_key text unique`（テナント内ユニーク）を追加。
- クライアントは注文ごとに UUID を生成し送信。リトライ時も同じキー → 2件目は関数が既存を返すだけ。
- M1の800ms無効化はUX演出として維持（保証はサーバ側）。

## 4. 【B-2】Realtime切断中の取りこぼし対策（最重要の運用リスク）
Supabase Realtime は切断中のイベントを再送しない。厨房が数十秒切れるとその間の注文が画面に出ない。
→ 三重の防御：
1. **再接続時に必ず全件 refetch**（`orders` を `where status='cooking'` で取り直す）。チャンネルの `SUBSCRIBED`/`CHANNEL_ERROR`/`CLOSED` を監視。
2. **定期ポーリングのフォールバック**（例：15〜30秒ごとに軽い件数/更新時刻チェック、差分があれば refetch）。Realtimeが死んでいても最悪ポーリングで拾う。
3. `connected` 表示は「Realtime購読状態 AND 直近ポーリング成功」で判定。切断時は既存の赤バナー＋通知音停止。
- 併せて `orders.updated_at` を持ち、refetch差分検出を容易に。

## 5. 【A-2 継続】名前でなくIDで繋ぐ（M1で対応済みをDBでも徹底）
- `order_items.menu_item_id uuid` を保持（削除耐性のため FK は `on delete set null` + name/price スナップショット併存）。
- 集約・取消・写真表示は全て id 基準（M1実装と一致）。

## 6. 【C-2】注文オプション/備考の“予約”（後付けが最も高コスト）
今すぐ機能実装しなくても、スキーマに枠だけ用意しておく：
- `order_items.options jsonb default '[]'` … トッピング/焼き加減/「ネギ抜き」等
- `order_items.note text` … 自由記述
- `menu_items.option_groups jsonb` … 商品ごとの選択肢定義（将来のオプションUI用）

## 7. 【B-5】売上・セッション履歴（店主が最も見たい画面）
- 会計＝**削除ではなく `table_sessions.status='closed'`**（M1は簡易的に削除）。orders は残す。
- 追加画面 `/admin/sales`：日次売上・時間帯別・**品目別ランキング**・客単価・卓回転。
- 集計は closed セッション＋order_items から。まずは日次ビュー、必要なら集計テーブル/マテビュー。

## 8. 【C-3 継続】スタッフ呼び出し
- `staff_calls` テーブル（M1のローカル `calls` に対応）。客用Function or RLSで INSERT、管理でRealtime購読、対応で `resolved_at`。

## 9. 【B-4】コスト計画（運用・販売前提）
- 開発：無料枠でOK。ただし**無料は1週間無アクセスで一時停止**、Realtime同時接続/容量に制限。
- 実店舗投入：**Supabase Pro（$25/月〜）前提**。テナント数×同時接続×注文量で試算。
- Vercel：小規模は無料〜Pro。画像は Storage + CDN。
- 販売時の価格設計（1店舗あたり原価）を別途表で管理。

## 10. 店舗オンボーディング（マルチテナントで売るなら必須）
- 導線：店舗作成 → スタッフ招待（メール）→ メニュー登録 → **卓ごとのQR発行/印刷** → 運用開始。
- `/admin/onboarding` ウィザードとして最小実装。

## 11. QRコード生成・印刷
- 各 `tables` 行に対し `/order/[token]` のQRを生成（`qrcode` ライブラリ等）。
- 卓名つきPDF/印刷レイアウト出力（A6カード等）。テーブルセッションのトークン運用と連動。

## 12. 写真の扱い（【A-7】）
- base64をstate/DB直載せしない。**Supabase Storage** にアップロード＋URL参照。
- アップロード時に**クライアント側リサイズ/圧縮**（長辺〜1024px, JPEG）してから送る。

## 13. 品質・運用（M2と同時に最低限入れる）
- **エラーバウンダリ**／ローディング・失敗表示（現状ゼロ）。特に注文送信の失敗UX。
- **DBマイグレーション管理**（Supabase migrations）。
- **監視**（Sentry等）とヘルスチェック。厨房端末のオフライン検知アラート。
- 主要フローの自動テスト（注文送信の冪等・在庫・セッション期限切れ）。

---

## 14. テーブルセッション運用（QR悪用対策・M1データモデルの具体化）
- QRは「卓固定URL」。アクセス時に有効な `open` セッションが無ければ、
  - 店員が開卓（推奨）または一定時間で自動失効するトークンを発行。
- 会計で `closed`。閉じたトークンでは Function が注文を拒否。
- 悪用（写真を撮って外から注文）は「open期間＋店員開卓＋初回目視」で実運用カバー。

## 15. 実装順（M2内のマイルストーン）
1. スキーマ + RLS + マイグレーション、seedを本アプリのダミーから移植
2. 読み取り配線（menu/orders/tables/calls を Supabase から取得、Realtime購読 + 再接続refetch + ポーリング）
3. 管理の書き込み（メニューCRUD・ステータス・会計=session close）
4. `submit_order` Edge Function（トークン/冪等/在庫）＋客用を関数経由に
5. 認証（スタッフ）・店舗分離（RLS）確認
6. QR生成・オンボーディング・売上履歴
7. 画像=Storage化＋リサイズ、エラーバウンダリ、監視、テスト
8. Vercelデプロイ・実機（客スマホ＋厨房タブレット）検証

> Zustandのアクション名を保ったまま「配列操作→Supabase呼び出し＋Realtime」に差し替える方針は維持。UIコンポーネントは概ね無改修で移行可能。
