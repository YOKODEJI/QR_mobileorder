-- ============================================================
-- 注文/会計を「1トランザクション」で安全に確定するSQL関数（RPC）
-- Supabase SQL Editor で実行してください（schema.sql の後）。
-- Edge Function から service_role で呼び出す想定（docs/04 B-1/3/4）。
-- ============================================================

-- ---- 注文確定: 冪等 + 在庫の原子的減算 + トークン検証 + レート制限 ----
-- p_items 形式: [{"menuItemId":"<uuid>","qty":2}, ...]
-- p_token: 客の session_token（open_session で配布）。客注文(p_proxy=false)では必須。
--          スタッフ代理注文(p_proxy=true)は認証済み経路のため検証をスキップ。
-- 旧シグネチャ(p_token 無し)を破棄してから再定義（オーバーロード回避）。
drop function if exists place_order(uuid, uuid, boolean, text, jsonb);
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
-- p_discount_type: 'percent' | 'amount' | null。割引はスタッフがその場で入力する値をそのまま渡す。
-- 税/チャージ料は stores.tax_mode / tax_rate / charge_rate から算出（クライアント改ざん不可）。
-- 計算順序: 小計 → 割引 → チャージ料 → (外税なら)消費税。lib/pricing.ts と同じ式を維持すること。
-- p_charge_enabled: チャージ料(stores.charge_rate)を今回の会計に適用するか。
--   料率自体は設定に置いたまま、会計画面でその都度オンオフできるようにするための引数。
-- 戻り値: 確定した内訳をそのままjsonbで返す（checkoutsの行そのもの）。
--   クライアントは自前で計算し直さず、この返り値をそのまま画面に表示すること
--   （金額の唯一の正＝サーバー確定値。lib/pricing.tsの計算は「確定前のプレビュー」専用）。
-- 旧シグネチャを破棄してから再定義（オーバーロード回避・戻り値の型変更も含む）。
drop function if exists close_table(uuid, uuid);
drop function if exists close_table(uuid, uuid, text, numeric);
drop function if exists close_table(uuid, uuid, text, numeric, boolean);
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
  select * into v_store from stores where id = p_store;
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

  return v_result;
end $$;


-- ---- 来店セッション開始: QRの k(=qr_token) を照合し、今の session_token を返す ----
-- 客ページ読込時に anon から rpc で呼ぶ（security definer で RLS を越えて照合）。
create or replace function open_session(
  p_store uuid,
  p_table uuid,
  p_k     text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qr   text;
  v_sess text;
begin
  select qr_token, session_token into v_qr, v_sess
    from tables where id = p_table and store_id = p_store;
  if v_qr is null then
    raise exception 'table not found';
  end if;
  if p_k is null or p_k <> v_qr then
    raise exception 'invalid token';  -- QRの合言葉が違う（総当たり等）
  end if;
  return v_sess;
end $$;


-- ---- QRトークン再発行: qr_token / session_token を作り直す（印刷QRを無効化） ----
-- 管理画面の「再発行」ボタンから rpc で呼ぶ。新しい qr_token を返す。
-- ※ ステップ5で authenticated 限定に絞る予定（現状は開発用RLSで全許可）。
create or replace function regenerate_table_token(
  p_store uuid,
  p_table uuid
) returns text
language plpgsql
security definer
set search_path = public, extensions  -- gen_random_bytes は extensions スキーマ
as $$
declare
  v_new text;
begin
  update tables
    set qr_token      = encode(gen_random_bytes(12), 'hex'),
        session_token = encode(gen_random_bytes(12), 'hex')
    where id = p_table and store_id = p_store
    returning qr_token into v_new;
  if v_new is null then
    raise exception 'table not found';
  end if;
  return v_new;
end $$;


-- ============================================================
-- 実行権限（ステップ5 RLS厳格化とセット。詳細は step5-rls.sql 参照）
--   place_order: submit_order Edge Function(service_role)経由のみ。
--     anonが直接rpc()で呼んでproxy=trueを渡すと「客注文のふりをしたスタッフ代理注文」で
--     トークン検証/レート制限をスキップできてしまうため、直接呼び出しは禁止する。
--   open_session: 読み取り専用（照合するだけ）なので客ページから直接呼んでよい。
--   close_table / regenerate_table_token: スタッフのみ（ログイン必須画面からの呼び出し）。
-- ============================================================
-- 注意: Supabaseは関数作成時にanon/authenticatedへEXECUTEを"直接"自動付与するため、
-- `revoke ... from public` だけでは取り消せない。anon/authenticatedからも明示的にrevokeする。
revoke execute on function place_order(uuid, uuid, boolean, text, jsonb, text) from public, anon, authenticated;
grant  execute on function place_order(uuid, uuid, boolean, text, jsonb, text) to service_role;

grant execute on function open_session(uuid, uuid, text) to anon, authenticated;

revoke execute on function close_table(uuid, uuid, text, numeric, boolean) from public, anon;
grant  execute on function close_table(uuid, uuid, text, numeric, boolean) to authenticated;

revoke execute on function regenerate_table_token(uuid, uuid) from public, anon;
grant  execute on function regenerate_table_token(uuid, uuid) to authenticated;
