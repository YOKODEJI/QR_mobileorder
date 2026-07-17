// ステップ12 プロレビュー指摘対応の検証: staff_calls連投スパム対策 / cancel_order_item RPC
// 実行: node --env-file=.env.local scripts/test-hardening.mjs
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

console.log("=== 1) staff_calls連投スパム対策 ===");
{
  // 1件目: 成功するはず
  const { error: e1 } = await sb.from("staff_calls").insert({ store_id: storeId, table_id: table.id });
  check("1件目の呼び出し(未対応なし)は成功", !e1, e1?.message);

  // 2件目: 直前のが未対応(resolved_at is null)のままなので拒否されるはず
  const { error: e2 } = await sb.from("staff_calls").insert({ store_id: storeId, table_id: table.id });
  check("2件目の呼び出し(未対応が既にある)は拒否", !!e2, e2?.message ?? "通ってしまった＝スパム対策が効いていない");
}

console.log("\n=== 2) cancel_order_item RPCはanonから直接呼べない ===");
{
  const { error } = await sb.rpc("cancel_order_item", {
    p_order: "00000000-0000-0000-0000-000000000000",
    p_menu_item: "00000000-0000-0000-0000-000000000000",
  });
  check("cancel_order_item 直接rpc(anon) 拒否", !!error, error?.message);
}

console.log(
  `\n${failures === 0 ? "✅ 全項目パス" : `❌ ${failures}件失敗`}\n` +
  "⚠ テスト用に挿入したstaff_calls(未対応)が1件残っています。管理画面の厨房タブで対応済みにしてください。"
);
process.exit(failures === 0 ? 0 : 1);
