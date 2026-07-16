-- ============================================================
-- ステップ11 客(anon)の店舗間/卓間読み取り分離（Supabase Anonymous Auth）移行スクリプト
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください。
-- 前提: supabase/step10-tenant-isolation.sql 実行済み（staff_store_id()を使うため）。
-- 冪等（再実行しても安全）。
--
-- ⚠ 事前準備（ダッシュボード操作・1回だけ）:
--   Authentication → Sign In / Providers → 「Allow anonymous sign-ins」を有効化。
--   これをやらないと客の signInAnonymously() が失敗し、注文はできるが
--   （place_orderはtoken方式のまま無関係）自分の注文状況の閲覧ができなくなる。
--
-- 背景: docs/07-tenant-isolation.md で「客(anon)は検証可能な身元を持たないため
-- RLSだけでは店舗間/卓間を絞れない」と結論した。Supabase Anonymous Auth で客にも
-- 実 auth.uid() を発行し、table_sessions(user_id↔table_id) で紐付けることで、
-- スタッフ(staff_store_id())と全く同じ設計原則で客も分離する。
-- ============================================================

-- ------------------------------------------------------------
-- 1) table_sessions: user_id 列を追加（1匿名ユーザーにつき現在の卓1つ）
--    もともと「M2後半で本格利用」として用意されていた未使用テーブルの本来の使い道。
-- ------------------------------------------------------------
alter table table_sessions add column if not exists user_id uuid references auth.users(id) on delete cascade;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'table_sessions_user_id_key'
  ) then
    alter table table_sessions add constraint table_sessions_user_id_key unique (user_id);
  end if;
end $$;

-- ------------------------------------------------------------
-- 2) has_table_session(p_table): 呼び出しユーザー(auth.uid())が今その卓の
--    有効な閲覧セッションを持っているか。orders/order_items/staff_callsの
--    客向けRLSの判定源。table_sessionsはポリシー0件のままなので、
--    SECURITY DEFINERでそれを乗り越えて自分の行だけ見る。
-- ------------------------------------------------------------
create or replace function has_table_session(p_table uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from table_sessions
    where table_id = p_table and user_id = auth.uid() and status = 'open'
  );
$$;
revoke execute on function has_table_session(uuid) from public, anon;
grant  execute on function has_table_session(uuid) to authenticated;

-- ------------------------------------------------------------
-- 3) open_session を拡張: qr_token照合成功時、匿名認証済みなら
--    table_sessions に upsert（既存セッションがあれば卓を今回のものに更新）。
--    gen_random_bytes を使うため search_path に extensions を追加。
-- ------------------------------------------------------------
create or replace function open_session(
  p_store uuid,
  p_table uuid,
  p_k     text
) returns text
language plpgsql
security definer
set search_path = public, extensions
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
    raise exception 'invalid token';
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

-- ------------------------------------------------------------
-- 4) close_table / regenerate_table_token: その卓の有効な客セッションを失効させる。
--    退店(会計)・QR再発行のいずれも「もうこの客はこの卓を見る資格がない」タイミング。
-- ------------------------------------------------------------
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
set search_path = public, extensions
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
    return null;
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

  update tables set session_token = encode(gen_random_bytes(12), 'hex')
    where id = p_table and store_id = p_store;

  update table_sessions set status = 'closed', closed_at = now()
    where table_id = p_table and store_id = p_store and status = 'open';

  return v_result;
end $$;

create or replace function regenerate_table_token(
  p_store uuid,
  p_table uuid
) returns text
language plpgsql
security definer
set search_path = public, extensions
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

  update table_sessions set status = 'closed', closed_at = now()
    where table_id = p_table and store_id = p_store and status = 'open';

  return v_new;
end $$;

grant execute on function open_session(uuid, uuid, text) to anon, authenticated;
revoke execute on function close_table(uuid, uuid, text, numeric, boolean) from public, anon;
grant  execute on function close_table(uuid, uuid, text, numeric, boolean) to authenticated;
revoke execute on function regenerate_table_token(uuid, uuid) from public, anon;
grant  execute on function regenerate_table_token(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- 5) tables.qr_token / session_token: authenticated からも列アクセスを禁止し、
--    スタッフのQR画面は fetch_table_tokens() RPC 経由に一本化する。
--    理由: authenticatedロールは「本物のスタッフ」と「匿名認証した客」の両方が
--    使うため、列単位のGRANTでは両者を区別できない。列を封鎖し、
--    スタッフ向けのアクセスだけRPC（staff_store_id()で自店舗に限定）に切り出す。
-- ------------------------------------------------------------
revoke select on tables from authenticated;
grant select (id, store_id, name, sort) on tables to authenticated;

create or replace function fetch_table_tokens()
returns table(id uuid, qr_token text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.qr_token from tables t where t.store_id = staff_store_id();
$$;
revoke execute on function fetch_table_tokens() from public, anon;
grant  execute on function fetch_table_tokens() to authenticated;

-- ------------------------------------------------------------
-- 6) customer_store_id(): 匿名認証済みの客が今どの店舗のセッション中かを返す
--    （将来、店舗ごとに絞りたい箇所が増えたときの共通判定源として用意）。
-- ------------------------------------------------------------
create or replace function customer_store_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select store_id from table_sessions where user_id = auth.uid() and status = 'open' limit 1;
$$;
revoke execute on function customer_store_id() from public, anon;
grant  execute on function customer_store_id() to authenticated;

-- ------------------------------------------------------------
-- 7) RLSポリシー: orders/order_items/staff_calls の anon向け using(true) を撤去。
--    匿名認証した客(authenticated ロール、is_anonymous=true)を has_table_session()
--    で自卓のみに限定する新ポリシーに置き換える。
-- ------------------------------------------------------------
drop policy if exists orders_select_anon on orders;
create policy orders_select_customer on orders for select to authenticated using (has_table_session(table_id));

drop policy if exists order_items_select_anon on order_items;
create policy order_items_select_customer on order_items for select to authenticated using (
  exists (select 1 from orders o where o.id = order_items.order_id and has_table_session(o.table_id))
);

drop policy if exists staff_calls_select_anon on staff_calls;
create policy staff_calls_select_customer on staff_calls for select to authenticated using (has_table_session(table_id));
-- staff_calls_insert_all（呼び出し）は anon, authenticated 両方のまま変更なし
-- （匿名認証が万一失敗しても「スタッフを呼ぶ」ボタンだけは動くようにする安全側のフォールバック）。

-- ------------------------------------------------------------
-- 8) stores/categories/tables/menu_items: 匿名認証した客(authenticatedロール)向けに
--    公開閲覧ポリシーを追加。既存の anon向け using(true) はそのまま残す
--    （signInAnonymously失敗時のフォールバック。この4テーブルは印刷メニューと
--    同程度の公開情報のため店舗間分離は見送り済み＝docs/07参照）。
-- ------------------------------------------------------------
create policy stores_select_customer on stores for select to authenticated
  using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false));
create policy categories_select_customer on categories for select to authenticated
  using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false));
create policy tables_select_customer on tables for select to authenticated
  using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false));
create policy menu_items_select_customer on menu_items for select to authenticated
  using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false));

-- ============================================================
-- 確認用（デプロイ後）:
--   select id, user_id, table_id, status from table_sessions order by opened_at desc limit 5;
--   実際の動作確認は node --env-file=.env.local scripts/test-customer-session.mjs
-- ============================================================
