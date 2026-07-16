// ステップ11 客(anon)の卓単位読み取り分離(Anonymous Auth)の検証
// 実行: node --env-file=.env.local scripts/test-customer-session.mjs <table1_id> <qr1> <table2_id> <qr2>
//
// 対象卓のid/qr_tokenは、SQL Editorで下記を実行して取得する（ステップ5以降anonはqr_token
// を直接読めないため）:
//   select id, qr_token from tables where store_id = '<STORE_ID>' order by sort limit 2;
//
// このテストは signInAnonymously() 自体はanonキーだけで呼べるため、staff間分離と違い
// 完全に自動化できる（2つの匿名ユーザー=2台の客の端末を模擬して相互に見えないことを確認）。
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const storeId = process.env.NEXT_PUBLIC_STORE_ID;

const [TABLE1, QR1, TABLE2, QR2] = process.argv.slice(2);
if (!TABLE1 || !QR1 || !TABLE2 || !QR2) {
  console.error("usage: node --env-file=.env.local scripts/test-customer-session.mjs <table1_id> <qr1> <table2_id> <qr2>");
  process.exit(1);
}

const ok = (b) => (b ? "✅" : "❌");
let failures = 0;
const check = (label, passed, detail) => {
  console.log(`${ok(passed)} ${label}${detail ? `  (${detail})` : ""}`);
  if (!passed) failures++;
};

// 生anon（signInAnonymouslyしない、素のanonロール）
console.log("=== 0) 生anon(匿名認証もしない)は orders/staff_calls を直接読めない ===");
{
  const raw = createClient(url, key);
  const { data, error } = await raw.from("orders").select("id").limit(1);
  check("orders 直接select(生anon) は何も見えない", !error && (data?.length ?? 0) === 0, error?.message ?? `${data?.length}件見えた`);
}

// 客1: signInAnonymously → open_session(卓1)
const c1 = createClient(url, key);
const { error: signIn1Err } = await c1.auth.signInAnonymously();
if (signIn1Err) {
  console.log(`\n⚠ signInAnonymously失敗: ${signIn1Err.message}`);
  console.log("   Supabaseダッシュボード → Authentication → Sign In / Providers →");
  console.log("   「Allow anonymous sign-ins」を有効化してから再実行してください。");
  process.exit(1);
}
const { data: sess1, error: os1Err } = await c1.rpc("open_session", { p_store: storeId, p_table: TABLE1, p_k: QR1 });
check("客1: open_session(卓1, 正しいk) 成功", !os1Err && !!sess1, os1Err?.message);

// 客2: signInAnonymously → open_session(卓2)
const c2 = createClient(url, key);
await c2.auth.signInAnonymously();
const { error: os2Err } = await c2.rpc("open_session", { p_store: storeId, p_table: TABLE2, p_k: QR2 });
check("客2: open_session(卓2, 正しいk) 成功", !os2Err, os2Err?.message);

console.log("\n=== 1) 客1は卓1のorders/staff_callsを読める ===");
{
  const { data, error } = await c1.from("orders").select("id,table_id").eq("table_id", TABLE1);
  check("客1: 卓1のorders select 成功(0件でもOK、エラーでないこと)", !error, error?.message ?? `${data?.length}件`);
}

console.log("\n=== 2) 客1は卓2(他卓)のordersを読めない ===");
{
  const { data, error } = await c1.from("orders").select("id").eq("table_id", TABLE2);
  check("客1: 卓2のorders select は0件(見えない)", !error && (data?.length ?? 0) === 0, error?.message ?? `${data?.length}件見えてしまった`);
}

console.log("\n=== 3) 客2は卓1(他卓)のstaff_callsを読めない ===");
{
  const { data, error } = await c2.from("staff_calls").select("id").eq("table_id", TABLE1);
  check("客2: 卓1のstaff_calls select は0件(見えない)", !error && (data?.length ?? 0) === 0, error?.message ?? `${data?.length}件見えてしまった`);
}

console.log(`\n${failures === 0 ? "✅ 全項目パス" : `❌ ${failures}件失敗`}`);
process.exit(failures === 0 ? 0 : 1);
