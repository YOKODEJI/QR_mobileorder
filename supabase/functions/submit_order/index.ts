// Supabase Edge Function: submit_order
// 客/店員の注文を「サーバー側」で確定する入口。
// place_order(SQL) を service_role で呼び、在庫の原子的減算・冪等・スナップショットを保証する。
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
    const { storeId, tableId, proxy, idempotencyKey, items, token } = body ?? {};

    if (!storeId || !tableId || !Array.isArray(items) || items.length === 0) {
      return json({ error: "invalid payload" }, 400);
    }

    // service_role でRLSを越えてトランザクション関数を呼ぶ（キーは環境から自動注入）
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // proxy(スタッフ代理注文)は、本当にログイン済みスタッフからの呼び出しかを検証する。
    // ここを信用してそのまま渡すと、anonキーだけで proxy:true を送りつけて
    // 客注文のセッション検証/レート制限を丸ごとスキップできてしまう。
    // 呼び出し元のAuthorizationヘッダを実際に検証し、ログイン済みでなければ強制的に false にする。
    let effectiveProxy = false;
    if (proxy) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const jwt = authHeader.replace(/^Bearer\s+/i, "");
      if (jwt) {
        const { data: userData } = await supabase.auth.getUser(jwt);
        effectiveProxy = !!userData?.user;
      }
    }

    const { data, error } = await supabase.rpc("place_order", {
      p_store: storeId,
      p_table: tableId,
      p_proxy: effectiveProxy,
      p_idem: idempotencyKey ?? null,
      p_items: items,
      p_token: token ?? null,   // 客の session_token（proxy注文では未使用）
    });

    if (error) {
      // 在庫切れは 409、セッション/トークン不正は 403、その他は 400
      const status = /out of stock/i.test(error.message)
        ? 409
        : /session expired|invalid token|too many requests/i.test(error.message)
          ? 403
          : 400;
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
