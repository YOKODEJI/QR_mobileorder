-- ============================================================
-- ステップ10 マルチテナント分離（スタッフのstore_id紐付け）移行スクリプト（既存DB向け・1回だけ実行）
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください。
-- 前提: supabase/step5-rls.sql 実行済み。functions.sql は本ファイルの後に再実行すること
--       （close_table/regenerate_table_tokenのstore_id検証はfunctions.sql側で追加するため）。
-- 冪等（再実行しても安全）。
--
-- 背景: 「店舗ごとに別Vercelデプロイ」方式に加え、将来的に1つのSupabaseプロジェクトを
-- 複数店舗で共有する構成（マルチテナント方式）にも耐えられるよう、
-- 「ログイン済み=スタッフ」という単純化を廃止し、staff.user_id→store_id の紐付けで
-- 各スタッフを自店舗のデータにのみ制限する。
-- ============================================================

-- ------------------------------------------------------------
-- 1) staff: 1ユーザーにつき1店舗（1行）を保証するunique制約
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'staff_user_id_key'
  ) then
    alter table staff add constraint staff_user_id_key unique (user_id);
  end if;
end $$;

-- ------------------------------------------------------------
-- 2) 既存の認証ユーザーを現店舗のスタッフとして紐付け（バックフィル）
--    現状は単一店舗運用のため、既存の auth.users 全員を今の STORE_ID の
--    スタッフとして登録する。2店舗目以降を追加する際は、そのスタッフの
--    auth.users.id を確認した上で個別に insert すること（このバックフィルは
--    使わない）。
-- ------------------------------------------------------------
insert into staff (store_id, user_id, role)
select '1ba648fd-62e1-4bfc-bc28-dac5695fdf77'::uuid, u.id, 'owner'
from auth.users u
on conflict (user_id) do nothing;

-- ------------------------------------------------------------
-- 3) staff_store_id(): 呼び出しユーザー(auth.uid())が属する店舗idを返す。
--    RLSポリシー・RPC双方の「自店舗チェック」の唯一の判定源。
--    staffテーブル自体はポリシー0件（全ロール拒否）のままなので、
--    この関数はSECURITY DEFINERでそれを乗り越えて自分の行だけ読む。
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 4) RLSポリシーを store_id スコープに書き換え
--    anon向けポリシー（客の閲覧・呼び出し）は現状維持。
--    authenticated向けポリシーのみ「自分のstore_idの行だけ」に限定する。
-- ------------------------------------------------------------

-- stores: 閲覧は誰でも(anon既存のまま)、authenticatedの閲覧/更新は自店舗のみ
drop policy if exists stores_select_all           on stores;
drop policy if exists stores_update_authenticated on stores;
create policy stores_select_anon          on stores for select to anon using (true);
create policy stores_select_authenticated on stores for select to authenticated using (id = staff_store_id());
create policy stores_update_authenticated on stores for update to authenticated
  using (id = staff_store_id()) with check (id = staff_store_id());

-- categories: 閲覧は誰でも、増減は自店舗スタッフのみ
drop policy if exists categories_select_all          on categories;
drop policy if exists categories_write_authenticated on categories;
create policy categories_select_anon          on categories for select to anon using (true);
create policy categories_select_authenticated on categories for select to authenticated using (store_id = staff_store_id());
create policy categories_write_authenticated  on categories for all to authenticated
  using (store_id = staff_store_id()) with check (store_id = staff_store_id());

-- tables: 客は限定列のみ(既存の列レベルGRANTのまま)、authenticatedの書込は自店舗のみ
drop policy if exists tables_select_all          on tables;
drop policy if exists tables_write_authenticated on tables;
create policy tables_select_anon          on tables for select to anon using (true);
create policy tables_select_authenticated on tables for select to authenticated using (store_id = staff_store_id());
create policy tables_write_authenticated  on tables for all to authenticated
  using (store_id = staff_store_id()) with check (store_id = staff_store_id());

-- menu_items: 閲覧は誰でも、CRUDは自店舗スタッフのみ
drop policy if exists menu_items_select_all          on menu_items;
drop policy if exists menu_items_write_authenticated on menu_items;
create policy menu_items_select_anon          on menu_items for select to anon using (true);
create policy menu_items_select_authenticated on menu_items for select to authenticated using (store_id = staff_store_id());
create policy menu_items_write_authenticated  on menu_items for all to authenticated
  using (store_id = staff_store_id()) with check (store_id = staff_store_id());

-- orders: 客の閲覧は既存のまま(店舗内テーブル間分離は別課題として未対応。docs参照)。
--         status更新(調理中→提供済み)は自店舗スタッフのみ。
drop policy if exists orders_select_all           on orders;
drop policy if exists orders_update_authenticated  on orders;
create policy orders_select_anon          on orders for select to anon using (true);
create policy orders_select_authenticated on orders for select to authenticated using (store_id = staff_store_id());
create policy orders_update_authenticated on orders for update to authenticated
  using (store_id = staff_store_id()) with check (store_id = staff_store_id());

-- order_items: store_id列が無いため、親orderのstore_idをサブクエリで参照
drop policy if exists order_items_select_all           on order_items;
drop policy if exists order_items_update_authenticated  on order_items;
drop policy if exists order_items_delete_authenticated  on order_items;
create policy order_items_select_anon on order_items for select to anon using (true);
create policy order_items_select_authenticated on order_items for select to authenticated using (
  exists (select 1 from orders o where o.id = order_items.order_id and o.store_id = staff_store_id())
);
create policy order_items_update_authenticated on order_items for update to authenticated
  using (exists (select 1 from orders o where o.id = order_items.order_id and o.store_id = staff_store_id()))
  with check (exists (select 1 from orders o where o.id = order_items.order_id and o.store_id = staff_store_id()));
create policy order_items_delete_authenticated on order_items for delete to authenticated
  using (exists (select 1 from orders o where o.id = order_items.order_id and o.store_id = staff_store_id()));

-- staff_calls: 客の呼出(insert)/確認(select)は既存のまま。対応済み化/削除は自店舗スタッフのみ
drop policy if exists staff_calls_select_all          on staff_calls;
drop policy if exists staff_calls_insert_all          on staff_calls;
drop policy if exists staff_calls_update_authenticated on staff_calls;
drop policy if exists staff_calls_delete_authenticated on staff_calls;
create policy staff_calls_select_anon          on staff_calls for select to anon using (true);
create policy staff_calls_select_authenticated on staff_calls for select to authenticated using (store_id = staff_store_id());
create policy staff_calls_insert_all           on staff_calls for insert to anon, authenticated with check (true);
create policy staff_calls_update_authenticated on staff_calls for update to authenticated
  using (store_id = staff_store_id()) with check (store_id = staff_store_id());
create policy staff_calls_delete_authenticated on staff_calls for delete to authenticated
  using (store_id = staff_store_id());

-- checkouts: 会計履歴は客に見せない。スタッフも自店舗分のみ
drop policy if exists checkouts_select_authenticated on checkouts;
drop policy if exists checkouts_insert_authenticated on checkouts;
create policy checkouts_select_authenticated on checkouts for select to authenticated using (store_id = staff_store_id());
create policy checkouts_insert_authenticated on checkouts for insert to authenticated with check (store_id = staff_store_id());

-- staff / table_sessions: 引き続きポリシー0件（全ロール拒否）を維持。
-- staffテーブルへのアクセスは staff_store_id() 関数(SECURITY DEFINER)経由のみ。

-- ============================================================
-- 確認用（実行後、必要なら流してみてください）:
--   select id, user_id, store_id, role from staff;  -- バックフィルされたスタッフ確認
--   select staff_store_id();  -- 自分（実行者）のセッションではauth.uid()が無いのでNULLのはず
-- 実際の動作確認はアプリから: /admin にログイン後、ブラウザのconsoleで
--   await window.supabase?.rpc('staff_store_id')  -- 自分のstore_idが返ればOK
-- （もしくは AdminAuthGate の実装確認で自動的に検証される）
-- ============================================================
