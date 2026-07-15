-- ============================================================
-- ステップ7 税・割引・チャージ料 移行スクリプト（既存DB向け・1回だけ実行）
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください。
-- 実行後、必ず supabase/functions.sql も再実行してください
--   （close_table に割引引数を追加＋税/チャージ料の計算を追加済み、
--    シグネチャが変わったため旧関数をdropしてから再作成する必要があります）。
-- 冪等（再実行しても安全）。
-- ============================================================

-- 1) stores: 内税/外税・消費税率・チャージ料率
alter table stores add column if not exists tax_mode    text;
alter table stores add column if not exists tax_rate    numeric;
alter table stores add column if not exists charge_rate numeric;

update stores set tax_mode = 'inclusive' where tax_mode is null;
update stores set tax_rate = 10 where tax_rate is null;
update stores set charge_rate = 0 where charge_rate is null;

alter table stores alter column tax_mode    set not null;
alter table stores alter column tax_rate    set not null;
alter table stores alter column charge_rate set not null;
alter table stores alter column tax_mode    set default 'inclusive';
alter table stores alter column tax_rate    set default 10;
alter table stores alter column charge_rate set default 0;

-- 2) checkouts: 小計/割引/チャージ料/税の内訳
alter table checkouts add column if not exists subtotal        int;
alter table checkouts add column if not exists discount_type   text;
alter table checkouts add column if not exists discount_value  numeric;
alter table checkouts add column if not exists discount_amount int;
alter table checkouts add column if not exists charge_amount   int;
alter table checkouts add column if not exists tax_amount      int;

-- 既存の会計記録は「割引/チャージ料/税」という概念が無かったため、
-- 小計=合計、その他の内訳は0として補完する。
update checkouts set subtotal = total where subtotal is null;
update checkouts set discount_amount = 0 where discount_amount is null;
update checkouts set charge_amount = 0 where charge_amount is null;
update checkouts set tax_amount = 0 where tax_amount is null;

alter table checkouts alter column subtotal        set not null;
alter table checkouts alter column discount_amount set not null;
alter table checkouts alter column charge_amount   set not null;
alter table checkouts alter column tax_amount      set not null;
alter table checkouts alter column subtotal        set default 0;
alter table checkouts alter column discount_amount set default 0;
alter table checkouts alter column charge_amount   set default 0;
alter table checkouts alter column tax_amount      set default 0;

-- 確認用: select tax_mode, tax_rate, charge_rate from stores;
--        select subtotal, discount_type, discount_amount, charge_amount, tax_amount, total from checkouts limit 5;
