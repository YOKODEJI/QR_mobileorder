// ステップ4/5 セキュリティ回帰検証: トークン検証 / セッション / レート制限（anonの立場から）
// 実行: node --env-file=.env.local scripts/test-security.mjs
//
// 注意（ステップ5以降）: anonは tables.qr_token を直接読めない（意図的な制限）。
// そのため対象卓のid/qr_tokenは、SQL Editorで下記を実行して取得し、定数として渡す。
//   select id, qr_token from tables where store_id = '<STORE_ID>' and name = 'テーブル 1';
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const storeId = process.env.NEXT_PUBLIC_STORE_ID;
const sb = createClient(url, key); // anonのみ。ログインしない。

const TABLE_ID = process.argv[2] ?? "3026ce72-83bb-4e77-8caa-5eb6aadad0f8"; // テーブル1
const QR_TOKEN = process.argv[3] ?? "02772b1816ada60f2777159f"; // テーブル1のqr_token

const ok = (b) => (b ? "✅" : "❌");
let failures = 0;
const check = (label, passed, detail) => {
  console.log(`${ok(passed)} ${label}${detail ? `  (${detail})` : ""}`);
  if (!passed) failures++;
};

console.log(`対象卓id=${TABLE_ID.slice(0, 8)}…`);

// --- 1) open_session RPC の照合 ---
const { data: sess, error: osErr } = await sb.rpc("open_session", {
  p_store: storeId,
  p_table: TABLE_ID,
  p_k: QR_TOKEN,
});
check("open_session(正しいk) 成功", !osErr && !!sess, osErr?.message ?? `session=${String(sess).slice(0, 8)}…`);

const { error: badKErr } = await sb.rpc("open_session", {
  p_store: storeId,
  p_table: TABLE_ID,
  p_k: "wrong-token-xxxx",
});
check("open_session(誤ったk) 拒否", !!badKErr, badKErr?.message);

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
      tableId: TABLE_ID,
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

// --- 2) トークン無し／誤りの注文は弾かれる ---
const noTok = await order(null, crypto.randomUUID());
check("注文(トークン無し) 拒否", !!noTok.error, noTok.error ?? `通ってしまった orderId=${noTok.orderId}`);

const badTok = await order("wrong-session-xxxx", crypto.randomUUID());
check("注文(誤トークン) 拒否", !!badTok.error, badTok.error);

// --- 3) 正しい session_token の注文は成功 ---
const good = await order(sess, crypto.randomUUID());
check("注文(正セッション) 成功", !!good.orderId, good.orderId ? `orderId=${good.orderId.slice(0, 8)}…` : good.error);

console.log(
  `\n${failures === 0 ? "✅ 全項目パス（anonの立場での検証はここまで）" : `❌ ${failures}件失敗`}\n` +
  `注意: close_table(会計)はステップ5でauthenticated限定にしたため、このスクリプト(anon)からは検証不可（想定通り）。\n` +
  `      「会計でセッションが更新される」ことは /admin に実際にログインして確認してください:\n` +
  `      1. /admin にログイン → テーブル/会計 → テーブル1を会計\n` +
  `      2. その直後、上のテスト用の正セッション(sess)で再度注文しても拒否されればOK\n` +
  `      （このテスト注文1件は会計されずに残るので、上記の手動確認で一緒に片付きます）`
);
process.exit(failures === 0 ? 0 : 1);
