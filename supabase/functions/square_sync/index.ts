// Supabase Edge Function: square_sync
// Square会計連携の土台（スキャフォールド）。
//
// 呼び出しタイミング: 会計確定(close_table)が成功した直後、クライアントが
// ベストエフォートで叩く（store/useAppStore.ts の checkout アクション参照）。
// 呼び出し自体は常に行われるが、実際にSquareへ同期するかどうかは
// stores.square_enabled（店舗ごとに「よこでじ」がSQL Editorから直接設定する
// 内部フラグ。店舗の設定画面には一切露出しない）で決まる。
//
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
      .select("id, store_id, table_name, items, total, discount_amount, charge_amount, tax_amount")
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

const SQUARE_VERSION = "2025-01-23";

type CheckoutItem = {
  name: string;
  qty: number;
  price: number; // 本体単価（オプション差額を含まない）
  options?: Array<{ name: string; priceDelta: number }>;
};

/** Square Orders APIへの実際の同期。
 *  アドホック明細行(カタログ商品と紐付けないline item)で「未払いのOPEN注文」を起票する。
 *  → 支払いはここでは記録しない。実際の決済（カード/現金/QR）はSquareレジ側で
 *    この注文を開いて実行する。つまりアプリの会計ボタン＝Squareに伝票を送るボタン。
 *  → フルフィルメント(PICKUP/ASAP)を付けるのは、API起票の注文をSquare POS・
 *    ダッシュボードの「注文」一覧に表示させて決済可能にするための要件。 */
async function syncToSquare(
  store: {
    square_environment: string;
    square_location_id: string | null;
    square_access_token: string | null;
  },
  checkout: {
    id: string;
    table_name: string;
    items: unknown;
    total: number;
    discount_amount: number | null;
    charge_amount: number | null;
    tax_amount: number | null;
  }
): Promise<void> {
  const base =
    store.square_environment === "production"
      ? "https://connect.squareup.com"
      : "https://connect.squareupsandbox.com";
  const headers = {
    Authorization: `Bearer ${store.square_access_token}`,
    "Content-Type": "application/json",
    "Square-Version": SQUARE_VERSION,
  };

  const items = (checkout.items as CheckoutItem[]) ?? [];
  const lineItems = items.map((it) => {
    const delta = (it.options ?? []).reduce((a, o) => a + (o.priceDelta || 0), 0);
    const label = (it.options ?? []).map((o) => o.name).join(" / ");
    return {
      name: it.name,
      // オプションはSquare上では「バリエーション名」として明細行に併記する
      ...(label ? { variation_name: label } : {}),
      quantity: String(it.qty),
      base_price_money: { amount: it.price + delta, currency: "JPY" },
    };
  });
  // チャージ料・外税はアドホック行として追加し、Square側の合計をアプリの請求額と一致させる
  // （Squareの注文レベル税は%指定のみで金額指定ができないため、行として写すのが確実）
  if ((checkout.charge_amount ?? 0) > 0) {
    lineItems.push({
      name: "チャージ料",
      quantity: "1",
      base_price_money: { amount: checkout.charge_amount!, currency: "JPY" },
    });
  }
  if ((checkout.tax_amount ?? 0) > 0) {
    lineItems.push({
      name: "消費税（外税）",
      quantity: "1",
      base_price_money: { amount: checkout.tax_amount!, currency: "JPY" },
    });
  }

  // --- 1. 注文の起票（idempotency_key=checkout.id なので再実行しても二重起票されない） ---
  const orderRes = await fetch(`${base}/v2/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      idempotency_key: checkout.id,
      order: {
        location_id: store.square_location_id,
        reference_id: checkout.id,
        ticket_name: checkout.table_name.slice(0, 30),
        line_items: lineItems,
        // API起票の注文はフルフィルメントが無いとPOS/ダッシュボードの「注文」に
        // 出てこない。店内会計なので実体は「その場受け渡し済み」だが、
        // Squareレジで開いて決済するための表示要件としてPICKUP/ASAPを付ける。
        fulfillments: [
          {
            type: "PICKUP",
            state: "PROPOSED",
            pickup_details: {
              recipient: { display_name: checkout.table_name.slice(0, 30) || "テーブル" },
              schedule_type: "ASAP",
              pickup_at: new Date().toISOString(),
            },
          },
        ],
        ...((checkout.discount_amount ?? 0) > 0
          ? {
              discounts: [
                {
                  name: "割引",
                  type: "FIXED_AMOUNT",
                  amount_money: { amount: checkout.discount_amount!, currency: "JPY" },
                  scope: "ORDER",
                },
              ],
            }
          : {}),
      },
    }),
  });
  const orderData = await orderRes.json();
  if (!orderRes.ok) {
    throw new Error(`square orders api ${orderRes.status}: ${JSON.stringify(orderData?.errors ?? orderData)}`);
  }
  const order = orderData.order;
  // アプリ側の請求額とSquare側の計算合計が一致しているかは常に検算してログに残す
  // （ズレたままレジ決済すると請求額が変わってしまうため、気付ける状態にしておく）
  const squareTotal = order.total_money?.amount;
  if (squareTotal !== checkout.total) {
    console.error("square_sync: total mismatch app=", checkout.total, "square=", squareTotal, checkout.id);
  }
  console.log("square_sync: open order sent", order.id, "total", squareTotal, order.state);
}

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
