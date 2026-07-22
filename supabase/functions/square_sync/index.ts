// Supabase Edge Function: square_sync
// Square会計連携の土台（スキャフォールド）。
//
// 呼び出しタイミング: 会計確定(close_table)が成功した直後、クライアントが
// ベストエフォートで叩く（store/useAppStore.ts の checkout アクション参照）。
// 呼び出し自体は常に行われるが、実際にSquareへ同期するかどうかは
// stores.square_enabled（店舗ごとに「よこでじ」がSQL Editorから直接設定する
// 内部フラグ。店舗の設定画面には一切露出しない）で決まる。
//
// ★現状はキー未登録のためスタブ。square_enabled=trueの店舗でもSquare側への
//   実際のAPI呼び出しはまだ行わず、ログを残して終了する。実キー登録時に
//   syncToSquare() の中身を実装する（Square Orders API等）。
// ★失敗してもチェックアウト自体には一切影響しない設計（会計は既に確定済み。
//   ここでの失敗はログに残すだけで、客・スタッフ双方に何も表示しない）。
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const { checkoutId } = (await req.json()) ?? {};
    if (!checkoutId) return json({ error: "invalid payload" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: checkout, error: checkoutErr } = await supabase
      .from("checkouts")
      .select("id, store_id, table_name, items, total")
      .eq("id", checkoutId)
      .maybeSingle();
    if (checkoutErr || !checkout) {
      // 会計自体は既に確定済みなので、ここでの取得失敗は静かに終える
      return json({ ok: true, synced: false, reason: "checkout not found" }, 200);
    }

    const { data: store, error: storeErr } = await supabase
      .from("stores")
      .select("square_enabled, square_environment, square_location_id, square_access_token")
      .eq("id", checkout.store_id)
      .maybeSingle();
    if (storeErr || !store?.square_enabled) {
      return json({ ok: true, synced: false, reason: "square disabled for this store" }, 200);
    }

    if (!store.square_location_id || !store.square_access_token) {
      console.error("square_sync: enabled but credentials missing", checkout.store_id);
      return json({ ok: true, synced: false, reason: "credentials not configured" }, 200);
    }

    await syncToSquare(store, checkout);
    return json({ ok: true, synced: true }, 200);
  } catch (e) {
    // 会計確定後のベストエフォート処理のため、ここで500を返しても
    // クライアント側は結果を見ていない（catchして無視する設計）。
    console.error("square_sync: unexpected error", e);
    return json({ ok: false, error: String(e) }, 200);
  }
});

/** Square Orders APIへの実際の同期。キー登録後にここを実装する。
 *  アドホック明細行(カタログ商品と紐付けない line item)でPOSTすれば、
 *  Square側にメニューを二重登録せずに会計内容をそのまま起票できる。 */
async function syncToSquare(
  store: {
    square_environment: string;
    square_location_id: string | null;
    square_access_token: string | null;
  },
  checkout: { id: string; table_name: string; items: unknown; total: number }
): Promise<void> {
  // TODO(キー登録後に実装):
  //   const base = store.square_environment === "production"
  //     ? "https://connect.squareup.com"
  //     : "https://connect.squareupsandbox.com";
  //   await fetch(`${base}/v2/orders`, {
  //     method: "POST",
  //     headers: {
  //       Authorization: `Bearer ${store.square_access_token}`,
  //       "Content-Type": "application/json",
  //       "Square-Version": "2025-01-23",
  //     },
  //     body: JSON.stringify({
  //       idempotency_key: checkout.id,
  //       order: {
  //         location_id: store.square_location_id,
  //         line_items: (checkout.items as Array<{ name: string; qty: number; price: number }>).map((it) => ({
  //           name: it.name,
  //           quantity: String(it.qty),
  //           base_price_money: { amount: it.price, currency: "JPY" },
  //         })),
  //       },
  //     }),
  //   });
  console.log("square_sync: stub call (no credentials yet)", checkout.id, checkout.table_name);
}

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
