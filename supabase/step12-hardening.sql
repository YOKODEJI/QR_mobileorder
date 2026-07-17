-- ============================================================
-- ステップ12 プロレビュー指摘への対応（既存DB向け・1回だけ実行）
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください。
-- 前提: supabase/step11-customer-sessions.sql 実行済み（staff_store_id()を使うため）。
-- 冪等（再実行しても安全）。
-- ============================================================

-- ------------------------------------------------------------
-- 1) staff_calls連投スパム対策: 対応済み(resolved_at)になるまで、
--    同じ卓から新しい呼び出しを作れないようにする。
--    UI側は既に「呼び出し中は再送不可」だが、直接APIを叩けば無制限に
--    insertできてしまっていた（レート制限が無かった）。place_orderの
--    10秒8件のような時間窓ではなく「未対応が1件でもあれば拒否」という
--    業務ルールそのものをDB制約に格上げする方式（時間窓より単純で正確）。
-- ------------------------------------------------------------
drop policy if exists staff_calls_insert_all on staff_calls;
create policy staff_calls_insert_all on staff_calls for insert to anon, authenticated with check (
  not exists (
    select 1 from staff_calls sc
    where sc.table_id = staff_calls.table_id and sc.resolved_at is null
  )
);

-- ------------------------------------------------------------
-- 2) 明細取消(dbCancelUnit)のアトミック化。
--    従来はクライアントが「select→(update qtyまたはdelete)→在庫update」を
--    3回の別リクエストに分けて行っており、同時操作でズレる理論上の余地があった。
--    cancel_order_item() 1回のRPC呼び出しで、行ロックを取りながら
--    トランザクション内で完結させる。store_id検証も追加（自店舗の注文のみ）。
-- ------------------------------------------------------------
create or replace function cancel_order_item(
  p_order      uuid,
  p_menu_item  uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store     uuid;
  v_row       order_items%rowtype;
  v_remaining int;
begin
  select store_id into v_store from orders where id = p_order for update;
  if v_store is null then
    raise exception 'order not found';
  end if;
  if v_store <> staff_store_id() then
    raise exception 'forbidden: store mismatch';
  end if;

  select * into v_row from order_items
    where order_id = p_order and menu_item_id = p_menu_item
    order by id limit 1
    for update;
  if not found then
    return; -- 対象なし＝既にクライアントの状態と一致（失敗ではない。従来のdbCancelUnitと同じ扱い）
  end if;

  if v_row.qty > 1 then
    update order_items set qty = qty - 1 where id = v_row.id;
  else
    delete from order_items where id = v_row.id;
    select count(*) into v_remaining from order_items where order_id = p_order;
    if v_remaining = 0 then
      delete from orders where id = p_order;
    end if;
  end if;

  update menu_items set stock = stock + 1 where id = p_menu_item and store_id = v_store;
end $$;

revoke execute on function cancel_order_item(uuid, uuid) from public, anon;
grant  execute on function cancel_order_item(uuid, uuid) to authenticated;

-- ============================================================
-- 確認用（実行後）:
--   node --env-file=.env.local scripts/test-hardening.mjs
-- ============================================================
