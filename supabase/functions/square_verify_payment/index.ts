// Supabase Edge Function: square_verify_payment
//
// SquareCallback.tsx（/admin/square-callback）から呼ばれる。Square POSアプリの
// コールバックが返してくる transaction_id / status=ok はブラウザのクエリパラメータ、
// つまりクライアント側で自由に書き換え可能な値でしかない。これをそのまま信用して
// close_table（会計確定）を呼んでしまうと、スタッフが決済せずにURLを手で書き換える
// だけで会計を確定できてしまう（Codexレビューで指摘された穴）。
//
// ここでは stores.square_access_token（staff/anon には非公開・service_roleのみ読める）
// を使い、Square側に直接「その取引が本当に完了しているか・いくら決済されたか」を
// 問い合わせる。呼び出し元はこの結果（amountYen）だけを信用してよい。
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ verified: false, reason: "method not allowed" }, 405);

  try {
    const { storeId, transactionId } = (await req.json()) ?? {};
    if (!storeId || !transactionId) {
      return json({ verified: false, reason: "invalid payload" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: store, error } = await supabase
      .from("stores")
      .select("square_pos_mode, square_environment, square_location_id, square_access_token")
      .eq("id", storeId)
      .maybeSingle();
    if (error || !store) return json({ verified: false, reason: "store not found" }, 200);
    if (store.square_pos_mode !== "mobile_web") {
      return json({ verified: false, reason: "square pos mode disabled for this store" }, 200);
    }
    if (!store.square_location_id || !store.square_access_token) {
      return json({ verified: false, reason: "credentials not configured" }, 200);
    }

    const base =
      store.square_environment === "production"
        ? "https://connect.squareup.com"
        : "https://connect.squareupsandbox.com";

    // Point of Sale API（モバイルWeb版）が返すtransaction_idは、Square公式ドキュメントが
    // 「RetrieveTransactionエンドポイントで詳細を取得できる」と明記している値。
    // 旧Transactions API(locations/{id}/transactions/{id})を使う。
    const res = await fetch(
      `${base}/v2/locations/${store.square_location_id}/transactions/${transactionId}`,
      {
        headers: {
          Authorization: `Bearer ${store.square_access_token}`,
          "Square-Version": "2025-01-23",
        },
      }
    );
    const data = await res.json();
    if (!res.ok) {
      console.error("square_verify_payment: retrieve failed", res.status, JSON.stringify(data));
      return json({ verified: false, reason: "transaction not found" }, 200);
    }

    const tenders = (data?.transaction?.tenders as Array<{ amount_money?: { amount?: number } }>) ?? [];
    const amountYen = tenders.reduce((sum, t) => sum + (t.amount_money?.amount ?? 0), 0);
    if (amountYen <= 0) {
      return json({ verified: false, reason: "no completed tender found" }, 200);
    }

    return json({ verified: true, amountYen }, 200);
  } catch (e) {
    console.error("square_verify_payment: unexpected error", e);
    return json({ verified: false, reason: String(e) }, 200);
  }
});

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
