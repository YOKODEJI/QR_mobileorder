-- ============================================================
-- ステップ8 カテゴリ管理 + チャージ料オンオフ 移行スクリプト（既存DB向け・1回だけ実行）
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください。
-- 実行後、必ず supabase/functions.sql も再実行してください
--   （close_table に p_charge_enabled 引数を追加済み。シグネチャが変わったため
--    旧関数をdropしてから再作成する必要があります）。
-- 冪等（再実行しても安全）。
-- ============================================================

-- 1) カテゴリテーブル
create table if not exists categories (
  id       uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name     text not null,
  sort     int not null default 0
);
create unique index if not exists idx_categories_store_name on categories(store_id, name);

-- 2) 既存店舗に、今すでに使われているカテゴリ + 「その他」を投入
--   （menu_itemsに実在するカテゴリを拾うので、店ごとに違うカテゴリ構成でも安全）
insert into categories (store_id, name, sort)
select distinct m.store_id, m.cat, 1
from menu_items m
on conflict (store_id, name) do nothing;

insert into categories (store_id, name, sort)
select s.id, 'その他', 999
from stores s
on conflict (store_id, name) do nothing;

-- 3) Realtime購読対象に追加
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'categories'
  ) then
    execute 'alter publication supabase_realtime add table categories;';
  end if;
end $$;

-- 4) RLS: 閲覧は誰でも、増減はスタッフ(authenticated)のみ
alter table categories enable row level security;
drop policy if exists categories_select_all          on categories;
drop policy if exists categories_write_authenticated on categories;
create policy categories_select_all          on categories for select to anon, authenticated using (true);
create policy categories_write_authenticated on categories for all to authenticated using (true) with check (true);

-- 確認用: select * from categories order by sort;
