-- ============================================================
-- step22: ハンディモード M2（docs/09-handy-mode.md）
-- 何度実行しても安全。
--   ・staff_role()        呼び出したスタッフの役割（owner / staff / kitchen）
--   ・オーナー限定        メニュー・カテゴリ・オプション・卓・店舗設定の書き込みと、会計履歴の閲覧
--                         （staff・kitchen は売切の切替(set_sold_out)と注文・提供・卓の開閉・会計だけ）
--   ・move_table()        卓移動（移動先が空席のときだけ。未会計の注文・来店時刻・呼び出しを移す）
--   ・add_menu_items()    メニューのまとめて登録（オーナーのみ。無いカテゴリは作る。同名は飛ばす）
--   ・place_order         ハンディモードの店では客の注文（proxyでない注文）を受け付けない
-- 2026-09-26時点、staff は よこでじ酒場の owner 1名のみ（オーナー限定にしても誰も締め出されない）。
-- ============================================================

create or replace function staff_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from staff where user_id = auth.uid() limit 1;
$$;

revoke execute on function staff_role() from public, anon;
grant  execute on function staff_role() to authenticated;


-- ---- オーナー限定の書き込み（既存ポリシーの条件に「owner」を足しただけ。閲覧ポリシーは別にあり変えない） ----
drop policy if exists categories_write_authenticated on categories;
create policy categories_write_authenticated on categories for all to authenticated
  using (store_id = staff_store_id() and staff_role() = 'owner')
  with check (store_id = staff_store_id() and staff_role() = 'owner');

drop policy if exists menu_items_write_authenticated on menu_items;
create policy menu_items_write_authenticated on menu_items for all to authenticated
  using (store_id = staff_store_id() and staff_role() = 'owner')
  with check (store_id = staff_store_id() and staff_role() = 'owner');

drop policy if exists menu_item_options_write_authenticated on menu_item_options;
create policy menu_item_options_write_authenticated on menu_item_options for all to authenticated
  using (staff_role() = 'owner' and exists (
    select 1 from menu_items m where m.id = menu_item_options.menu_item_id and m.store_id = staff_store_id()))
  with check (staff_role() = 'owner' and exists (
    select 1 from menu_items m where m.id = menu_item_options.menu_item_id and m.store_id = staff_store_id()));

drop policy if exists tables_write_authenticated on tables;
create policy tables_write_authenticated on tables for all to authenticated
  using (store_id = staff_store_id() and staff_role() = 'owner')
  with check (store_id = staff_store_id() and staff_role() = 'owner');

drop policy if exists stores_update_authenticated on stores;
create policy stores_update_authenticated on stores for update to authenticated
  using (id = staff_store_id() and staff_role() = 'owner')
  with check (id = staff_store_id() and staff_role() = 'owner');

-- 会計履歴（売上）はオーナーだけが見る
drop policy if exists checkouts_select_authenticated on checkouts;
create policy checkouts_select_authenticated on checkouts for select to authenticated
  using (store_id = staff_store_id() and staff_role() = 'owner');


-- ---- 卓移動 ----
create or replace function move_table(
  p_store uuid,
  p_from  uuid,
  p_to    uuid
) returns void
language plpgsql
security definer
set search_path = public, extensions  -- gen_random_bytes は extensions スキーマ
as $$
declare
  v_since    timestamptz;
  v_to_since timestamptz;
  v_busy     int;
begin
  if p_store <> staff_store_id() then
    raise exception 'forbidden: store mismatch';
  end if;
  if coalesce(staff_role(), '') not in ('owner', 'staff') then
    raise exception 'forbidden: role';
  end if;
  if p_from = p_to then
    raise exception 'same table';
  end if;

  select open_since into v_since from tables where id = p_from and store_id = p_store for update;
  if not found then
    raise exception 'table not found';
  end if;
  if v_since is null then
    raise exception 'table closed';
  end if;

  select open_since into v_to_since from tables where id = p_to and store_id = p_store for update;
  if not found then
    raise exception 'table not found';
  end if;
  select count(*) into v_busy
    from orders where store_id = p_store and table_id = p_to and checked_out_at is null;
  if v_to_since is not null or v_busy > 0 then
    raise exception 'table occupied';  -- 相席は無い運用なので、空いている卓にだけ移せる
  end if;

  -- 未会計の注文と未対応の呼び出しを移す（会計済みの繰越伝票は前のお客様の分なので動かさない）
  update orders set table_id = p_to, updated_at = now()
    where store_id = p_store and table_id = p_from and checked_out_at is null;
  update staff_calls set table_id = p_to
    where store_id = p_store and table_id = p_from and resolved_at is null;

  update tables set open_since = v_since where id = p_to;
  -- 元の卓は空席に戻す。QR注文の店でも元の卓の客セッションは失効させる
  update tables
    set open_since = null, session_token = encode(gen_random_bytes(12), 'hex')
    where id = p_from;
  update table_sessions set status = 'closed', closed_at = now()
    where store_id = p_store and table_id = p_from and status = 'open';
end $$;

revoke execute on function move_table(uuid, uuid, uuid) from public, anon;
grant  execute on function move_table(uuid, uuid, uuid) to authenticated;


-- ---- メニューのまとめて登録 ----
-- p_items: [{"cat":"焼酎","name":"富乃宝山"}, ...]（最大500件）。価格0・在庫0で作る（ハンディの店向け）。
-- 戻り値: 実際に追加した件数（同じカテゴリに同名が既にある行は飛ばす）
create or replace function add_menu_items(p_items jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store   uuid := staff_store_id();
  v_sort    int;
  v_catsort int;
  v_item    jsonb;
  v_name    text;
  v_cat     text;
  v_count   int := 0;
begin
  if v_store is null or coalesce(staff_role(), '') <> 'owner' then
    raise exception 'forbidden';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 500 then
    raise exception 'invalid items';
  end if;

  select coalesce(max(sort), -1) into v_sort from menu_items where store_id = v_store;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_name := left(btrim(coalesce(v_item->>'name', '')), 100);
    v_cat  := left(coalesce(nullif(btrim(coalesce(v_item->>'cat', '')), ''), 'その他'), 50);
    if v_name = '' then
      continue;
    end if;

    if not exists (select 1 from categories where store_id = v_store and name = v_cat) then
      select coalesce(max(sort), -1) + 1 into v_catsort
        from categories where store_id = v_store and name <> 'その他';
      insert into categories (store_id, name, sort) values (v_store, v_cat, v_catsort)
        on conflict (store_id, name) do nothing;
    end if;

    if exists (select 1 from menu_items where store_id = v_store and name = v_name and cat = v_cat) then
      continue;
    end if;

    v_sort := v_sort + 1;
    insert into menu_items (store_id, name, cat, price, stock, sold_out, sort)
      values (v_store, v_name, v_cat, 0, 0, false, v_sort);
    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

revoke execute on function add_menu_items(jsonb) from public, anon;
grant  execute on function add_menu_items(jsonb) to authenticated;


-- ---- place_order: ハンディモードの店では客の注文を受け付けない（step21の定義に1か所足しただけ） ----
create or replace function place_order(
  p_store uuid,
  p_table uuid,
  p_proxy boolean,
  p_idem  text,
  p_items jsonb,
  p_token text default null
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
  v_session  text;
  v_since    timestamptz;
  v_recent   int;
  v_optreq   int;
  v_optok    int;
  v_track    boolean;
  v_mode     text;
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

  select session_token, open_since into v_session, v_since
    from tables where id = p_table and store_id = p_store;
  if v_session is null then
    raise exception 'table not found';
  end if;
  -- 卓が閉じている（来店受付前/会計後）間は誰の注文も受けない
  if v_since is null then
    raise exception 'table closed';
  end if;

  select coalesce(track_stock, true), coalesce(order_mode, 'qr') into v_track, v_mode
    from stores where id = p_store;

  -- 客注文はセッショントークンを検証（退店客・URL総当たりを封鎖）
  if not coalesce(p_proxy, false) then
    -- ハンディモードの店はスタッフだけが注文する。客の経路は閉じておく
    if v_mode = 'handy' then
      raise exception 'table closed';
    end if;
    if p_token is null or p_token <> v_session then
      raise exception 'session expired';  -- 会計後 or 不正トークン
    end if;
    -- レート制限: 同一卓で直近10秒に8件を超える注文は拒否（イタズラ抑止）
    select count(*) into v_recent
      from orders
      where store_id = p_store and table_id = p_table
        and created_at > now() - interval '10 seconds';
    if v_recent >= 8 then
      raise exception 'too many requests';
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
    if v_menu.sold_out or (v_track and v_menu.stock < v_qty) then
      raise exception 'out of stock: %', v_menu.name;
    end if;

    -- オプション検証: 送られたIDが全て「この商品が持つオプション」であること。
    v_optreq := (
      select count(*) from jsonb_array_elements_text(coalesce(v_item->'optionIds', '[]'::jsonb))
    );
    if v_optreq > 0 then
      select count(*) into v_optok
      from menu_item_options o
      where o.menu_item_id = v_menu.id
        and o.id in (
          select x::uuid from jsonb_array_elements_text(v_item->'optionIds') as x
        );
      if v_optok <> v_optreq then
        raise exception 'invalid option for item: %', v_menu.name;
      end if;
    end if;

    if v_track then
      update menu_items set stock = stock - v_qty where id = v_menu.id;
    end if;
  end loop;

  -- 注文＋明細（当時の name/price/options をスナップショット）
  insert into orders (store_id, table_id, status, proxy, idempotency_key)
    values (p_store, p_table, 'cooking', coalesce(p_proxy, false), p_idem)
    returning id into v_order;

  insert into order_items (order_id, menu_item_id, name, price, qty, options, note)
    select
      v_order,
      m.id,
      m.name,
      m.price,
      (i->>'qty')::int,
      coalesce((
        select jsonb_agg(
                 jsonb_build_object('id', o.id, 'name', o.name, 'priceDelta', o.price_delta)
                 order by o.id
               )
        from menu_item_options o
        where o.menu_item_id = m.id
          and o.id in (
            select x::uuid from jsonb_array_elements_text(coalesce(i->'optionIds', '[]'::jsonb)) as x
          )
      ), '[]'::jsonb),
      nullif(left(btrim(coalesce(i->>'note', '')), 200), '')
    from jsonb_array_elements(p_items) as i
    join menu_items m on m.id = (i->>'menuItemId')::uuid and m.store_id = p_store;

  return v_order;
end $$;

revoke execute on function place_order(uuid, uuid, boolean, text, jsonb, text) from public, anon, authenticated;
grant  execute on function place_order(uuid, uuid, boolean, text, jsonb, text) to service_role;
