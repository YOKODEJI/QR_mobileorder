-- ============================================================
-- ステップ13 会計履歴の全消去機能（既存DB向け・1回だけ実行）
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください。
-- 前提: supabase/step10-tenant-isolation.sql 実行済み（staff_store_id()を使うため）。
-- 冪等（再実行しても安全）。
--
-- 設定画面の奥（3回確認）から、会計履歴（checkouts）だけを全消去できるようにする。
-- 注文中のテーブル・メニュー・在庫・カテゴリ設定には一切影響しない。
-- 「何件消したか・誰が・いつ」の記録(checkout_deletion_log)だけは消去後も残す
-- （消去自体の取り消しはできないが、何が起きたかの説明責任は残す）。
-- ============================================================

create table if not exists checkout_deletion_log (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references stores(id) on delete cascade,
  deleted_count int not null,
  deleted_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

alter table checkout_deletion_log enable row level security;

-- 閲覧は自店舗スタッフのみ。挿入はRPC(SECURITY DEFINER)経由のみ＝直接insertは誰にも許可しない。
drop policy if exists checkout_deletion_log_select_authenticated on checkout_deletion_log;
create policy checkout_deletion_log_select_authenticated on checkout_deletion_log
  for select to authenticated using (store_id = staff_store_id());

-- ---- 会計履歴を全消去（自店舗分のみ）。件数を記録してから削除する。 ----
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

revoke execute on function clear_checkout_history() from public, anon;
grant  execute on function clear_checkout_history() to authenticated;

-- ============================================================
-- 確認用（実行後）:
--   select * from checkout_deletion_log order by created_at desc; -- 消去の記録
-- ============================================================
