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
| created_at | timestamptz | 表示の「time」 |

### order_items（注文明細） ※プロトタイプは items をJSON埋め込みだが、正規化する
| id | uuid PK |
| order_id | uuid FK → orders |
| menu_item_id | uuid FK null | 削除メニュー耐性のためnull許容 |
| name | text | 注文時点の名称スナップショット |
| price | int | 注文時点の価格スナップショット |
| qty | int |
| photo_url | text null | 表示用（名称一致でも可） |

> **スナップショット指針**: 注文明細は当時の name/price を保存する（後からメニュー改定しても伝票と履歴がぶれない）。
> プロトタイプは items:[{name,qty,price}] を order に埋めていた。正規化しておくと会計集計・per-unit取消が素直。

## 主な派生・操作（プロトタイプ準拠）
- **テーブル合計/点数** = そのテーブルの open な orders の order_items 合計。
- **会計（セッション締め）** = そのテーブルの orders を締める（プロトタイプでは削除。実装では `session.closed` にして履歴は残す）。
- **per-unit 取消** = 対象名の order_item を1つ減算、0なら行削除、空注文なら order 削除。
- **写真** = menu_items.photo_url を name で客用/厨房/会計に横断表示（正規化後は menu_item_id で参照）。

## リアルタイム（Milestone 2）
- Supabase Realtime で `orders` / `order_items` / `menu_items` の変更を購読。
- 客の注文 INSERT → 厨房画面に即時 push（新着 `kpulse`）。
- メニュー sold_out 切替 → 客用/代理メニューに即時反映。
- 接続状態は Realtime のチャネル状態から算出し、切断時に厨房オフラインバナー表示。

## Milestone 1 でのローカル対応
- 上記を **Zustandストア**の in-memory 配列で表現（`03-architecture.md` 参照）。
- store は単一固定（`store_id` 相当は持つが1件）。auth/session/realtime はダミー（接続トグルは擬似）。
