// ステップ4 セキュリティ検証: トークン検証 / セッション / レート制限 / 会計更新
// 実行: node --env-file=.env.local scripts/test-security.mjs
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const storeId = process.env.NEXT_PUBLIC_STORE_ID;
const sb = createClient(url, key);

const ok = (b) => (b ? "✅" : "❌");

// --- 0) ① 列の存在確認 ---
const { data: tbls, error: colErr } = await sb
  .from("tables")
  .select("id,name,qr_token,session_token")
  .eq("store_id", storeId)
  .order("sort")
  .limit(1);
if (colErr) {
  console.log(`❌ ① 未実行っぽい: tables.qr_token を読めません（${colErr.message}）`);
  console.log("   → SQL Editor で step①（列追加）を実行してください。");
  process.exit(1);
}
const table = tbls[0];
console.log(`対象卓: ${table.name}  qr_token=${table.qr_token?.slice(0, 8)}…  ✅ ①列OK`);

// --- 1) ② open_session RPC の存在＋照合 ---
const { data: sess, error: osErr } = await sb.rpc("open_session", {
  p_store: storeId,
  p_table: table.id,
  p_k: table.qr_token,
});
if (osErr) {
  console.log(`❌ ② 未実行っぽい: open_session を呼べません（${osErr.message}）`);
  console.log("   → SQL Editor で step②（関数更新）を実行してください。");
  process.exit(1);
}
console.log(`open_session(正しいk) → session_token=${String(sess).slice(0, 8)}…  ✅ ②関数OK`);

const { error: badKErr } = await sb.rpc("open_session", {
  p_store: storeId,
  p_table: table.id,
  p_k: "wrong-token-xxxx",
});
console.log(`open_session(誤ったk) → ${ok(!!badKErr)} 拒否 (${badKErr?.message ?? "通ってしまった"})`);

// --- ヘルパー: submit_order 呼び出し ---
const { data: menu } = await sb
  .from("menu_items")
  .select("id,name,stock")
  .eq("store_id", storeId)
  .gt("stock", 5)
  .limit(1)
  .single();

async function order(token, idem) {
  const { data, error } = await sb.functions.invoke("submit_order", {
    body: {
      storeId,
      tableId: table.id,
      proxy: false,
      idempotencyKey: idem,
      token,
      items: [{ menuItemId: menu.id, qty: 1 }],
    },
  });
  if (error) {
    let msg = error.message;
    try { const b = await error.context.json(); if (b?.error) msg = b.error; } catch {}
    return { error: msg };
  }
  return { orderId: data.orderId };
}

// --- 2) トークン無しの注文は弾かれる ---
const noTok = await order(null, crypto.randomUUID());
console.log(`注文(トークン無し) → ${ok(!!noTok.error)} 拒否 (${noTok.error ?? "通ってしまった orderId=" + noTok.orderId})`);

// --- 3) 誤トークンの注文は弾かれる ---
const badTok = await order("wrong-session-xxxx", crypto.randomUUID());
console.log(`注文(誤トークン)   → ${ok(!!badTok.error)} 拒否 (${badTok.error ?? "通ってしまった"})`);

// --- 4) 正しい session_token の注文は成功 ---
const good = await order(sess, crypto.randomUUID());
console.log(`注文(正セッション) → ${ok(!!good.orderId)} 成功 (${good.orderId ? "orderId=" + good.orderId.slice(0, 8) + "…" : "失敗: " + good.error})`);

// --- 5) 会計で session_token が更新され、旧トークンが無効化される ---
await sb.rpc("close_table", { p_store: storeId, p_table: table.id });
const afterClose = await order(sess, crypto.randomUUID());
console.log(`会計後、旧トークンで注文 → ${ok(!!afterClose.error)} 拒否 (${afterClose.error ?? "通ってしまった＝更新されてない"})`);

// 新しい session_token を取り直せば再び注文できる
const { data: sess2 } = await sb.rpc("open_session", { p_store: storeId, p_table: table.id, p_k: table.qr_token });
const reorder = await order(sess2, crypto.randomUUID());
console.log(`新セッション取得後   → ${ok(!!reorder.orderId)} 成功 (${reorder.orderId ? "OK" : reorder.error})`);

// 後片付け: このテスト注文を会計で消す
await sb.rpc("close_table", { p_store: storeId, p_table: table.id });
console.log("— 検証完了（テスト注文は会計で片付け済み）—");
