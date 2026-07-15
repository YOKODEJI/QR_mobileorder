// ステップ6 Storage検証: バケット存在確認 / anonの直接アップロードが拒否されるか
// 実行: node --env-file=.env.local scripts/test-storage.mjs
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const ok = (b) => (b ? "✅" : "❌");

// 1) バケット一覧取得（公開バケットなら見えるはず）
const { data: buckets, error: listErr } = await sb.storage.listBuckets();
const photosBucket = buckets?.find((b) => b.id === "photos");
console.log(`${ok(!!photosBucket)} photosバケットが存在する`, listErr?.message ?? (photosBucket ? `public=${photosBucket.public}` : "見つからない"));

// 2) anonから直接アップロードを試みる → 拒否されるはず
const fakeFile = new Blob(["dummy-image-bytes"], { type: "image/jpeg" });
const path = `_test/anon-upload-${Date.now()}.jpg`;
const { error: upErr } = await sb.storage.from("photos").upload(path, fakeFile);
console.log(`${ok(!!upErr)} anonの直接アップロードは拒否される`, upErr?.message ?? "通ってしまった");
if (!upErr) {
  // 万一通ってしまったらテスト用ファイルを掃除
  await sb.storage.from("photos").remove([path]);
}
