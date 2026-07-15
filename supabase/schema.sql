-- ============================================================
-- QR注文システム — Supabase スキーマ（Milestone 2）
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください。
-- docs/02-data-model.md / docs/04-milestone2-plan.md 準拠。
-- マルチテナント（全業務テーブルに store_id）＋ RLS。
--
-- ⚠ 注意: 末尾の RLS ポリシーは「開発用（anon 全許可）」です。
--    スタッフ認証を入れる段階で store_id ベースに必ず絞り込みます（04計画 B-1/10）。
-- ============================================================

-- 拡張（uuid生成）。Supabaseでは既定で利用可。
create extension if not exists pgcrypto;

-- ---- 店舗（テナント） --------------------------------------
--   tax_mode: 'inclusive'(内税) | 'exclusive'(外税)。tax_rate は外税のときの消費税率(%)。
--   charge_rate: チャージ料(%)。0なら無し。
create table if not exists stores (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  theme             text not null default '#cf4b2c',
  show_header_photo boolean not null default false,
  show_footer_photo boolean not null default false,
  header_photo_url  text,
  footer_photo_url  text,
  tax_mode          text not null default 'inclusive',
  tax_rate          numeric not null default 10,
  charge_rate       numeric not null default 0,
  created_at        timestamptz not null default now()
);

-- ---- スタッフ（店舗に属するユーザー。auth.users と1対1で紐付く） ----
create table if not exists staff (
  id        uuid primary key default gen_random_uuid(),
  store_id  uuid not null references stores(id) on delete cascade,
  user_id   uuid unique,                -- auth.users との紐付け（1ユーザー1店舗）
  role      text not null default 'staff', -- owner / staff / kitchen
  created_at timestamptz not null default now()
);

-- ---- 客席 --------------------------------------------------
--   qr_token      : QRに埋め込む固定トークン（印刷用。/order/[id]?k=qr_token）。
--                   再発行ボタンでのみ変わる＝印刷QRを無効化する重い操作。
--   session_token : 来店セッション単位のトークン。会計(close_table)で自動更新し、
--                   退店した客の端末からの再注文を封じる。open_session で客に配る。
create table if not exists tables (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references stores(id) on delete cascade,
  name          text not null,
  sort          int not null default 0,
  qr_token      text not null default encode(gen_random_bytes(12), 'hex'),
  session_token text not null default encode(gen_random_bytes(12), 'hex')
);

-- ---- 来店セッション（QR悪用対策の核。M2後半で本格利用） ----
create table if not exists table_sessions (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references stores(id) on delete cascade,
  table_id   uuid not null references tables(id) on delete cascade,
  token      text unique not null,
  status     text not null default 'open',  -- open / closed
  opened_at  timestamptz not null default now(),
  closed_at  timestamptz
);

-- ---- カテゴリ（メニュー分類。店舗ごとに増減可能） -----------
-- 「その他」は削除不可のフォールバック（UI側で保護。カテゴリ削除時、そのカテゴリの
-- menu_items.cat は「その他」へ書き換える。DB側もON DELETE RESTRICTで裏付ける）。
create table if not exists categories (
  id       uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name     text not null,
  sort     int not null default 0,
  constraint categories_store_name_key unique (store_id, name)
);

-- ---- メニュー ----------------------------------------------
-- cat: categories(store_id, name) への複合FK。
--   ON UPDATE CASCADE  … カテゴリ名を変更(rename)すると全メニューのcatが自動追従する
--   ON DELETE RESTRICT … カテゴリ削除は、先にmenu_itemsの再割当て(→その他)が済んでいないと拒否される
create table if not exists menu_items (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references stores(id) on delete cascade,
  name       text not null,
  cat        text not null default 'その他',
  price      int not null default 0, -- 1円単位
  sold_out   boolean not null default false,
  stock      int not null default 0,
  photo_url  text,
  sort       int not null default 0,
  constraint menu_items_cat_fkey foreign key (store_id, cat)
    references categories(store_id, name)
    on update cascade
    on delete restrict
);

-- ---- 注文（伝票） ------------------------------------------
create table if not exists orders (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references stores(id) on delete cascade,
  table_id        uuid not null references tables(id) on delete cascade,
  session_id      uuid references table_sessions(id) on delete set null,
  status          text not null default 'cooking',  -- cooking / served
  proxy           boolean not null default false,
  idempotency_key text unique,        -- 二重送信防止（04計画 B-3）
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---- 注文明細（正規化。当時の名前/価格をスナップショット） ----
create table if not exists order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  name         text not null,
  price        int not null,
  qty          int not null,
  options      jsonb not null default '[]',  -- 予約: トッピング等（04計画 C-2）
  note         text
);

-- ---- スタッフ呼び出し --------------------------------------
create table if not exists staff_calls (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references stores(id) on delete cascade,
  table_id    uuid not null references tables(id) on delete cascade,
  session_id  uuid references table_sessions(id) on delete set null,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

-- ---- 会計履歴（レシート・スナップショット。常時閲覧） ------
create table if not exists checkouts (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references stores(id) on delete cascade,
  table_id        uuid references tables(id) on delete set null,
  table_name      text not null,           -- 会計時点の卓名スナップショット
  items           jsonb not null default '[]', -- [{menuItemId,name,price,qty}]
  count           int not null default 0,
  subtotal        int not null default 0, -- 品目合計（割引/チャージ料/税を引く前）
  discount_type   text,                   -- 'percent' | 'amount' | null
  discount_value  numeric,                -- percentなら%、amountなら円
  discount_amount int not null default 0, -- 実際に引かれた円額
  charge_amount   int not null default 0, -- チャージ料（円）
  tax_amount      int not null default 0, -- 消費税額（外税のときのみ0超）
  total           int not null default 0, -- 最終合計
  closed_at       timestamptz not null default now()
);

-- ---- インデックス ------------------------------------------
create index if not exists idx_menu_store   on menu_items(store_id, sort);
create index if not exists idx_tables_store  on tables(store_id, sort);
create index if not exists idx_orders_store  on orders(store_id, status, created_at);
create index if not exists idx_orderitems    on order_items(order_id);
create index if not exists idx_calls_store   on staff_calls(store_id, resolved_at);
create index if not exists idx_checkouts_store on checkouts(store_id, closed_at desc);

-- ---- 更新時刻の自動更新（orders.updated_at） ---------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_orders_updated on orders;
create trigger trg_orders_updated before update on orders
  for each row execute function set_updated_at();

-- ============================================================
-- Realtime: 変更をブロードキャストするテーブルを publication に追加
-- 既に登録済みならスキップ（再実行しても安全）
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'orders','order_items','menu_items','tables','staff_calls','checkouts','categories'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I;', t);
    end if;
  end loop;
end $$;

-- ============================================================
-- RLS（行レベルセキュリティ）
-- 全テーブルで有効化。authenticated = ログイン済みスタッフ。
-- staff.user_id → store_id の紐付け(staff_store_id()関数)で、各スタッフは
-- 自店舗のデータにのみアクセスできる（1つのSupabaseプロジェクトを複数店舗で
-- 共有するマルチテナント構成を見据えた設計。詳細は supabase/step10-tenant-isolation.sql）。
--
-- 書込の原則: 客(anon)からの直接書込は禁止。注文/会計/QR再発行は
-- SECURITY DEFINER の RPC(place_order/close_table/regenerate_table_token)経由のみ
-- （owner=postgres として実行されるため、ここでのRLS/権限を越えて動く＝これらの関数の
-- 中身自体が唯一の防御線になる。詳細は functions.sql のコメント参照）。
--
-- 既知の残課題: 客(anon)の閲覧は店舗単位までしか絞れていない（同一店舗内の卓間、
-- および複数店舗をこの1プロジェクトで共有する場合は店舗間も）。anonは認証を持たないため
-- RLSだけで卓/店舗単位に絞るには Anonymous Auth 等の追加設計が要る。詳細は
-- docs/07-tenant-isolation.md 参照。
-- ============================================================
alter table stores          enable row level security;
alter table staff           enable row level security;
alter table tables          enable row level security;
alter table table_sessions  enable row level security;
alter table categories      enable row level security;
alter table menu_items      enable row level security;
alter table orders          enable row level security;
alter table order_items     enable row level security;
alter table staff_calls     enable row level security;
alter table checkouts       enable row level security;

-- staff_store_id(): 呼び出しユーザー(auth.uid())が属する店舗idを返す。
-- staffテーブル自体はポリシー0件（全ロール拒否）のため、SECURITY DEFINERで
-- それを乗り越えて自分の行だけ読む。RLSポリシー・RPC双方の「自店舗チェック」の判定源。
create or replace function staff_store_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select store_id from staff where user_id = auth.uid() limit 1;
$$;
revoke execute on function staff_store_id() from public, anon;
grant  execute on function staff_store_id() to authenticated;

-- stores: 閲覧は誰でも、authenticatedの閲覧/更新は自店舗のみ
create policy stores_select_anon          on stores for select to anon using (true);
create policy stores_select_authenticated on stores for select to authenticated using (id = staff_store_id());
create policy stores_update_authenticated on stores for update to authenticated
  using (id = staff_store_id()) with check (id = staff_store_id());

-- categories: 閲覧は誰でも、増減は自店舗スタッフのみ
create policy categories_select_anon          on categories for select to anon using (true);
create policy categories_select_authenticated on categories for select to authenticated using (store_id = staff_store_id());
create policy categories_write_authenticated  on categories for all to authenticated
  using (store_id = staff_store_id()) with check (store_id = staff_store_id());

-- tables: 客は qr_token/session_token を直接読めない（open_session RPC経由のみ配布）
revoke select on tables from anon;
grant select (id, store_id, name, sort) on tables to anon;
create policy tables_select_anon          on tables for select to anon using (true);
create policy tables_select_authenticated on tables for select to authenticated using (store_id = staff_store_id());
create policy tables_write_authenticated  on tables for all to authenticated
  using (store_id = staff_store_id()) with check (store_id = staff_store_id());

-- menu_items: 閲覧は誰でも、CRUD は自店舗スタッフのみ
create policy menu_items_select_anon          on menu_items for select to anon using (true);
create policy menu_items_select_authenticated on menu_items for select to authenticated using (store_id = staff_store_id());
create policy menu_items_write_authenticated  on menu_items for all to authenticated
  using (store_id = staff_store_id()) with check (store_id = staff_store_id());

-- orders / order_items: insertは誰にも許可しない（place_order RPC経由のみ）。
-- status更新・明細の取消/削除は自店舗スタッフのみ。
create policy orders_select_anon          on orders for select to anon using (true);
create policy orders_select_authenticated on orders for select to authenticated using (store_id = staff_store_id());
create policy orders_update_authenticated on orders for update to authenticated
  using (store_id = staff_store_id()) with check (store_id = staff_store_id());

create policy order_items_select_anon on order_items for select to anon using (true);
create policy order_items_select_authenticated on order_items for select to authenticated using (
  exists (select 1 from orders o where o.id = order_items.order_id and o.store_id = staff_store_id())
);
create policy order_items_update_authenticated on order_items for update to authenticated
  using (exists (select 1 from orders o where o.id = order_items.order_id and o.store_id = staff_store_id()))
  with check (exists (select 1 from orders o where o.id = order_items.order_id and o.store_id = staff_store_id()));
create policy order_items_delete_authenticated on order_items for delete to authenticated
  using (exists (select 1 from orders o where o.id = order_items.order_id and o.store_id = staff_store_id()));

-- staff_calls: 客は呼び出す(insert)＋確認(select)のみ。対応済み化(update)/削除は自店舗スタッフのみ
create policy staff_calls_select_anon          on staff_calls for select to anon using (true);
create policy staff_calls_select_authenticated on staff_calls for select to authenticated using (store_id = staff_store_id());
create policy staff_calls_insert_all           on staff_calls for insert to anon, authenticated with check (true);
create policy staff_calls_update_authenticated on staff_calls for update to authenticated
  using (store_id = staff_store_id()) with check (store_id = staff_store_id());
create policy staff_calls_delete_authenticated on staff_calls for delete to authenticated
  using (store_id = staff_store_id());

-- checkouts: 会計履歴は客に見せない。スタッフも自店舗分のみ
create policy checkouts_select_authenticated on checkouts for select to authenticated using (store_id = staff_store_id());
create policy checkouts_insert_authenticated on checkouts for insert to authenticated with check (store_id = staff_store_id());

-- staff / table_sessions: アプリからは未使用。ポリシー0件のまま（＝全ロール完全拒否）が最も安全。
-- staffテーブルへのアクセスは staff_store_id() 関数(SECURITY DEFINER)経由のみ。
