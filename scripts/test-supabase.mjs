// 接続確認スクリプト（anonキーでシードデータが読めるか）
// 実行: node --env-file=.env.local scripts/test-supabase.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const storeId = process.env.NEXT_PUBLIC_STORE_ID;

if (!url || !key || !storeId) {
  console.error("環境変数が未設定です (URL/ANON_KEY/STORE_ID)");
  process.exit(1);
}

const supabase = createClient(url, key);

const { data: menu, error: menuErr } = await supabase
  .from("menu_items")
  .select("name, price, cat, sold_out, stock")
  .eq("store_id", storeId)
  .order("sort");

const { count: orderCount } = await supabase
  .from("orders")
  .select("*", { count: "exact", head: true })
  .eq("store_id", storeId);

const { count: tableCount } = await supabase
  .from("tables")
  .select("*", { count: "exact", head: true })
  .eq("store_id", storeId);

if (menuErr) {
  console.error("読み取りエラー:", menuErr.message);
  process.exit(1);
}

console.log("=== 接続OK ===");
console.log("menu_items:", menu.length, "件");
console.table(menu);
console.log("tables:", tableCount, "件 / orders:", orderCount, "件");
