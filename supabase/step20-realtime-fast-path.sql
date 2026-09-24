-- ============================================================
-- step20: 注文・呼び出しを「子機 → 親機」へ即時に届ける高速経路
-- Supabase SQL Editor で1回実行してください（何度実行しても安全）。
--
-- 実測（2026-09-24）で、端末間反映の遅延の大半は次の2つだった:
--   ・Edge Function submit_order の往復  中央値344ms / 最大1148ms（起動待ち時は更に+0.5秒）
--   ・親機の「変更の合図 → 150ms待つ → 未会計の注文を全部取り直す」
-- これを次の形に置き換える:
--   1) submit_order_direct(): place_order を直接RPCで呼べる入口（往復 約50ms）。
--      Edge Function と同じく、代理注文(proxy)は「その店舗のスタッフ本人」のときだけ有効にする。
--   2) 注文確定・呼び出し作成の直後に、DBから親機へ中身ごとBroadcastする（取り直し不要）。
--      送信はDBがコミット時に行うため、確定前の注文や偽の注文が親機に出ることはない。
--      チャンネルは private（store:<店舗id>）で、受信できるのは自店舗のスタッフだけ。
--
-- 既存の postgres_changes 購読と20秒ポーリングは安全網としてそのまま残る。
-- アプリ側は、このSQLが未実行でも従来の Edge Function 経路に自動で戻るので、
-- アプリの公開とこのSQLの実行はどちらが先でもよい。
-- ============================================================

-- ---- 1) 注文の直接RPC入口 ----
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
  -- 代理注文は「ログイン済み かつ その店舗のスタッフ」のときだけ認める
  -- （A店スタッフがstoreIdだけB店に差し替えて客の検証を飛ばす抜け道を塞ぐ。Edge Functionと同じ判定）。
  -- 客（匿名認証を含む）は staff_store_id() が null なので必ず客注文として検証される。
  v_proxy := coalesce(p_proxy, false) and coalesce(staff_store_id() = p_store, false);

  v_order := place_order(p_store, p_table, v_proxy, p_idem, p_items, p_token);

  -- 親機へ注文の中身ごと送る。送信に失敗しても注文そのものは確定させる（安全網で後から拾える）。
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
                        'options', oi.options
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

-- place_order 本体は引き続き anon/authenticated から直接は呼べない（functions.sql の revoke のまま）。
-- この入口は proxy を自前で検証してから呼ぶので、客・スタッフの両方に開放してよい。
revoke execute on function submit_order_direct(uuid, uuid, boolean, text, jsonb, text) from public;
grant  execute on function submit_order_direct(uuid, uuid, boolean, text, jsonb, text) to anon, authenticated;


-- ---- 2) スタッフ呼び出しも同じチャンネルで即時に送る ----
create or replace function broadcast_staff_call()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform realtime.send(
      jsonb_build_object('call', jsonb_build_object(
        'id', new.id,
        'table', new.table_id,
        'createdAt', new.created_at
      )),
      'call_created',
      'store:' || new.store_id::text,
      true
    );
  exception when others then
    raise warning 'broadcast_staff_call: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists staff_calls_broadcast on staff_calls;
create trigger staff_calls_broadcast
  after insert on staff_calls
  for each row execute function broadcast_staff_call();


-- ---- 3) 受信の許可: 自店舗のスタッフだけが store:<自店舗id> を受信できる ----
-- INSERT(クライアントからの送信)ポリシーは作らない＝誰も偽の注文を流し込めない。
drop policy if exists staff_receive_store_broadcasts on realtime.messages;
create policy staff_receive_store_broadcasts on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = 'store:' || (select staff_store_id())::text
  );


-- ---- 確認用（任意） ----
-- 客として呼べること（存在しない卓なので 'table not found' になれば入口は開通している）:
--   select submit_order_direct('<店舗id>', gen_random_uuid(), false, null, '[{"menuItemId":"00000000-0000-0000-0000-000000000000","qty":1}]', 'x');
