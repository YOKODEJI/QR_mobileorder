// ステップ5 RLS厳格化の検証: anon直接書込禁止 / RPC実行権限 / proxy偽装防止
// 実行: node --env-file=.env.local scripts/test-rls.mjs
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const storeId = process.env.NEXT_PUBLIC_STORE_ID;
const sb = createClient(url, key); // anonのみ。ログインしない。

const ok = (b) => (b ? "✅" : "❌");
let failures = 0;
const check = (label, passed, detail) => {
  console.log(`${ok(passed)} ${label}${detail ? `  (${detail})` : ""}`);
  if (!passed) failures++;
};

const { data: table } = await sb
  .from("tables")
  .select("id,name")
  .eq("store_id", storeId)
  .eq("name", "テーブル 1")
  .single();
const { data: menuItem } = await sb
  .from("menu_items")
  .select("id,stock")
  .eq("store_id", storeId)
  .gt("stock", 3)
  .limit(1)
  .single();

console.log("=== 1) 列レベル: anon は tables.qr_token を読めない ===");
{
  const { data, error } = await sb.from("tables").select("qr_token").eq("id", table.id).single();
  check("qr_token 列アクセス拒否", !!error, error?.message ?? `通ってしまった: ${data?.qr_token}`);
}

console.log("\n=== 2) anon の直接書込がすべて拒否される ===");
// 注意: PostgRESTはRLS拒否時、INSERTはエラーを返すが、UPDATE/DELETE/SELECTは
// 「対象0件」として"成功"を返すことがある（エラーではなく実際の変化/可視性で判定する）。
{
  const { error } = await sb.from("orders").insert({ store_id: storeId, table_id: table.id, status: "cooking" });
  check("orders 直接insert 拒否", !!error, error?.message);
}
{
  const before = menuItem.stock;
  await sb.from("menu_items").update({ stock: 9999 }).eq("id", menuItem.id);
  const { data: after } = await sb.from("menu_items").select("stock").eq("id", menuItem.id).single();
  check("menu_items 直接update(anon) は実際には効かない", after.stock === before, `before=${before} after=${after.stock}`);
}
{
  const { error } = await sb.from("tables").insert({ store_id: storeId, name: "★不正追加★", sort: 999 });
  check("tables 直接insert(anon) 拒否", !!error, error?.message);
}
{
  const { data, error } = await sb.from("checkouts").select("id").limit(1);
  check("checkouts 直接select(anon) は何も見えない", !error && (data?.length ?? 0) === 0, error?.message ?? `${data?.length}件見えた`);
}
{
  // ステップ11以降、anon(生の匿名認証もしていない客)はstaff_callsを読めなくなった
  // （客の閲覧はhas_table_session()経由の匿名認証customerのみ）。そのためinsertの
  // representation(.select())は使わず、エラーが無いことだけで「呼び出しは許可される」を確認する。
  const { error: insertErr } = await sb.from("staff_calls").insert({ store_id: storeId, table_id: table.id });
  check("staff_calls insert(anon=呼び出し) は許可される", !insertErr, insertErr?.message);
  const { data: seen, error: selErr } = await sb.from("staff_calls").select("id").eq("table_id", table.id).is("resolved_at", null);
  check("staff_calls 直接select(生anon) は何も見えない（ステップ11以降）", !selErr && (seen?.length ?? 0) === 0, selErr?.message ?? `${seen?.length}件見えた`);
}

console.log("\n=== 3) RPC実行権限: place_order/close_table/regenerate_table_token は anon から直接呼べない ===");
{
  const { error } = await sb.rpc("place_order", {
    p_store: storeId, p_table: table.id, p_proxy: true, p_idem: crypto.randomUUID(),
    p_items: [{ menuItemId: menuItem.id, qty: 1 }], p_token: null,
  });
  check("place_order 直接rpc(anon, proxy=true) 拒否", !!error, error?.message);
}
{
  const { error } = await sb.rpc("close_table", { p_store: storeId, p_table: table.id });
  check("close_table 直接rpc(anon) 拒否", !!error, error?.message);
}
{
  const { error } = await sb.rpc("regenerate_table_token", { p_store: storeId, p_table: table.id });
  check("regenerate_table_token 直接rpc(anon) 拒否", !!error, error?.message);
}
{
  // open_sessionは読み取り専用なので anon から呼べるはず（誤りkは invalid token で弾かれる＝関数自体は実行できる）
  const { error } = await sb.rpc("open_session", { p_store: storeId, p_table: table.id, p_k: "wrong" });
  check("open_session は anon から実行できる(内容は拒否でもOK)", !!error && /invalid token/.test(error.message), error?.message);
}

console.log("\n=== 4) submit_order Edge Function: proxy:true を偽装しても実際の検証を通らないと弾かれる ===");
{
  // ログインしていない状態でproxy:trueを送る→サーバー側でeffectiveProxy=falseに矯正され、
  // 通常の客注文と同じ扱い（token必須）になり、tokenが無いので拒否されるはず。
  const { error } = await sb.functions.invoke("submit_order", {
    body: {
      storeId, tableId: table.id, proxy: true, idempotencyKey: crypto.randomUUID(),
      items: [{ menuItemId: menuItem.id, qty: 1 }],
      // token 未指定
    },
  });
  let msg = error?.message;
  if (error) { try { const b = await error.context.json(); if (b?.error) msg = b.error; } catch {} }
  check("proxy:true偽装(token無し) → セッション必須の客注文として拒否", !!error, msg);
}

console.log(`\n${failures === 0 ? "✅ 全項目パス" : `❌ ${failures}件失敗`}`);
process.exit(failures === 0 ? 0 : 1);
