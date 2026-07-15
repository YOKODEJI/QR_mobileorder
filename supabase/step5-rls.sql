-- ============================================================
-- ステップ5 RLS最終厳格化（既存DB向け・1回だけ実行）
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください。
-- 前提: supabase/functions.sql を先に実行済みであること（関数を参照するため）。
-- 冪等（再実行しても安全）。
-- ============================================================

-- ------------------------------------------------------------
-- 1) 開発用の「全許可」ポリシーを撤去
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'stores','staff','tables','table_sessions','menu_items',
    'orders','order_items','staff_calls','checkouts'
  ]
  loop
    execute format('drop policy if exists dev_all on %I;', t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 2) stores: 誰でも閲覧、更新はスタッフ(authenticated)のみ
-- ------------------------------------------------------------
drop policy if exists stores_select_all          on stores;
drop policy if exists stores_update_authenticated on stores;
create policy stores_select_all          on stores for select to anon, authenticated using (true);
create policy stores_update_authenticated on stores for update to authenticated using (true) with check (true);

-- ------------------------------------------------------------
-- 3) tables: 客(anon)は qr_token/session_token を直接読めない。
--    open_session RPC（SECURITY DEFINER）だけがそれを照合・配布する。
-- ------------------------------------------------------------
revoke select on tables from anon;
grant select (id, store_id, name, sort) on tables to anon;

drop policy if exists tables_select_all          on tables;
drop policy if exists tables_write_authenticated on tables;
create policy tables_select_all          on tables for select to anon, authenticated using (true);
create policy tables_write_authenticated on tables for all to authenticated using (true) with check (true);
-- ※ writeポリシーは insert/update/delete をまとめて許可（select は上のポリシーが担当）

-- ------------------------------------------------------------
-- 4) menu_items: 閲覧は誰でも、CRUD はスタッフのみ
-- ------------------------------------------------------------
drop policy if exists menu_items_select_all          on menu_items;
drop policy if exists menu_items_write_authenticated on menu_items;
create policy menu_items_select_all          on menu_items for select to anon, authenticated using (true);
create policy menu_items_write_authenticated on menu_items for all to authenticated using (true) with check (true);

-- ------------------------------------------------------------
-- 5) orders / order_items: 直接の insert は誰にも許可しない
--    （place_order RPC は owner=postgres として RLS を越えて動くため、これで塞がっても壊れない）。
--    status更新（厨房の調理中→提供済み）と明細の取消/削除はスタッフのみ。
-- ------------------------------------------------------------
drop policy if exists orders_select_all           on orders;
drop policy if exists orders_update_authenticated  on orders;
create policy orders_select_all          on orders for select to anon, authenticated using (true);
create policy orders_update_authenticated on orders for update to authenticated using (true) with check (true);

drop policy if exists order_items_select_all           on order_items;
drop policy if exists order_items_update_authenticated  on order_items;
drop policy if exists order_items_delete_authenticated  on order_items;
create policy order_items_select_all          on order_items for select to anon, authenticated using (true);
create policy order_items_update_authenticated on order_items for update to authenticated using (true) with check (true);
create policy order_items_delete_authenticated on order_items for delete to authenticated using (true);

-- ------------------------------------------------------------
-- 6) staff_calls: 客は「呼び出す」（insert）＋確認（select）のみ。
--    「対応済みにする」（update）と削除はスタッフのみ。
-- ------------------------------------------------------------
drop policy if exists staff_calls_select_all          on staff_calls;
drop policy if exists staff_calls_insert_all          on staff_calls;
drop policy if exists staff_calls_update_authenticated on staff_calls;
drop policy if exists staff_calls_delete_authenticated on staff_calls;
create policy staff_calls_select_all          on staff_calls for select to anon, authenticated using (true);
create policy staff_calls_insert_all          on staff_calls for insert to anon, authenticated with check (true);
create policy staff_calls_update_authenticated on staff_calls for update to authenticated using (true) with check (true);
create policy staff_calls_delete_authenticated on staff_calls for delete to authenticated using (true);

-- ------------------------------------------------------------
-- 7) checkouts: 会計履歴は客に見せない（スタッフのみ閲覧・作成）
-- ------------------------------------------------------------
drop policy if exists checkouts_select_authenticated on checkouts;
drop policy if exists checkouts_insert_authenticated on checkouts;
create policy checkouts_select_authenticated on checkouts for select to authenticated using (true);
create policy checkouts_insert_authenticated on checkouts for insert to authenticated with check (true);

-- ------------------------------------------------------------
-- 8) staff / table_sessions: アプリからは未使用。ポリシー無し＝全ロール完全拒否のまま維持。
-- ------------------------------------------------------------
-- (何もしない: RLSは有効のままポリシー0件が最も安全なデフォルト)

-- ------------------------------------------------------------
-- 9) RPC の実行権限（重要）:
--    place_order は submit_order Edge Function(service_role) 経由でのみ呼べるようにする。
--    → 直接 anon で rpc() 呼び出しして「客注文のふりをしたスタッフ代理注文(proxy=true)」で
--      セッション検証/レート制限をスキップする抜け道を塞ぐ。
--    open_session は読み取り専用なので客ページから直接呼んでよい。
--    close_table / regenerate_table_token はスタッフ操作なので authenticated のみ。
-- ------------------------------------------------------------
-- 注意: Supabaseは関数作成時にanon/authenticatedへEXECUTEを"直接"自動付与するため、
-- `revoke ... from public` だけでは取り消せない。anon/authenticatedからも明示的にrevokeする。
revoke execute on function place_order(uuid, uuid, boolean, text, jsonb, text) from public, anon, authenticated;
grant  execute on function place_order(uuid, uuid, boolean, text, jsonb, text) to service_role;

grant execute on function open_session(uuid, uuid, text) to anon, authenticated;

revoke execute on function close_table(uuid, uuid) from public, anon;
grant  execute on function close_table(uuid, uuid) to authenticated;

revoke execute on function regenerate_table_token(uuid, uuid) from public, anon;
grant  execute on function regenerate_table_token(uuid, uuid) to authenticated;

-- ============================================================
-- 確認用（実行後、必要なら流してみてください）:
--   select * from pg_policies where schemaname='public' order by tablename;
--   \dp tables   -- 列単位の権限確認（psqlのみ。ダッシュボードのSQL Editorでは省略可）
-- ============================================================
