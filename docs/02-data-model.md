# データモデル設計（多店舗 / マルチテナント前提）

方針: **Milestone 1（UI移植）はローカル状態のみ**だが、型は最初からこのスキーマに揃えておき、
Milestone 2 で Supabase テーブルにそのまま対応づける。全業務テーブルに `store_id` を持たせる。

## テナント分離の基本
- 1テナント = 1 `store`。全データ（menu / orders / tables）は `store_id` で分離。
- Supabase では **Row Level Security (RLS)** を全テーブルに有効化し、`store_id` で行を絞る。
- 客用ページはログイン不要（QRのトークンで店とテーブルを特定）。厨房/管理はスタッフ認証必須。

## テーブル定義（Supabase / Postgres）

### stores（店舗＝テナント）
| 列 | 型 | 備考 |
|---|---|---|
| id | uuid PK | |
| name | text | 店舗名（ヘッダー表示） |
| theme | text | アクセント色（`#cf4b2c`等） |
| show_header_photo | bool | 客用ヘッダー写真表示 |
| show_footer_photo | bool | 客用フッター写真表示 |
| header_photo_url | text null | |
| footer_photo_url | text null | |
| created_at | timestamptz | |

### staff（スタッフ＝店舗に属するユーザー）
| id | uuid PK |
| store_id | uuid FK → stores |
| user_id | uuid FK → auth.users | Supabase Auth と紐付け |
| role | text | `owner` / `staff` / `kitchen` |

### tables（客席）
| id | uuid PK |
| store_id | uuid FK |
| name | text | 「テーブル 5番」等 |
| sort | int | 表示順 |

### table_sessions（来店セッション。QR悪用対策の核） ※Milestone 2
| id | uuid PK |
| store_id | uuid FK |
| table_id | uuid FK |
| token | text unique | QR/URLに載る一時トークン |
| status | text | `open` / `closed` |
| opened_at | timestamptz |
| closed_at | timestamptz null | 会計で閉じる |
> QRは「テーブル固定URL」→ アクセス時に有効な open セッションが無ければ発行/店員確認。
> 会計（お会計する）で `status=closed`。閉じたセッションのトークンでは注文不可。

### menu_items（メニュー）
| id | uuid PK |
| store_id | uuid FK |
| name | text |
| cat | text | `ドリンク`/`一品料理`/`刺身`/`揚げ物`/`〆` |
| price | int | 1円単位 |
| sold_out | bool |
| stock | int |
| photo_url | text null |
| sort | int | ドラッグ並び替え |
> 販売可否 = `sold_out=false AND stock>0`（派生。DBには持たず算出）。

### orders（注文＝伝票）
| id | uuid PK |
| store_id | uuid FK |
| table_id | uuid FK |
| session_id | uuid FK null | M2で使用 |
| status | text | `cooking` / `served` |
| proxy | bool | 店員代理注文か |
| idempotency_key | text unique | **二重送信防止**（クライアント生成UUID, テナント内一意）→ 04計画B-3 |
| created_at | timestamptz | 注文時刻（M1では ISO文字列で保持済み） |
| updated_at | timestamptz | Realtime再接続時の差分検出用 → 04計画B-2 |

### order_items（注文明細） ※プロトタイプは items をJSON埋め込みだが、正規化する
| id | uuid PK |
| order_id | uuid FK → orders |
| menu_item_id | uuid FK null | **ID参照**（`on delete set null`）。名前一致に依存しない → M1で対応済み |
| name | text | 注文時点の名称スナップショット |
| price | int | 注文時点の**本体単価**スナップショット（オプション料金は含まない） |
| qty | int |
| options | jsonb default '[]' | 選択されたオプションのスナップショット `[{id,name,priceDelta}]`（id昇順で正規化）→ step14 |
| note | text null | **予約**: 自由記述（「ネギ抜き」等） |

> **スナップショット指針**: 注文明細は当時の name/price を保存する（後からメニュー改定しても伝票と履歴がぶれない）。
> **ID紐付け**: 集約・per-unit取消・写真表示は `menu_item_id` 基準（M1で名前一致から移行済み）。写真は menu_items.photo_url を id で参照。
> **実売価**: `price + Σ options[].priceDelta`。`price` に合算しないのは、品目別売上で「本体売上」と「オプション売上」を分離できるようにするため。
> 金額表示は必ず `lib/options.ts` の `unitPrice()` / `lineTotal()`（SQL側は `options_delta()`）を通すこと。

### menu_item_options（商品オプション） → step14 → step15で商品ごとの個別設定に変更
| id | uuid PK |
| menu_item_id | uuid FK → menu_items | `on delete cascade` |
| name | text | 例「大盛り」。`unique(menu_item_id, name)` |
| price_delta | int default 0 | 追加料金（円）。0やマイナス（値引き）も可 |
| sort | int | 表示順 |

> **オプションは商品ごとの所有**。step14では「店舗共通の候補リストを商品に割り当てる」多対多だったが、
> `unique(store_id, name)` のせいで「ラーメンの大盛り +100円」と「カレーの大盛り +200円」を同時に持てず、
> step15で商品ごとの個別設定に作り直した（代わりに、同じ選択肢を複数商品で使う場合は商品ごとに入力する）。
> **価格はクライアントを信用しない**: 客/店員が送るのは `optionIds` だけで、追加料金は必ず `place_order` が
> `menu_item_options` から引く。`menu_item_id` の一致で「その商品が持つオプションか」も検証し、
> 不正・重複があれば注文ごと拒否する（黙って落とすと厨房が違う物を作るため）。
> 親の商品は既に `store_id` を検証済みなので、店舗チェックも自動的に効く。

### staff_calls（スタッフ呼び出し） ※M1のローカル `calls` に対応
| id | uuid PK |
| store_id | uuid FK |
| table_id | uuid FK |
| session_id | uuid FK null |
| created_at | timestamptz |
| resolved_at | timestamptz null | 「対応済み」で埋める |

### 卓の開閉ゲート + 未提供繰越（step17）
- `tables.open_since timestamptz` … null=閉(注文不可)、非null=来店受付した時刻。
  **会計(close_table)で自動的に閉じ、スタッフの「来店受付」(open_table RPC)で開く。**
  閉じている間は open_session がセッションを配らず、place_order も拒否する
  （印刷QRのURLは固定で「URLを知る元客」と「今の客」を区別できないため、
  店側が握る開閉状態を注文可否の唯一の判定源にする。家からのいたずら注文対策）。
- `orders.checked_out_at timestamptz` … 会計済みだが未提供の繰越伝票(step17)。
  会計時、提供済み(served)は削除・未提供(cooking)はこれを立てて厨房にだけ残す。
  **非nullの伝票は支払い済みのため、厨房以外のどの集計・表示にも含めないこと**
  （客の履歴・会計画面・卓タイル・次回会計の集計すべて。含めると二重請求や
  前客の注文の混入が起きる）。提供完了で finish_checked_out_order RPC が削除する
  （在庫は戻さない。会計スナップショットに含まれる=売上記録は失われない）。

## 主な派生・操作
- **テーブル合計/点数** = そのテーブルの open な orders の order_items 合計。
- **会計（セッション締め）** = **削除ではなく `session.closed`** にして履歴を残す（売上集計の元データ。M1は簡易的に削除だがM2で履歴保持へ）→ 04計画B-5。
- **per-unit 取消** = 対象 `menu_item_id` **かつ同じオプションの組み合わせ**の order_item を1つ減算、0なら行削除、空注文なら order 削除。**在庫を1戻す**（M1で実装済み。オプション対応は step14）。
- **カート行キー** = `商品ID|オプションID昇順` （`lib/options.ts` の `cartKey()`）。同じ商品でも組み合わせが違えば別行として数量を持つ。
  選んだ順に依存しないよう必ず昇順で正規化する（SQL側の `options_key()` と同じルール）。
- **在庫** = 注文送信で減算、取消で復元、カートは在庫上限で制限（M1実装済み。M2ではFunction内トランザクションで確定）→ 04計画B-1。
- **写真** = menu_items.photo_url を `menu_item_id` で客用/厨房/会計に横断表示。画像は Storage + URL、アップロード時リサイズ → 04計画A-7。

## リアルタイム（Milestone 2）
- Supabase Realtime で `orders` / `order_items` / `menu_items` の変更を購読。
- 客の注文 INSERT → 厨房画面に即時 push（新着 `kpulse`）。
- メニュー sold_out 切替 → 客用/代理メニューに即時反映。
- 接続状態は Realtime のチャネル状態から算出し、切断時に厨房オフラインバナー表示。

## Milestone 1 でのローカル対応
- 上記を **Zustandストア**の in-memory 配列で表現（`03-architecture.md` 参照）。
- store は単一固定（`store_id` 相当は持つが1件）。auth/session/realtime はダミー（接続トグルは擬似）。
