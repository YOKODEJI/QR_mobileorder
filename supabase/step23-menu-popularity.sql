-- ============================================================
-- step23: メニューの人気順（店全体・直近30日）
-- 何度実行しても安全。
--   ・menu_item_daily_qty  品目ごと・日ごとの注文数（注文明細が入るたびにトリガーで加算）
--                          注文は会計で消えるが、この数は残るので人気順の元にできる
--   ・menu_popularity()    自店舗の品目の直近N日（既定30日）の合計。ハンディの注文画面の並び順に使う
-- 表そのものは誰からも直接は読めない（RLS有効・ポリシー無し）。関数経由で自店舗の分だけ返す。
-- 取消（明細の−）は差し引かない（人気の目安としては誤差の範囲のため）。
-- ============================================================

create table if not exists menu_item_daily_qty (
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  day          date not null,
  qty          int  not null default 0,
  primary key (menu_item_id, day)
);
alter table menu_item_daily_qty enable row level security;
revoke all on menu_item_daily_qty from anon, authenticated;

create or replace function count_menu_item_qty()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.menu_item_id is not null and coalesce(new.qty, 0) > 0 then
    begin
      insert into menu_item_daily_qty (menu_item_id, day, qty)
        values (new.menu_item_id, (now() at time zone 'Asia/Tokyo')::date, new.qty)
        on conflict (menu_item_id, day) do update set qty = menu_item_daily_qty.qty + excluded.qty;
    exception when others then
      -- 集計に失敗しても注文そのものは必ず通す
      raise warning 'count_menu_item_qty: %', sqlerrm;
    end;
  end if;
  return new;
end $$;

drop trigger if exists order_items_count_qty on order_items;
create trigger order_items_count_qty
  after insert on order_items
  for each row execute function count_menu_item_qty();

create or replace function menu_popularity(p_days int default 30)
returns table (menu_item_id uuid, qty bigint)
language sql
stable
security definer
set search_path = public
as $$
  select d.menu_item_id, sum(d.qty)::bigint
  from menu_item_daily_qty d
  join menu_items m on m.id = d.menu_item_id
  where m.store_id = staff_store_id()
    and d.day >= (now() at time zone 'Asia/Tokyo')::date - greatest(1, least(coalesce(p_days, 30), 365))
  group by d.menu_item_id;
$$;

revoke execute on function menu_popularity(int) from public, anon;
grant  execute on function menu_popularity(int) to authenticated;
