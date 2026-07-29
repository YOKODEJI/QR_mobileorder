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

/** Square Orders/Payments APIへの実際の同期。
 *  1. アドホック明細行(カタログ商品と紐付けないline item)で注文を起票
 *     → Square側にメニューを二重登録せずに会計内容をそのまま写せる
 *  2. その注文に「現金支払い」を記録して完了させる
 *     → 店頭での現金/その場決済は既に済んでいる前提。支払いまで記録しないと
 *       Squareダッシュボードの売上（取引）に現れないため、ここまでやって初めて
 *       「レジへの二度打ち」が不要になる */
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
  console.log("square_sync: order created", order.id, "total", order.total_money?.amount);

  // --- 2. 現金支払いの記録（注文を完了させ、売上として計上する） ---
  // Square側で計算された合計(total_money)をそのまま支払う。アプリ側totalと一致するはずだが、
  // 万一ズレてもSquareの注文が完了しないよりは、Square側の合計で完了させて差分をログに残す。
  const squareTotal = order.total_money?.amount ?? checkout.total;
  if (squareTotal !== checkout.total) {
    console.error("square_sync: total mismatch app=", checkout.total, "square=", squareTotal, checkout.id);
  }
  const payRes = await fetch(`${base}/v2/payments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      idempotency_key: `${checkout.id}:pay`,
      source_id: "CASH",
      order_id: order.id,
      location_id: store.square_location_id,
      amount_money: { amount: squareTotal, currency: "JPY" },
      cash_details: { buyer_supplied_money: { amount: squareTotal, currency: "JPY" } },
      note: `QRオーダー ${checkout.table_name}`,
    }),
  });
  const payData = await payRes.json();
  if (!payRes.ok) {
    throw new Error(`square payments api ${payRes.status}: ${JSON.stringify(payData?.errors ?? payData)}`);
  }
  console.log("square_sync: payment recorded", payData.payment?.id, payData.payment?.status);
}

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
