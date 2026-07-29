-- ============================================================
-- ステップ19 Square「決済そのものをSquareで実行」方式（Point of Sale API / Mobile Web）
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください。
-- 冪等（再実行しても安全）。
--
-- 設計方針:
--   - 会計ボタン＝Square POSアプリを開いて決済させるボタン。当店側の会計確定
--     （卓を閉じる・注文をクリア）は、Square側の決済が成功で返ってきた後にだけ行う
--     （決済がキャンセル/失敗した場合、当店側は何も確定しない＝取りっぱぐれを防ぐ）。
--   - Point of Sale API（モバイルWeb版）は合計金額のみを渡す方式で、明細はSquare側に
--     渡らない。またSandboxでの動作確認をサポートしないAPIのため、実機・本番トークンでの
--     確認が必須（このファイルはアプリ側の土台のみ用意する）。
--   - 有効/方式の切替は square_enabled と同様「よこでじ」がSQL Editorから内部で行う運用。
--     店舗の設定画面には一切露出しない。
--   - client_id(=Square Application ID)はPoint of Sale APIの仕様上クライアント側の
--     URLに埋め込む値であり、そもそも公開が前提の値（access_tokenとは違い秘匿情報ではない）。
--     そのためsquare_access_tokenとは異なり、staff(authenticated)には読み取りを許可する。
-- ============================================================

alter table stores add column if not exists square_pos_mode      text; -- null(未使用) | 'mobile_web' | 'terminal'(将来)
alter table stores add column if not exists square_application_id text;

-- SELECT: staff(authenticated)には「決済連携に使う非秘匿情報」だけ追加で許可する。
-- square_access_token / square_enabled / square_environment は従来通りstaffにも非公開のまま。
revoke select on stores from authenticated;
grant select (
  id, name, theme, show_header_photo, show_footer_photo,
  header_photo_url, footer_photo_url, pwa_icon_url,
  tax_mode, tax_rate, charge_rate, created_at,
  square_pos_mode, square_application_id, square_location_id
) on stores to authenticated;

-- ============================================================
-- 会計プレビュー（確定はしない）。Square POSアプリを開く前に、現時点の未会計分から
-- 合計金額だけをサーバー計算で確定させて使う（金額の正はサーバーという既存方針を維持）。
-- close_table と同じ集計ロジックだが、INSERT/DELETE/UPDATEは一切行わない読み取り専用。
-- ============================================================
create or replace function preview_checkout(
  p_store uuid,
  p_table uuid,
  p_discount_type text,
  p_discount_value numeric,
  p_charge_enabled boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_subtotal int;
  v_items jsonb;
  v_store stores%rowtype;
  v_discount_amount int;
  v_charge_amount int;
  v_tax_amount int;
  v_total int;
begin
  if p_store <> staff_store_id() then
    raise exception 'forbidden: store mismatch';
  end if;

  select * into v_store from stores where id = p_store;

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

  return jsonb_build_object(
    'items', v_items, 'count', v_count, 'subtotal', v_subtotal,
    'discountAmount', v_discount_amount, 'chargeAmount', v_charge_amount,
    'taxAmount', v_tax_amount, 'total', v_total
  );
end;
$$;

revoke execute on function preview_checkout(uuid, uuid, text, numeric, boolean) from public, anon;
grant  execute on function preview_checkout(uuid, uuid, text, numeric, boolean) to authenticated;

-- ============================================================
-- 確認用（実行後）:
--   update stores set square_pos_mode = 'mobile_web',
--     square_application_id = 'sandbox-sq0idb-...' -- または本番のApplication ID
--   where name = 'よこでじ酒場';
--   select name, square_pos_mode, square_application_id, square_location_id from stores;
-- ============================================================
