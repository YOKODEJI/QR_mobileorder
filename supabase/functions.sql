-- ============================================================
-- 注文/会計を「1トランザクション」で安全に確定するSQL関数（RPC）
-- Supabase SQL Editor で実行してください（schema.sql の後）。
-- Edge Function から service_role で呼び出す想定（docs/04 B-1/3/4）。
-- ============================================================

-- ---- 注文確定: 冪等 + 在庫の原子的減算 ----
-- p_items 形式: [{"menuItemId":"<uuid>","qty":2}, ...]
create or replace function place_order(
  p_store uuid,
  p_table uuid,
  p_proxy boolean,
  p_idem  text,
  p_items jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing uuid;
  v_order    uuid;
  v_item     jsonb;
  v_menu     menu_items%rowtype;
  v_qty      int;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'no items';
  end if;

  -- 冪等: 同じ idempotency_key の注文が既にあればそれを返す（二重送信対策）
  if p_idem is not null then
    select id into v_existing from orders where idempotency_key = p_idem;
    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  -- 在庫チェック＆減算。行ロック(for update)で同時注文を直列化しオーバーセルを防ぐ
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'qty')::int;
    select * into v_menu
      from menu_items
      where id = (v_item->>'menuItemId')::uuid and store_id = p_store
      for update;
    if not found then
      raise exception 'menu item not found: %', v_item->>'menuItemId';
    end if;
    if v_menu.sold_out or v_menu.stock < v_qty then
      raise exception 'out of stock: %', v_menu.name;
    end if;
    update menu_items set stock = stock - v_qty where id = v_menu.id;
  end loop;

  -- 注文＋明細（当時の name/price をスナップショット）
  insert into orders (store_id, table_id, status, proxy, idempotency_key)
    values (p_store, p_table, 'cooking', coalesce(p_proxy, false), p_idem)
    returning id into v_order;

  insert into order_items (order_id, menu_item_id, name, price, qty)
    select v_order, m.id, m.name, m.price, (i->>'qty')::int
    from jsonb_array_elements(p_items) as i
    join menu_items m on m.id = (i->>'menuItemId')::uuid;

  return v_order;
end $$;


-- ---- 会計確定: 履歴INSERT + 注文DELETE + 呼び出しクリア を1トランザクションで ----
create or replace function close_table(
  p_store uuid,
  p_table uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_checkout uuid;
  v_count int;
  v_total int;
  v_name  text;
  v_items jsonb;
begin
  select name into v_name from tables where id = p_table and store_id = p_store;

  -- その卓の注文明細を menu_item + price で集約
  with agg as (
    select oi.menu_item_id, oi.name, oi.price, sum(oi.qty)::int as qty
    from orders o
    join order_items oi on oi.order_id = o.id
    where o.store_id = p_store and o.table_id = p_table
    group by oi.menu_item_id, oi.name, oi.price
  )
  select
    coalesce(jsonb_agg(jsonb_build_object('menuItemId', menu_item_id, 'name', name, 'price', price, 'qty', qty)), '[]'::jsonb),
    coalesce(sum(qty), 0)::int,
    coalesce(sum(qty * price), 0)::int
  into v_items, v_count, v_total
  from agg;

  if v_count = 0 then
    return null; -- 注文が無ければ何もしない
  end if;

  insert into checkouts (store_id, table_id, table_name, items, count, total)
    values (p_store, p_table, coalesce(v_name, 'テーブル'), v_items, v_count, v_total)
    returning id into v_checkout;

  delete from orders where store_id = p_store and table_id = p_table;
  delete from staff_calls where store_id = p_store and table_id = p_table and resolved_at is null;

  return v_checkout;
end $$;
