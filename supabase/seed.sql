-- ============================================================
-- QR注文システム — デモ用シードデータ
-- schema.sql を実行した後に、SQL Editor で実行してください。
-- Zustand のローカル初期データと同じ内容（店舗「居酒屋 灯り」）。
-- 何度も実行しないでください（重複挿入されます）。
-- ============================================================

do $$
declare
  v_store uuid;
  v_beer uuid; v_high uuid; v_edamame uuid; v_caesar uuid; v_gyoza uuid;
  v_maguro uuid; v_moriawase uuid; v_karaage uuid; v_potato uuid; v_ramen uuid;
  v_t1 uuid; v_t2 uuid; v_t3 uuid; v_t4 uuid; v_t5 uuid; v_t6 uuid; v_tc uuid; v_tk uuid;
  v_o1 uuid; v_o2 uuid;
begin
  -- 店舗
  insert into stores (name, theme) values ('居酒屋 灯り', '#cf4b2c')
    returning id into v_store;

  -- 卓
  insert into tables (store_id, name, sort) values
    (v_store,'テーブル 1',1) returning id into v_t1;
  insert into tables (store_id, name, sort) values
    (v_store,'テーブル 2',2) returning id into v_t2;
  insert into tables (store_id, name, sort) values
    (v_store,'テーブル 3',3) returning id into v_t3;
  insert into tables (store_id, name, sort) values
    (v_store,'テーブル 4',4) returning id into v_t4;
  insert into tables (store_id, name, sort) values
    (v_store,'テーブル 5',5) returning id into v_t5;
  insert into tables (store_id, name, sort) values
    (v_store,'テーブル 6',6) returning id into v_t6;
  insert into tables (store_id, name, sort) values
    (v_store,'カウンター A',7) returning id into v_tc;
  insert into tables (store_id, name, sort) values
    (v_store,'個室 松',8) returning id into v_tk;

  -- カテゴリ
  insert into categories (store_id,name,sort) values
    (v_store,'ドリンク',1),
    (v_store,'一品料理',2),
    (v_store,'刺身',3),
    (v_store,'揚げ物',4),
    (v_store,'〆',5),
    (v_store,'その他',6);

  -- メニュー
  insert into menu_items (store_id,name,cat,price,sold_out,stock,sort) values
    (v_store,'生ビール','ドリンク',550,false,80,1) returning id into v_beer;
  insert into menu_items (store_id,name,cat,price,sold_out,stock,sort) values
    (v_store,'ハイボール','ドリンク',450,false,80,2) returning id into v_high;
  insert into menu_items (store_id,name,cat,price,sold_out,stock,sort) values
    (v_store,'枝豆','一品料理',380,false,40,3) returning id into v_edamame;
  insert into menu_items (store_id,name,cat,price,sold_out,stock,sort) values
    (v_store,'シーザーサラダ','一品料理',680,false,15,4) returning id into v_caesar;
  insert into menu_items (store_id,name,cat,price,sold_out,stock,sort) values
    (v_store,'餃子','一品料理',480,false,30,5) returning id into v_gyoza;
  insert into menu_items (store_id,name,cat,price,sold_out,stock,sort) values
    (v_store,'マグロ刺身','刺身',880,false,12,6) returning id into v_maguro;
  insert into menu_items (store_id,name,cat,price,sold_out,stock,sort) values
    (v_store,'本日の刺身盛り合わせ','刺身',1480,true,0,7) returning id into v_moriawase;
  insert into menu_items (store_id,name,cat,price,sold_out,stock,sort) values
    (v_store,'鶏の唐揚げ','揚げ物',580,false,25,8) returning id into v_karaage;
  insert into menu_items (store_id,name,cat,price,sold_out,stock,sort) values
    (v_store,'ポテトフライ','揚げ物',420,false,25,9) returning id into v_potato;
  insert into menu_items (store_id,name,cat,price,sold_out,stock,sort) values
    (v_store,'締めのラーメン','〆',780,false,20,10) returning id into v_ramen;

  -- サンプル注文（提供前1・提供済み1）
  insert into orders (store_id,table_id,status,created_at)
    values (v_store,v_t3,'cooking', now() - interval '18 minutes') returning id into v_o1;
  insert into order_items (order_id,menu_item_id,name,price,qty) values
    (v_o1,v_beer,'生ビール',550,2),
    (v_o1,v_edamame,'枝豆',380,1),
    (v_o1,v_karaage,'鶏の唐揚げ',580,1);

  insert into orders (store_id,table_id,status,created_at)
    values (v_store,v_tc,'served', now() - interval '6 minutes') returning id into v_o2;
  insert into order_items (order_id,menu_item_id,name,price,qty) values
    (v_o2,v_high,'ハイボール',450,1),
    (v_o2,v_gyoza,'餃子',480,2);

  -- サンプル会計履歴
  insert into checkouts (store_id,table_id,table_name,items,count,total,closed_at) values
    (v_store,v_t2,'テーブル 2',
     json_build_array(
       json_build_object('name','生ビール','price',550,'qty',3),
       json_build_object('name','鶏の唐揚げ','price',580,'qty',2),
       json_build_object('name','枝豆','price',380,'qty',1)
     ), 6, 3190, now() - interval '95 minutes'),
    (v_store,v_t6,'テーブル 6',
     json_build_array(
       json_build_object('name','ハイボール','price',450,'qty',2),
       json_build_object('name','締めのラーメン','price',780,'qty',2)
     ), 4, 2460, now() - interval '40 minutes');

  raise notice 'Seed 完了: store_id = %', v_store;
end $$;
