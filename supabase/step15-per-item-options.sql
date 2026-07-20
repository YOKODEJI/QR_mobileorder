-- ============================================================
-- ステップ15 商品オプションを「商品ごとの個別設定」に変更
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください。
-- 前提: supabase/step14-menu-options.sql 実行済み。
-- 冪等（再実行しても安全）。
--
-- なぜ作り直すか:
--   step14は「店舗共通の候補リスト(menu_options)を作って商品に割り当てる」方式だったが、
--   ユーザー要望により「商品ごとに個別に設定する」方式へ変更する。
--   共通リスト方式では name に unique(store_id, name) を張っていたため、
--   「ラーメンの大盛り +100円」と「カレーの大盛り +200円」を**同時に持てなかった**。
--   商品ごとに持たせることでこれが解決する（代わりに、同じ選択肢を複数商品で使う場合は
--   商品ごとに入力し直す必要がある＝設定の手間とのトレードオフ）。
--
-- 既存注文への影響:
--   order_items.options は [{id,name,priceDelta}] を焼き付けたスナップショットで、
--   menu_options を参照(JOIN)している箇所は無い。よって進行中の注文の表示・金額・
--   取消（options同士の突合）は、候補テーブルを作り替えても影響を受けない。
-- ============================================================

-- ------------------------------------------------------------
-- 1) 旧構成を破棄して作り直す
--    menu_item_options は step14 では「中間テーブル」だったが、
--    ここでは「商品が持つオプションそのもの」になる（列構成が別物）。
-- ------------------------------------------------------------
drop table if exists menu_item_options;
drop table if exists menu_options;

create table if not exists menu_item_options (
  id           uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  name         text not null,
  price_delta  int  not null default 0,  -- 追加料金（円）。0円やマイナス（値引き）も可
  sort         int  not null default 0,
  constraint menu_item_options_item_name_key unique (menu_item_id, name)
);

create index if not exists idx_menu_item_options_item on menu_item_options(menu_item_id, sort);

-- ------------------------------------------------------------
-- 2) ヘルパー関数は step14 のまま（options jsonb の形は変えていない）
--    再実行時のために再定義しておく。
-- ------------------------------------------------------------
create or replace function options_delta(p jsonb)
returns int
language sql
immutable
as $$
  select coalesce(sum((t.x ->> 'priceDelta')::int), 0)::int
  from (select jsonb_array_elements(coalesce(p, '[]'::jsonb)) as x) t;
$$;

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
--    store_id 列を持たないため、親(menu_items)の店舗で判定する。
-- ------------------------------------------------------------
alter table menu_item_options enable row level security;

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
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'menu_item_options'
  ) then
    alter publication supabase_realtime add table menu_item_options;
  end if;
end $$;

-- ------------------------------------------------------------
-- 4) place_order: オプション検証を「その商品が持つオプションか」に変更
--    商品ごとの所有になったので、menu_item_id の一致だけで検証できる
--    （親の商品は既に store_id を検証済みなので、店舗チェックも自動的に効く）。
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

    -- オプション検証: 送られたIDが全て「この商品が持つオプション」であること。
    -- 1つでも不正/重複があれば注文ごと拒否する（黙って落とすと厨房が違う物を作るため）。
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
      m.price,                       -- 本体単価のみ（オプション料金は options 側に持つ）
      (i->>'qty')::int,
      coalesce((
        -- id昇順で正規化して保存（順序違いで別行に見えるのを防ぐ）
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

-- ============================================================
-- 確認用（実行後）:
--   select * from menu_item_options;   -- 空でOK（UIから追加する）
--   -- cancel_order_item / close_table は step14 のままで変更不要
--   --（どちらも order_items.options のスナップショットだけを見ており、候補テーブルを参照しない）
-- ============================================================
