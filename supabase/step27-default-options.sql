-- ============================================================
-- step27: 「どれか1つを選ぶ」オプションと、カテゴリごとの既定オプション
-- 何度実行しても安全。
--
-- 背景: オプションは「いくつでも付けられるチェック」だけだった。次の2つを足す。
--   ・「どれか1つを必ず選ぶ」組（例: 日本酒の 一合／グラス、焼酎の ロック／水割り／お湯割り）
--   ・「このカテゴリの品には必ずこのオプションを付ける」という店の決まり
--     （品数が多い・品が自動で増える店では、品ごとに手でオプションを付けていられないため）
--   組の中の名前がすべて「同じ言葉＋数字」（例: グラス0〜グラス10）なら、画面は＋−で数を合わせる形になる。
-- 変更:
--   ・menu_item_options.choice_group  同じ値を持つオプションは「どれか1つを必ず選ぶ」組（例: 量＝一合／グラス）。
--                                     空（null）は今までどおり、個別に付け外しするチェック
--   ・category_default_options        店舗の「このカテゴリの品には、このオプションを必ず付ける」という決まり
--                                     （cat が空ならすべてのカテゴリ）。画面からは触れない（SQLで管理）
--   ・apply_default_options(品id)     決まりに沿って、その品に足りないオプションを足す（既にある名前は触らない）
--   ・menu_items のトリガー           品を追加したとき・カテゴリを変えたときに自動で足す
--                                     （まとめて登録・管理画面のどこから増えても同じ）
--   ・place_order                     注文に残すオプションの順を、id順から並び順（sort）に変えただけ
-- 決まりの中身（どのカテゴリに何を付けるか）は店ごとのデータなので、このファイルには入れない。
--   例: insert into category_default_options (store_id, cat, name, choice_group, sort)
--       values ('<店舗id>', '日本酒', '一合', '量', 0), ('<店舗id>', '日本酒', 'グラス', '量', 1);
--       select apply_default_options(id) from menu_items where store_id = '<店舗id>';  -- いまある品にも付ける
-- 既定値のままなら（choice_group が空・決まりが0件）、今までの店の動きは変わらない。
-- 前提: step22 適用済み。
-- ============================================================

alter table menu_item_options add column if not exists choice_group text;

create table if not exists category_default_options (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references stores(id) on delete cascade,
  cat          text,                    -- 空（null）＝すべてのカテゴリ
  name         text not null,
  choice_group text,
  sort         int  not null default 0
);
create unique index if not exists category_default_options_key
  on category_default_options (store_id, coalesce(cat, ''), name);

alter table category_default_options enable row level security;
revoke all on category_default_options from public, anon, authenticated;


create or replace function apply_default_options(p_item uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into menu_item_options (menu_item_id, name, price_delta, sort, choice_group)
  select m.id, d.name, 0, d.sort, d.choice_group
  from menu_items m
  join category_default_options d
    on d.store_id = m.store_id and (d.cat is null or d.cat = m.cat)
  where m.id = p_item
  on conflict (menu_item_id, name) do nothing;
$$;

revoke execute on function apply_default_options(uuid) from public, anon, authenticated;


create or replace function menu_items_default_options()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform apply_default_options(new.id);
  return null;
end $$;

revoke execute on function menu_items_default_options() from public, anon, authenticated;

drop trigger if exists menu_items_default_options on menu_items;
create trigger menu_items_default_options
  after insert or update of cat on menu_items
  for each row execute function menu_items_default_options();


-- ---- place_order: オプションの順を並び順（sort）に（step22の定義から1行変えただけ） ----
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
                 order by o.sort, o.id  -- step27: 表示の順をオプションの並び順にそろえる（例: 一合・Cドリンク）
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
