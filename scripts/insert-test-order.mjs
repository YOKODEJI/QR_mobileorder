// リアルタイム検証用: テーブル5に注文を1件INSERT
// 実行: node --env-file=.env.local scripts/insert-test-order.mjs
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const storeId = process.env.NEXT_PUBLIC_STORE_ID;
const sb = createClient(url, key);

const { data: t } = await sb.from("tables").select("id").eq("store_id", storeId).eq("name", "テーブル 5").single();
const { data: m } = await sb.from("menu_items").select("id,name,price").eq("store_id", storeId).eq("name", "マグロ刺身").single();

const { data: order, error } = await sb
  .from("orders")
  .insert({ store_id: storeId, table_id: t.id, status: "cooking" })
  .select("id")
  .single();
if (error) { console.error(error.message); process.exit(1); }

await sb.from("order_items").insert({ order_id: order.id, menu_item_id: m.id, name: m.name, price: m.price, qty: 2 });
console.log("INSERT OK: テーブル5 / マグロ刺身 ×2 / order", order.id);
