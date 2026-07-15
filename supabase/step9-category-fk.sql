-- ============================================================
-- ステップ9 カテゴリのFK化・リネーム対応 移行スクリプト（既存DB向け・1回だけ実行）
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください。
-- 前提: supabase/step8-categories.sql 実行済み（categoriesテーブルが存在すること）。
-- 冪等（再実行しても安全）。
-- ============================================================

-- 0) 事前チェック（任意）: FK制約が張れない不整合データが無いか確認。
--    0件でなければ、先にそのcat値のmenu_itemsをUPDATEして実在カテゴリに合わせてから本番SQLへ。
--    select m.id, m.store_id, m.cat
--    from menu_items m
--    left join categories c on c.store_id = m.store_id and c.name = m.cat
--    where c.id is null;

-- 1) 既存のunique indexをconstraintに格上げ（FK参照先として使うため。既存インデックスを再利用、再構築なし）
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'categories_store_name_key'
  ) then
    alter table categories add constraint categories_store_name_key unique using index idx_categories_store_name;
  end if;
end $$;

-- 2) menu_items.cat の既定値（安全側の保険。カテゴリ未指定時のフォールバック）
alter table menu_items alter column cat set default 'その他';

-- 3) FK制約: menu_items(store_id, cat) -> categories(store_id, name)
--    ON UPDATE CASCADE … カテゴリ名を変更(rename)すると、紐づく全メニューのcatが自動追従する
--    ON DELETE RESTRICT … カテゴリ削除は、先にmenu_itemsの再割当て(→その他)が済んでいないと拒否される
--    （アプリのdbDeleteCategoryは既に「再割当て→削除」の順で呼ぶため、通常フローでは問題にならない）
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'menu_items_cat_fkey'
  ) then
    alter table menu_items
      add constraint menu_items_cat_fkey
      foreign key (store_id, cat) references categories(store_id, name)
      on update cascade
      on delete restrict;
  end if;
end $$;

-- 確認用: カテゴリ名を変更してみて、menu_items.cat が自動追従するか確認できます
--   update categories set name = 'ドリンク類' where name = 'ドリンク';
--   select cat, count(*) from menu_items group by cat; -- 「ドリンク類」に変わっているはず
--   update categories set name = 'ドリンク' where name = 'ドリンク類'; -- 元に戻す
