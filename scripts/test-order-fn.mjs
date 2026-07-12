// Edge Function submit_order の検証: 冪等性 と オーバーセル防止
// 実行: node --env-file=.env.local scripts/test-order-fn.mjs
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const storeId = process.env.NEXT_PUBLIC_STORE_ID;
const sb = createClient(url, key);

const { data: t } = await sb.from("tables").select("id").eq("store_id", storeId).eq("name", "テーブル 5").single();
const { data: m } = await sb.from("menu_items").select("id,name,stock").eq("store_id", storeId).eq("name", "シーザーサラダ").single();
console.log(`対象: ${m.name} 現在庫=${m.stock}`);

async function call(items, idem) {
  const { data, error } = await sb.functions.invoke("submit_order", {
    body: { storeId, tableId: t.id, proxy: false, idempotencyKey: idem, items },
  });
  if (error) {
    let msg = error.message;
    try { const b = await error.context.json(); if (b?.error) msg = b.error; } catch {}
    return { error: msg };
  }
  return { orderId: data.orderId };
}

// --- テスト1: 冪等性（同じキーで2回 → 同じ注文、二重にならない） ---
const idem = crypto.randomUUID();
const r1 = await call([{ menuItemId: m.id, qty: 1 }], idem);
const r2 = await call([{ menuItemId: m.id, qty: 1 }], idem);
console.log("冪等: r1=", r1.orderId, " r2=", r2.orderId, r1.orderId && r1.orderId === r2.orderId ? "✅ 同一（二重なし）" : "❌");
const { count: dupCount } = await sb.from("orders").select("*", { count: "exact", head: true }).eq("idempotency_key", idem);
console.log(`  → idempotency_key の注文件数 = ${dupCount}（1なら正解）`);

// --- テスト2: オーバーセル防止（在庫を超える数量 → 弾かれる） ---
const { data: m2 } = await sb.from("menu_items").select("stock").eq("id", m.id).single();
const over = m2.stock + 50;
const r3 = await call([{ menuItemId: m.id, qty: over }], crypto.randomUUID());
console.log(`オーバーセル: 在庫${m2.stock}に対し${over}個注文 →`, r3.error ? `✅ 弾かれた（${r3.error}）` : `❌ 通ってしまった orderId=${r3.orderId}`);
