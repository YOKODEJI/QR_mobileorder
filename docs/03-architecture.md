# アーキテクチャ / コンポーネント構成 / 状態設計

## スタック確定
- **Next.js 15（App Router, TypeScript）**
- **Tailwind CSS v4**（デザイントークンは CSS変数 + Tailwind拡張）
- **Zustand**（Milestone 1 の共有状態ストア。M2でSupabase同期に差し替え）
- **next/font**（Noto Sans JP）
- Milestone 2: **Supabase**（Postgres + Auth + Realtime + Storage）
- デプロイ: **Vercel**

## ルーティング設計
プロトタイプは1画面にタブ同居だが、実運用は端末が別。Milestone 1 では**プロトタイプ準拠で1ページにタブ同居**を再現しつつ、
将来の端末分離に備えてルートも切っておく。

```
app/
  layout.tsx                # フォント/globals/ルートdiv(zoom, font-family)
  page.tsx                  # プロトタイプ再現: 上部セグメント(客用/管理) 同居ビュー
  order/[table]/page.tsx    # 【将来】客用単独（QRの実アクセス先。管理へは行けない）
  admin/page.tsx            # 【将来】管理ツール（ログイン必須。厨房+テーブル会計+メニュー管理+設定を1つに集約）
```
> **本番の画面分割方針（2026-07-11 ユーザー確定）**:
> - **客用注文**は完全に独立（QRの専用URL `/order/[table]`）。管理系タブは一切表示しない。
> - **管理ツール**は1つに集約 = 厨房 / テーブル・会計 / メニュー管理 の3サブタブ + 設定。ログイン必須。
>   （当初案の「厨房を別URL」は撤回。小規模店では1端末で全部見られる方が実用的、との判断。）
> - **設定ボタン**は管理ツール内（サブタブ直下）にのみ配置。客用には出さない（客が店舗設定を触れないように）。
>
> Milestone 1 は `page.tsx` に同居のまま忠実移植を優先。単独ルートは薄いラッパで同じ画面コンポーネントを描画。

## コンポーネント分割
```
components/
  layout/
    TopHeader.tsx          # 店名 + 上部セグメント（設定ボタンは管理サブタブ直下のみ）
    SegmentedControl.tsx   # 再利用セグメント（上部タブ/厨房サブタブ）
  ui/
    Chip.tsx               # カテゴリチップ
    Toggle.tsx             # iOSトグルスイッチ
    AlertDialog.tsx        # iOS中央アラート（汎用 dialog state 駆動）
    BottomSheet.tsx        # ボトムシート（履歴/設定）
    Stepper.tsx            # 数量 −/＋ ステッパー
    PhotoSlot.tsx          # 写真ドラッグ&ドロップ / アップロード
  customer/
    CustomerOrder.tsx      # 客用注文（スマホ枠）
    MenuItemCard.tsx
    CartBar.tsx
    OrderSuccessOverlay.tsx
    HistorySheet.tsx
  kitchen/
    KitchenDisplay.tsx     # 厨房ディスプレイ
    KitchenTicket.tsx
    ConnectionIndicator.tsx
  staff/
    StaffCheckout.tsx      # テーブル/会計 + 代理注文
    TableList.tsx
    TableDetail.tsx
    ProxyOrderPanel.tsx
  menu/
    MenuManagement.tsx     # メニュー管理
    MenuAdminRow.tsx
    AddItemForm.tsx
  settings/
    SettingsSheet.tsx
```

## 状態ストア（Zustand）— プロトタイプ state を踏襲
`store/useAppStore.ts`

```ts
type Status = 'cooking' | 'served';
type Cat = 'ドリンク' | '一品料理' | '刺身' | '揚げ物' | '〆';

interface MenuItem { id: string; name: string; cat: Cat; price: number; soldOut: boolean; stock: number; photo?: string; sort: number; }
interface OrderItem { name: string; qty: number; price: number; photo?: string; }
interface Order { id: string; table: string; time: string; status: Status; items: OrderItem[]; proxy?: boolean; }
interface TableRec { id: string; name: string; }

interface AppState {
  // 設定
  theme: string; storeName: string; showHeaderPhoto: boolean; showFooterPhoto: boolean;
  headerPhoto?: string; footerPhoto?: string;
  // ナビ
  topTab: 'customer' | 'mgmt'; mgmtTab: 'kitchen' | 'staff' | 'menu';
  // カテゴリフィルタ
  customerCat: 'すべて' | Cat; proxyCat: 'すべて' | Cat; adminCat: 'すべて' | Cat;
  // カート
  cart: Record<string, number>; staffCart: Record<string, number>;
  // テーブル/客席
  customerTableId: string; tables: TableRec[]; tableEditMode: boolean; editingTableId?: string; editTableName: string;
  // tableEditMode: テーブル一覧の「テーブル編集」モード。ON時のみ ＋追加/名前変更 を表示。
  selectedStaffTable?: string;
  // 業務データ
  orders: Order[]; menu: MenuItem[];
  // 厨房/接続
  connected: boolean; soundOn: boolean; highlightId?: string;
  // UI一時状態
  submitting: boolean; justOrdered: boolean; showHistory: boolean; showSettings: boolean;
  // メニュー管理
  deleteMode: boolean; selectedIds: string[]; dragId?: string;
  // 汎用ダイアログ
  dialog?: { title: string; body: string; confirmText: string; danger?: boolean; onConfirm: () => void };
  // カウンタ
  nextId: number; nextTableId: number;
  // ...actions（add/remove cart, submitOrder, advanceStatus, checkout, cancelUnit, menu CRUD, reorder, etc.）
}
```

### 主要アクション（プロトタイプの挙動を移植）
- `submitOrder()` … cart→orders先頭に追加、`submitting`800ms、`justOrdered`表示、`highlightId`約2.6s、`soundOn`ならbeep(880Hz/0.4s WebAudio)。
- `advanceStatus(orderId)` … 確認ダイアログ経由で cooking↔served。
- `checkout(tableId)` … そのテーブルのorders除去（M2ではsession締め）。
- `cancelUnit(tableId, name)` … 最初の一致明細を1減算、空行/空注文を掃除。
- メニュー: `addItem` / `setPrice` / `setStock` / `toggleSoldOut` / `attachPhoto` / `removePhoto` / `reorder(dragId,overId)`（現カテゴリ内） / `bulkDelete`（2段確認）。
- 販売可否 helper: `available(item) = !item.soldOut && item.stock > 0`。

## 初期ダミーデータ
- store: 店名「炭火酒場 とり源」等（後で変更可）、theme 既定。
- tables: テーブル1〜6。
- menu: 10品（生ビール/ハイボール/枝豆/唐揚げ/だし巻き/マグロ刺身/シーザーサラダ/餃子/ポテトフライ/締めラーメン）をカテゴリ・価格付きで。
- customerTableId: テーブル5固定（プロトタイプ準拠）。

## Milestone 1 → 2 の差し替え計画
- Zustandストアの「配列操作」を、Supabaseクライアント呼び出し + Realtime購読に置換。
- ストアのインターフェイス（アクション名）を保てば、UIコンポーネントは無改修で移行可能。
- `connected` を Realtimeチャネル状態にバインド（擬似トグルは開発用に残す）。
