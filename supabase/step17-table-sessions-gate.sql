-- ============================================================
-- ステップ17 卓の開閉ゲート + 未提供伝票の会計後繰越
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください。
-- 前提: supabase/step15-per-item-options.sql / step16 実行済み。
-- 冪等（再実行しても安全）。
--
-- ★適用順序: このSQLを本番に適用してから git push（コード反映）すること。
--   新コードの fetchOrders/fetchTables は checked_out_at / open_since 列を
--   selectするため、列が無いDBに対しては注文・卓の同期が失敗する。
--   逆に、列だけ先に増やしても旧コードは無害（selectしないだけ）。
--
-- 目的（焼肉安安等の業務用QR注文と同じ方式）:
--   1) 卓の開閉ゲート: 会計で卓が自動的に「閉」になり、スタッフが案内時に
--      「来店受付」で開くまで、その卓のQRからは一切注文できない。
--      印刷QRのURLは固定で、URLを知る元客と今の客をURLでは区別できないため、
--      「店側が握る開閉状態」を注文可否の判定源にする（家からのいたずら注文対策）。
--   2) 未提供繰越: 未提供(cooking)の伝票が残ったまま会計しても、その伝票は
--      削除せず checked_out_at を立てて厨房にだけ残す。提供完了で削除。
--      会計スナップショット(checkouts)には含まれる=支払い済み扱いなので、
--      後から削除しても売上記録は失われない。
-- ============================================================

-- ------------------------------------------------------------
-- 1) 列追加
-- ------------------------------------------------------------

-- 卓の開閉状態。null=閉(注文不可)、非null=開いた時刻(来店受付済み・注文可)
alter table tables add column if not exists open_since timestamptz;

-- 会計済みだが未提供の伝票に立てる（厨房にだけ表示し続けるための目印）。
-- これが非nullの伝票は、支払い済みのため以後のどの集計・表示にも含めない（厨房を除く）。
alter table orders add column if not exists checked_out_at timestamptz;

-- 客(anon/匿名authenticated)からも卓の開閉状態を読めるようにする
-- （客画面が「準備中/注文可」を判定するため。開閉状態は秘密情報ではない）。
-- tablesは列レベルGRANT方式のため、既存の許可列に open_since を足して再付与する。
revoke select on tables from anon;
grant select (id, store_id, name, sort, open_since) on tables to anon;
revoke select on tables from authenticated;
grant select (id, store_id, name, sort, open_since) on tables to authenticated;

-- ------------------------------------------------------------
-- 2) 初期値のbackfill（デプロイの瞬間に在店中の客を締め出さないため、
--    適用時点では全卓を「開」にしておく。以後は会計のたびに自動で閉じ、
--    スタッフの「来店受付」で開く運用サイクルに入る）
-- ------------------------------------------------------------
update tables set open_since = now() where open_since is null;

-- ------------------------------------------------------------
-- 3) open_table: スタッフの「来店受付」（卓を開く）
-- ------------------------------------------------------------
create or replace function open_table(
  p_store uuid,
  p_table uuid
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_since timestamptz;
begin
  if p_store <> staff_store_id() then
    raise exception 'forbidden: store mismatch';
  end if;
  update tables set open_since = now()
    where id = p_table and store_id = p_store
    returning open_since into v_since;
  if v_since is null then
    raise exception 'table not found';
  end if;
  return v_since;
end $$;

revoke execute on function open_table(uuid, uuid) from public, anon;
grant  execute on function open_table(uuid, uuid) to authenticated;

-- 誤タップで開いてしまった卓を閉じ直す（注文が無い場合のみ想定。UI側で確認を挟む）
create or replace function close_table_gate(
  p_store uuid,
  p_table uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_store <> staff_store_id() then
    raise exception 'forbidden: store mismatch';
  end if;
  update tables set open_since = null
    where id = p_table and store_id = p_store;
end $$;

revoke execute on function close_table_gate(uuid, uuid) from public, anon;
grant  execute on function close_table_gate(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- 4) open_session: 閉じている卓にはセッションを配らない
--    （会計後に「もう一度」やリロードで再取得できてしまう穴をここで塞ぐ。
--      これが家からのいたずら注文を止める本丸）
-- ------------------------------------------------------------
create or replace function open_session(
  p_store uuid,
  p_table uuid,
  p_k     text
) returns text
language plpgsql
security definer
set search_path = public, extensions  -- gen_random_bytes は extensions スキーマ
as $$
declare
  v_qr    text;
  v_sess  text;
  v_since timestamptz;
begin
  select qr_token, session_token, open_since into v_qr, v_sess, v_since
    from tables where id = p_table and store_id = p_store;
  if v_qr is null then
    raise exception 'table not found';
  end if;
  if p_k is null or p_k <> v_qr then
    raise exception 'invalid token';  -- QRの合言葉が違う（総当たり等）
  end if;
  if v_since is null then
    raise exception 'table closed';  -- 来店受付前（会計後の再アクセス含む）
  end if;

  if auth.uid() is not null then
    insert into table_sessions (store_id, table_id, user_id, token, status, opened_at, closed_at)
      values (p_store, p_table, auth.uid(), encode(gen_random_bytes(12), 'hex'), 'open', now(), null)
    on conflict (user_id) do update
      set store_id  = excluded.store_id,
          table_id  = excluded.table_id,
          token     = excluded.token,
          status    = 'open',
          opened_at = now(),
          closed_at = null;
  end if;

  return v_sess;
end $$;

grant execute on function open_session(uuid, uuid, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 5) place_order: 閉じている卓への注文を拒否（客・代理とも）
--    open_sessionのゲートを突破した既存トークン持ちへの二重防御 +
--    閉卓への代理注文で孤児伝票が生まれるのを防ぐ。
-- ------------------------------------------------------------
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

    update menu_items set stock = stock - v_qty where id = v_menu.id;
  end loop;

  -- 注文＋明細（当時の name/price/options をスナップショット）
  insert into orders (store_id, table_id, status, proxy, idempotency_key)
    values (p_store, p_table, 'cooking', coalesce(p_proxy, false), p_idem)
    returning id into v_order;

  insert into order_items (order_id, menu_item_id, name, price, qty, options)
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
      ), '[]'::jsonb)
    from jsonb_array_elements(p_items) as i
    join menu_items m on m.id = (i->>'menuItemId')::uuid and m.store_id = p_store;

  return v_order;
end $$;

revoke execute on function place_order(uuid, uuid, boolean, text, jsonb, text) from public, anon, authenticated;
grant  execute on function place_order(uuid, uuid, boolean, text, jsonb, text) to service_role;

-- ------------------------------------------------------------
-- 6) close_table: 未提供伝票は削除せず checked_out_at を立てて繰越。
--    集計対象は「未会計(checked_out_at is null)」の伝票のみ
--    （繰越分は前回の会計スナップショットに含まれ支払い済みのため、
--      含めると二重請求になる）。会計完了で卓は自動的に「閉」へ。
-- ------------------------------------------------------------
create or replace function close_table(
  p_store uuid,
  p_table uuid,
  p_discount_type text default null,
  p_discount_value numeric default 0,
  p_charge_enabled boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions  -- gen_random_bytes は extensions スキーマ
as $$
declare
  v_checkout uuid;
  v_count int;
  v_subtotal int;
  v_name  text;
  v_items jsonb;
  v_store stores%rowtype;
  v_discount_amount int;
  v_charge_amount int;
  v_tax_amount int;
  v_total int;
  v_result jsonb;
begin
  if p_store <> staff_store_id() then
    raise exception 'forbidden: store mismatch';
  end if;

  select * into v_store from stores where id = p_store;
  select name into v_name from tables where id = p_table and store_id = p_store;

  -- 未会計の明細を menu_item + price + options で集約（繰越分は含めない）
  with agg as (
    select oi.menu_item_id, oi.name, oi.price, oi.options, sum(oi.qty)::int as qty
    from orders o
    join order_items oi on oi.order_id = o.id
    where o.store_id = p_store and o.table_id = p_table
      and o.checked_out_at is null
    group by oi.menu_item_id, oi.name, oi.price, oi.options
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'menuItemId', menu_item_id, 'name', name, 'price', price, 'qty', qty, 'options', options
    )), '[]'::jsonb),
    coalesce(sum(qty), 0)::int,
    coalesce(sum(qty * (price + options_delta(options))), 0)::int
  into v_items, v_count, v_subtotal
  from agg;

  if v_count = 0 then
    return null; -- 未会計の注文が無ければ何もしない（繰越分だけの卓を含む）
  end if;

  v_discount_amount := case
    when p_discount_type = 'percent' then round(v_subtotal * greatest(0, coalesce(p_discount_value, 0)) / 100)
    when p_discount_type = 'amount'  then round(greatest(0, coalesce(p_discount_value, 0)))
    else 0
  end;
  v_discount_amount := least(v_discount_amount, v_subtotal);

  v_charge_amount := case
    when coalesce(p_charge_enabled, true)
      then round((v_subtotal - v_discount_amount) * greatest(0, coalesce(v_store.charge_rate, 0)) / 100)
    else 0
  end;

  v_tax_amount := case
    when v_store.tax_mode = 'exclusive'
      then round((v_subtotal - v_discount_amount + v_charge_amount) * greatest(0, coalesce(v_store.tax_rate, 10)) / 100)
    else 0
  end;

  v_total := v_subtotal - v_discount_amount + v_charge_amount + v_tax_amount;

  insert into checkouts (
    store_id, table_id, table_name, items, count,
    subtotal, discount_type, discount_value, discount_amount, charge_amount, tax_amount, total
  )
    values (
      p_store, p_table, coalesce(v_name, 'テーブル'), v_items, v_count,
      v_subtotal, p_discount_type, p_discount_value, v_discount_amount, v_charge_amount, v_tax_amount, v_total
    )
    returning id into v_checkout;

  select to_jsonb(c) into v_result from checkouts c where c.id = v_checkout;

  -- 提供済みの伝票は削除、未提供の伝票は checked_out_at を立てて厨房にだけ残す
  delete from orders
    where store_id = p_store and table_id = p_table
      and checked_out_at is null and status = 'served';
  update orders set checked_out_at = now()
    where store_id = p_store and table_id = p_table
      and checked_out_at is null and status = 'cooking';

  delete from staff_calls where store_id = p_store and table_id = p_table and resolved_at is null;

  -- 卓を閉じる（次の「来店受付」まで、この卓のQRからは注文不可）
  update tables
    set session_token = encode(gen_random_bytes(12), 'hex'),
        open_since = null
    where id = p_table and store_id = p_store;

  -- 退店した客の閲覧セッション(table_sessions)も失効させる
  update table_sessions set status = 'closed', closed_at = now()
    where table_id = p_table and store_id = p_store and status = 'open';

  return v_result;
end $$;

revoke execute on function close_table(uuid, uuid, text, numeric, boolean) from public, anon;
grant  execute on function close_table(uuid, uuid, text, numeric, boolean) to authenticated;

-- ------------------------------------------------------------
-- 7) finish_checked_out_order: 繰越伝票の提供完了（=厨房から消す）
--    通常の伝票削除経路(close_table/cancel_order_item)とは別に、
--    「会計済み・未提供」の伝票だけを対象にした専用の削除口を用意する。
--    在庫は戻さない（提供したのだから当然）。会計スナップショットに
--    含まれている=支払い済みのため、削除しても売上記録は失われない。
-- ------------------------------------------------------------
create or replace function finish_checked_out_order(
  p_order uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid;
  v_co    timestamptz;
begin
  select store_id, checked_out_at into v_store, v_co
    from orders where id = p_order;
  if v_store is null then
    return; -- 既に無い＝多端末競合。成功扱い
  end if;
  if v_store <> staff_store_id() then
    raise exception 'forbidden: store mismatch';
  end if;
  if v_co is null then
    raise exception 'order is not checked out'; -- 通常伝票はこの経路で消させない
  end if;
  delete from orders where id = p_order;
end $$;

revoke execute on function finish_checked_out_order(uuid) from public, anon;
grant  execute on function finish_checked_out_order(uuid) to authenticated;

-- ============================================================
-- 確認用（実行後）:
--   select name, open_since from tables;              -- 全卓 non-null（backfill済み）
--   select count(*) from orders where checked_out_at is not null;  -- 0
-- ============================================================
