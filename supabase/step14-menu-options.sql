-- ============================================================
-- ステップ14 商品オプション（トッピング等）
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください。
-- 前提: supabase/step12-hardening.sql 実行済み（staff_store_id() / cancel_order_item を使うため）。
-- 冪等（再実行しても安全）。
--
-- 設計方針:
--   1) オプション候補は「店舗共通のリスト(menu_options)」で持ち、
--      どの商品に出すかを menu_item_options で紐付ける（多対多）。
--      同じ「大盛り +100円」を複数商品で使い回せる。
--   2) 価格はクライアントを一切信用しない。客/店員が送るのは optionIds だけで、
--      追加料金(price_delta)は必ずサーバーが menu_options から引く。
--      さらに「そのオプションが本当にその商品に紐付いているか」も検証する
--      （無関係な商品に -1000円 のオプションを付ける改ざんを封じる）。
--   3) order_items.price は「商品本体の単価」のまま据え置く。
--      オプションの追加料金は order_items.options のスナップショットに持ち、
--      表示・集計側で price + ΣpriceDelta を計算する。
--      → 品目別売上ランキング等で「本体売上」と「オプション売上」を分離できる。
-- ============================================================

-- ------------------------------------------------------------
-- 1) テーブル
-- ------------------------------------------------------------

-- 店舗共通のオプション候補（例: 「大盛り」+100円 / 「ネギ抜き」0円）
create table if not exists menu_options (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references stores(id) on delete cascade,
  name        text not null,
  price_delta int  not null default 0,  -- 追加料金（円）。0円やマイナス（値引き）も可
  sort        int  not null default 0,
  constraint menu_options_store_name_key unique (store_id, name)
);

-- どの商品にどのオプションを出すか（多対多）
create table if not exists menu_item_options (
  menu_item_id uuid not null references menu_items(id)   on delete cascade,
  option_id    uuid not null references menu_options(id) on delete cascade,
  primary key (menu_item_id, option_id)
);

create index if not exists idx_menu_options_store on menu_options(store_id, sort);
create index if not exists idx_menu_item_options_item on menu_item_options(menu_item_id);

-- ------------------------------------------------------------
-- 2) ヘルパー関数
--    options jsonb は [{"id":..., "name":..., "priceDelta":...}, ...] の形。
-- ------------------------------------------------------------

-- 選択オプションの追加料金合計。明細行の実売価は price + options_delta(options)。
create or replace function options_delta(p jsonb)
returns int
language sql
immutable
as $$
  select coalesce(sum((t.x ->> 'priceDelta')::int), 0)::int
  from (select jsonb_array_elements(coalesce(p, '[]'::jsonb)) as x) t;
$$;

-- 選択オプションの正規化キー（id昇順のカンマ連結）。
-- 「同じ組み合わせを違う順で選んだだけ」を同一視するための比較用。
-- 明細の集約(close_table)と、取消対象の特定(cancel_order_item)で使う。
create or replace function options_key(p jsonb)
returns text
language sql
immutable
as $$
  select coalesce(string_agg(t.x, ',' order by t.x), '')
  from (select jsonb_array_elements(coalesce(p, '[]'::jsonb)) ->> 'id' as x) t;
$$;

-- ------------------------------------------------------------
-- 3) RLS（menu_items と同じ扱い: 閲覧は誰でも、CRUDは自店舗スタッフのみ）
--    メニューの選択肢は印刷メニューと同程度の公開情報のため、
--    店舗間の閲覧分離は menu_items と揃えて見送る。
-- ------------------------------------------------------------
alter table menu_options      enable row level security;
alter table menu_item_options enable row level security;

drop policy if exists menu_options_select_anon          on menu_options;
drop policy if exists menu_options_select_authenticated on menu_options;
drop policy if exists menu_options_select_customer      on menu_options;
drop policy if exists menu_options_write_authenticated  on menu_options;

create policy menu_options_select_anon          on menu_options for select to anon using (true);
create policy menu_options_select_authenticated on menu_options for select to authenticated
  using (store_id = staff_store_id());
create policy menu_options_select_customer      on menu_options for select to authenticated
  using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false));
create policy menu_options_write_authenticated  on menu_options for all to authenticated
  using (store_id = staff_store_id()) with check (store_id = staff_store_id());

-- 中間テーブルは store_id を持たないため、親(menu_items)の店舗で判定する。
drop policy if exists menu_item_options_select_anon          on menu_item_options;
drop policy if exists menu_item_options_select_authenticated on menu_item_options;
drop policy if exists menu_item_options_select_customer      on menu_item_options;
drop policy if exists menu_item_options_write_authenticated  on menu_item_options;

create policy menu_item_options_select_anon on menu_item_options for select to anon using (true);
create policy menu_item_options_select_authenticated on menu_item_options for select to authenticated
  using (exists (select 1 from menu_items m where m.id = menu_item_id and m.store_id = staff_store_id()));
create policy menu_item_options_select_customer on menu_item_options for select to authenticated
  using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false));
create policy menu_item_options_write_authenticated on menu_item_options for all to authenticated
  using (exists (select 1 from menu_items m where m.id = menu_item_id and m.store_id = staff_store_id()))
  with check (exists (select 1 from menu_items m where m.id = menu_item_id and m.store_id = staff_store_id()));

-- Realtime（管理画面での変更を客画面へ即反映）
do $$
declare t text;
begin
  foreach t in array array['menu_options','menu_item_options']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I;', t);
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 4) place_order: optionIds の検証とスナップショット
--    p_items の各要素は {"menuItemId": uuid, "qty": int, "optionIds": [uuid,...]}。
--    optionIds は任意（無ければ従来通り）。
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

  -- 客注文はセッショントークンを検証（退店客・URL総当たりを封鎖）
  if not coalesce(p_proxy, false) then
    select session_token into v_session
      from tables where id = p_table and store_id = p_store;
    if v_session is null then
      raise exception 'table not found';
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
    if v_menu.sold_out or v_menu.stock < v_qty then
      raise exception 'out of stock: %', v_menu.name;
    end if;

    -- オプション検証: 送られたIDが全て「自店舗のもの」かつ「この商品に紐付いている」こと。
    -- 1つでも不正/重複があれば注文ごと拒否する（黙って落とすと厨房が違う物を作るため）。
    v_optreq := (
      select count(*) from jsonb_array_elements_text(coalesce(v_item->'optionIds', '[]'::jsonb))
    );
    if v_optreq > 0 then
      select count(*) into v_optok
      from menu_options o
      join menu_item_options mio
        on mio.option_id = o.id and mio.menu_item_id = v_menu.id
      where o.store_id = p_store
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
      m.price,                       -- 本体単価のみ（オプション料金は options 側に持つ）
      (i->>'qty')::int,
      coalesce((
        -- id昇順で正規化して保存（順序違いで別行に見えるのを防ぐ）
        select jsonb_agg(
                 jsonb_build_object('id', o.id, 'name', o.name, 'priceDelta', o.price_delta)
                 order by o.id
               )
        from menu_options o
        where o.store_id = p_store
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
-- 5) cancel_order_item: オプション違いを区別して取り消す
--    「ラーメン(ネギ増し)」と「ラーメン(大盛り)」が同居しても、
--    どちらを消すか一意に決まるよう p_options で対象を絞る。
--    旧2引数版は残すと「デフォルト引数付き3引数版」と曖昧になるため必ず破棄する。
-- ------------------------------------------------------------
drop function if exists cancel_order_item(uuid, uuid);
drop function if exists cancel_order_item(uuid, uuid, jsonb);
create or replace function cancel_order_item(
  p_order      uuid,
  p_menu_item  uuid,
  p_options    jsonb default '[]'::jsonb
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
    where order_id = p_order
      and menu_item_id = p_menu_item
      and options_key(options) = options_key(p_options)
    order by id limit 1
    for update;
  if not found then
    return; -- 対象なし＝既にクライアントの状態と一致（失敗ではない）
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

revoke execute on function cancel_order_item(uuid, uuid, jsonb) from public, anon;
grant  execute on function cancel_order_item(uuid, uuid, jsonb) to authenticated;

-- ------------------------------------------------------------
-- 6) close_table: 小計をオプション込みで計算する
--    集約キーに options を含める（「ネギ増し+50円」と「チーズ+50円」は
--    合計額が同じでも別行として扱う必要がある）。
--    それ以外（割引/チャージ/税の計算順序、セッション失効）は従来のまま。
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

  -- その卓の注文明細を menu_item + price + options で集約
  with agg as (
    select oi.menu_item_id, oi.name, oi.price, oi.options, sum(oi.qty)::int as qty
    from orders o
    join order_items oi on oi.order_id = o.id
    where o.store_id = p_store and o.table_id = p_table
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
    return null; -- 注文が無ければ何もしない
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

  delete from orders where store_id = p_store and table_id = p_table;
  delete from staff_calls where store_id = p_store and table_id = p_table and resolved_at is null;

  -- 退店の合図。session_token を更新し、この席の旧トークンでの再注文を無効化する
  update tables set session_token = encode(gen_random_bytes(12), 'hex')
    where id = p_table and store_id = p_store;

  -- 退店した客の閲覧セッション(table_sessions)も失効させる
  update table_sessions set status = 'closed', closed_at = now()
    where table_id = p_table and store_id = p_store and status = 'open';

  return v_result;
end $$;

revoke execute on function close_table(uuid, uuid, text, numeric, boolean) from public, anon;
grant  execute on function close_table(uuid, uuid, text, numeric, boolean) to authenticated;

-- ============================================================
-- 確認用（実行後）:
--   select * from menu_options;             -- 空でOK（UIから追加する）
--   select options_delta('[{"priceDelta":100},{"priceDelta":50}]'::jsonb);  -- 150
--   select options_key('[{"id":"b"},{"id":"a"}]'::jsonb);                   -- a,b
-- ============================================================
