-- ============================================================
-- 注文/会計を「1トランザクション」で安全に確定するSQL関数（RPC）
-- Supabase SQL Editor で実行してください（schema.sql の後）。
-- Edge Function から service_role で呼び出す想定（docs/04 B-1/3/4）。
-- ============================================================

-- ---- オプション(step14)のヘルパー ----
-- order_items.options は [{"id","name","priceDelta"}] の形（id昇順で正規化して保存）。
-- price は本体単価のみを持ち、実売価は price + options_delta(options) で求める
-- （本体売上とオプション売上を後から分離できるようにするため）。
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
create or replace function options_key(p jsonb)
returns text
language sql
immutable
as $$
  select coalesce(string_agg(t.x, ',' order by t.x), '')
  from (select jsonb_array_elements(coalesce(p, '[]'::jsonb)) ->> 'id' as x) t;
$$;

-- ---- 注文確定: 冪等 + 在庫の原子的減算 + トークン検証 + レート制限 ----
-- p_items 形式: [{"menuItemId":"<uuid>","qty":2,"optionIds":["<uuid>",...]}, ...]
--   optionIds は任意。追加料金(price_delta)はクライアントから受け取らず必ずサーバーが
--   menu_item_options から引く。オプションは商品ごとの所有なので menu_item_id の一致で
--   「その商品が持つオプションか」を検証する（無関係な商品に値引きオプションを付ける改ざんを封じる）。
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
  -- 卓が閉じている（来店受付前/会計後）間は誰の注文も受けない(step17)
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
  if p_store <> staff_store_id() then
    raise exception 'forbidden: store mismatch';
  end if;

  select * into v_store from stores where id = p_store;
  select name into v_name from tables where id = p_table and store_id = p_store;

  -- 未会計(checked_out_at is null)の明細のみを集約(step17。繰越分は前回の会計に
  -- 含まれ支払い済みのため、含めると二重請求になる)。
  -- （「ネギ増し+50円」と「チーズ+50円」は合計額が同じでも別行として扱う）
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

  -- 提供済みの伝票は削除、未提供の伝票は checked_out_at を立てて厨房にだけ残す(step17)
  delete from orders
    where store_id = p_store and table_id = p_table
      and checked_out_at is null and status = 'served';
  update orders set checked_out_at = now()
    where store_id = p_store and table_id = p_table
      and checked_out_at is null and status = 'cooking';

  delete from staff_calls where store_id = p_store and table_id = p_table and resolved_at is null;

  -- 退店の合図。session_tokenを更新し、卓を閉じる（次の「来店受付」まで注文不可）
  update tables
    set session_token = encode(gen_random_bytes(12), 'hex'),
        open_since = null
    where id = p_table and store_id = p_store;

  -- 退店した客の閲覧セッション(table_sessions)も失効させる
  update table_sessions set status = 'closed', closed_at = now()
    where table_id = p_table and store_id = p_store and status = 'open';

  return v_result;
end $$;


-- ---- 来店セッション開始: QRの k(=qr_token) を照合し、今の session_token を返す ----
-- 客ページ読込時に anon/匿名認証済みauthenticated から rpc で呼ぶ
-- （security definer で RLS を越えて照合）。匿名認証済み(auth.uid()あり)なら
-- table_sessionsにも upsert し、has_table_session()経由でのRLS判定に使う。
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
    raise exception 'table closed';  -- 来店受付前（会計後の再アクセス含む。step17）
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
  if p_store <> staff_store_id() then
    raise exception 'forbidden: store mismatch';
  end if;

  update tables
    set qr_token      = encode(gen_random_bytes(12), 'hex'),
        session_token = encode(gen_random_bytes(12), 'hex')
    where id = p_table and store_id = p_store
    returning qr_token into v_new;
  if v_new is null then
    raise exception 'table not found';
  end if;

  -- 旧QRで開いていた客の閲覧セッションも失効させる
  update table_sessions set status = 'closed', closed_at = now()
    where table_id = p_table and store_id = p_store and status = 'open';

  return v_new;
end $$;


-- ---- 明細取消(dbCancelUnit)のアトミック化 ----
-- 従来はクライアントが「select→(update qtyまたはdelete)→在庫update」を3回の別
-- リクエストに分けて行っており、同時操作でズレる理論上の余地があった。1回のRPC
-- 呼び出しで、行ロックを取りながらトランザクション内で完結させる。
-- p_options: 取消対象のオプション組み合わせ(step14)。「ラーメン(ネギ増し)」と
--   「ラーメン(大盛り)」が同居しても、どちらを消すか一意に決まるようにする。
-- 旧2引数版は残すと「デフォルト引数付き3引数版」と曖昧になるため必ず破棄する。
drop function if exists cancel_order_item(uuid, uuid);
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


-- ---- 会計履歴の全消去（自店舗分のみ）。件数を記録してから削除する ----
-- 設定画面の奥（3回確認）からのみ呼ばれる想定。取り消せない操作の代わりに、
-- 「何件・誰が・いつ消したか」をcheckout_deletion_logへ必ず記録する。
create or replace function clear_checkout_history()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid;
  v_count int;
begin
  v_store := staff_store_id();
  if v_store is null then
    raise exception 'forbidden: not staff';
  end if;

  select count(*) into v_count from checkouts where store_id = v_store;

  insert into checkout_deletion_log (store_id, deleted_count, deleted_by)
    values (v_store, v_count, auth.uid());

  delete from checkouts where store_id = v_store;

  return v_count;
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

revoke execute on function cancel_order_item(uuid, uuid, jsonb) from public, anon;
grant  execute on function cancel_order_item(uuid, uuid, jsonb) to authenticated;


-- ---- 来店受付: 卓を開く（step17。案内時にスタッフが1タップ） ----
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

-- ---- 誤タップで開いた卓を閉じ直す（step17。UI側で確認を挟む） ----
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

-- ---- 繰越伝票の提供完了（step17。厨房から消す。在庫は戻さない） ----
-- 会計スナップショットに含まれる=支払い済みのため、削除しても売上記録は失われない。
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

revoke execute on function clear_checkout_history() from public, anon;
grant  execute on function clear_checkout_history() to authenticated;
