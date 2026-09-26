-- ============================================================
-- step21: ハンディモード M1（docs/09-handy-mode.md）
-- 何度実行しても安全。既定値のままなら既存の店（QR注文）の動きは変わらない。
--   ・stores.order_mode   'qr'(既定) / 'handy'。よこでじがSQLで設定する（店のスタッフの画面には出さない）
--   ・stores.track_stock  true(既定)。false の店では place_order が在庫数を見ない・減らさない（売切だけ効く）
--   ・orders.created_by   注文を取った人（auth.uid()）
--   ・order_items.note    備考（列は schema.sql に既存・未使用だったものを使う）
--   ・set_sold_out()      厨房画面からの売切の切替（sold_out 列だけを書き換える専用の入口）
-- ============================================================

alter table stores add column if not exists order_mode text not null default 'qr';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'stores_order_mode_check') then
    alter table stores add constraint stores_order_mode_check check (order_mode in ('qr', 'handy'));
  end if;
end $$;
alter table stores add column if not exists track_stock boolean not null default true;

-- stores は列単位で読み取りを許可している（schema.sql / step18 / step19）。新しい列も同様に許可する。
-- 更新の許可は付けない（切替はよこでじの運用で行う）。
grant select (order_mode, track_stock) on stores to anon, authenticated;

alter table orders add column if not exists created_by uuid default auth.uid();
alter table order_items add column if not exists note text;


-- ---- place_order: 在庫を数えない店への対応 + 備考 ----
-- 2026-09-26時点の本番定義（step17版）をそのまま土台にし、次の2点だけ変えた:
--   1) stores.track_stock = false の店は、在庫数の確認と減算をしない（sold_out は従来どおり拒否）
--   2) 明細の note（備考）を保存する（前後の空白を除き200文字まで。空なら null）
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

  -- 客注文はセッショントークンを検証（退店客・URL総当たりを封鎖）
  if not coalesce(p_proxy, false) then
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

  select coalesce(track_stock, true) into v_track from stores where id = p_store;

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


-- ---- submit_order_direct: 親機へのBroadcastに備考も載せる（step20の定義に note を足しただけ） ----
create or replace function submit_order_direct(
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
  v_proxy   boolean;
  v_order   uuid;
  v_payload jsonb;
begin
  v_proxy := coalesce(p_proxy, false) and coalesce(staff_store_id() = p_store, false);

  v_order := place_order(p_store, p_table, v_proxy, p_idem, p_items, p_token);

  begin
    select jsonb_build_object(
             'id', o.id,
             'table', o.table_id,
             'createdAt', o.created_at,
             'status', o.status,
             'proxy', o.proxy,
             'checkedOutAt', o.checked_out_at,
             'items', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'menuItemId', oi.menu_item_id,
                        'name', oi.name,
                        'price', oi.price,
                        'qty', oi.qty,
                        'options', oi.options,
                        'note', oi.note
                      ) order by oi.id)
               from order_items oi where oi.order_id = o.id
             ), '[]'::jsonb)
           )
      into v_payload
      from orders o where o.id = v_order;

    perform realtime.send(
      jsonb_build_object('order', v_payload),
      'order_created',
      'store:' || p_store::text,
      true
    );
  exception when others then
    raise warning 'submit_order_direct: broadcast failed: %', sqlerrm;
  end;

  return v_order;
end $$;

revoke execute on function submit_order_direct(uuid, uuid, boolean, text, jsonb, text) from public;
grant  execute on function submit_order_direct(uuid, uuid, boolean, text, jsonb, text) to anon, authenticated;


-- ---- 売切の切替（厨房画面から）: 自店舗の品目の sold_out 列だけを書き換える ----
create or replace function set_sold_out(
  p_item     uuid,
  p_sold_out boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update menu_items set sold_out = coalesce(p_sold_out, false)
    where id = p_item and store_id = staff_store_id();
  if not found then
    raise exception 'forbidden or not found';
  end if;
end $$;

revoke execute on function set_sold_out(uuid, boolean) from public, anon;
grant  execute on function set_sold_out(uuid, boolean) to authenticated;
