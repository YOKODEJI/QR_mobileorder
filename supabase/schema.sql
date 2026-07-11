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
create table if not exists stores (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  theme             text not null default '#cf4b2c',
  show_header_photo boolean not null default false,
  show_footer_photo boolean not null default false,
  header_photo_url  text,
  footer_photo_url  text,
  created_at        timestamptz not null default now()
);

-- ---- スタッフ（店舗に属するユーザー。認証はM2後半で接続） ----
create table if not exists staff (
  id        uuid primary key default gen_random_uuid(),
  store_id  uuid not null references stores(id) on delete cascade,
  user_id   uuid,                       -- auth.users との紐付け（後で）
  role      text not null default 'staff', -- owner / staff / kitchen
  created_at timestamptz not null default now()
);

-- ---- 客席 --------------------------------------------------
create table if not exists tables (
  id        uuid primary key default gen_random_uuid(),
  store_id  uuid not null references stores(id) on delete cascade,
  name      text not null,
  sort      int not null default 0
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

-- ---- メニュー ----------------------------------------------
create table if not exists menu_items (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references stores(id) on delete cascade,
  name       text not null,
  cat        text not null,          -- ドリンク/一品料理/刺身/揚げ物/〆
  price      int not null default 0, -- 1円単位
  sold_out   boolean not null default false,
  stock      int not null default 0,
  photo_url  text,
  sort       int not null default 0
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
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references stores(id) on delete cascade,
  table_id   uuid references tables(id) on delete set null,
  table_name text not null,           -- 会計時点の卓名スナップショット
  items      jsonb not null default '[]', -- [{menuItemId,name,price,qty}]
  count      int not null default 0,
  total      int not null default 0,
  closed_at  timestamptz not null default now()
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
-- ============================================================
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table order_items;
alter publication supabase_realtime add table menu_items;
alter publication supabase_realtime add table tables;
alter publication supabase_realtime add table staff_calls;
alter publication supabase_realtime add table checkouts;

-- ============================================================
-- RLS（行レベルセキュリティ）
-- 全テーブルで有効化。★以下は「開発用」ポリシー（anon 全許可）。
--   認証導入時に "store_id = 現在のスタッフの店舗" 等へ必ず差し替える。
-- ============================================================
alter table stores          enable row level security;
alter table staff           enable row level security;
alter table tables          enable row level security;
alter table table_sessions  enable row level security;
alter table menu_items      enable row level security;
alter table orders          enable row level security;
alter table order_items     enable row level security;
alter table staff_calls     enable row level security;
alter table checkouts       enable row level security;

-- 開発用: 全操作を許可（anon / authenticated）。※本番前に必ず絞る
do $$
declare t text;
begin
  foreach t in array array[
    'stores','staff','tables','table_sessions','menu_items',
    'orders','order_items','staff_calls','checkouts'
  ]
  loop
    execute format('drop policy if exists dev_all on %I;', t);
    execute format(
      'create policy dev_all on %I for all to anon, authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;
