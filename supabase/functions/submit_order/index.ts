// Supabase Edge Function: submit_order
// 客/店員の注文を「サーバー側」で確定する入口。
// place_order(SQL) を service_role で呼び、在庫の原子的減算・冪等・スナップショットを保証する。
// ※ ステップ4でここに「セッショントークン検証」を追加する予定。
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const { storeId, tableId, proxy, idempotencyKey, items } = body ?? {};

    if (!storeId || !tableId || !Array.isArray(items) || items.length === 0) {
      return json({ error: "invalid payload" }, 400);
    }

    // service_role でRLSを越えてトランザクション関数を呼ぶ（キーは環境から自動注入）
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase.rpc("place_order", {
      p_store: storeId,
      p_table: tableId,
      p_proxy: !!proxy,
      p_idem: idempotencyKey ?? null,
      p_items: items,
    });

    if (error) {
      // 在庫切れ等の業務エラーは 409 で返す
      const status = /out of stock/i.test(error.message) ? 409 : 400;
      return json({ error: error.message }, status);
    }
    return json({ orderId: data }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
