// ステップ10 マルチテナント分離(staff.store_id紐付け)の検証: anonの立場から確認できる範囲
// 実行: node --env-file=.env.local scripts/test-tenant-isolation.mjs
//
// 注意: このスクリプトは anon キーのみで実行できる範囲(staff_store_id()がanonから
// 呼べないこと等)しか自動検証できない。「A店スタッフでログインしてもB店データに
// アクセスできない」という本丸の検証には2つ目の店舗+スタッフアカウントが要るため、
// docs/07-tenant-isolation.md の手動確認手順を参照してください。
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sb = createClient(url, key); // anonのみ。ログインしない。

const ok = (b) => (b ? "✅" : "❌");
let failures = 0;
const check = (label, passed, detail) => {
  console.log(`${ok(passed)} ${label}${detail ? `  (${detail})` : ""}`);
  if (!passed) failures++;
};

console.log("=== staff_store_id() は anon から呼べない（revoke済み） ===");
{
  const { data, error } = await sb.rpc("staff_store_id");
  check("staff_store_id() 直接呼び出し拒否", !!error, error?.message ?? `通ってしまった: ${data}`);
}

console.log("\n=== staff テーブルは anon から一切読めない（ポリシー0件） ===");
{
  const { data, error } = await sb.from("staff").select("*").limit(1);
  check("staff 直接select(anon) は何も見えない", !error && (data?.length ?? 0) === 0, error?.message ?? `${data?.length}件見えた`);
}

console.log(
  `\n${failures === 0 ? "✅ anon視点での自動検証パス" : `❌ ${failures}件失敗`}\n` +
  "⚠ これはstaff_store_id()の「入口」が塞がっていることの確認に過ぎない。\n" +
  "   「別store所属スタッフが他店データにアクセスできない」という本丸の検証は\n" +
  "   docs/07-tenant-isolation.md の手動確認手順（2店舗目の用意後）で行うこと。"
);
process.exit(failures === 0 ? 0 : 1);
