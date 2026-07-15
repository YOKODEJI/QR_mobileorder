// Supabase データアクセス層（M2 読み取り＋リアルタイム＋書き込み）
// 業務データ（tables/menu/orders/calls/checkouts）はここ経由でDBと同期する。
import { getSupabase, STORE_ID } from "./supabase";
import type {
  MenuItem,
  Order,
  OrderItem,
  TableRec,
  StaffCall,
  CheckoutRecord,
  Cat,
  TaxMode,
  DiscountType,
} from "@/store/useAppStore";

export interface Snapshot {
  storeName: string | null;
  theme: string | null;
  showHeaderPhoto: boolean;
  showFooterPhoto: boolean;
  headerPhoto: string | null;
  footerPhoto: string | null;
  taxMode: TaxMode | null;
  taxRate: number | null;
  chargeRate: number | null;
  categories: string[];
  tables: TableRec[];
  menu: MenuItem[];
  orders: Order[];
  calls: StaffCall[];
  checkouts: CheckoutRecord[];
}

/** 店舗の全業務データをDBから取得してストア形状にマップ */
export async function loadSnapshot(): Promise<Snapshot | null> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return null;

  const [store, categories, tables, menu, orders, calls, checkouts] = await Promise.all([
    sb.from("stores").select("name,theme,show_header_photo,show_footer_photo,header_photo_url,footer_photo_url,tax_mode,tax_rate,charge_rate").eq("id", STORE_ID).single(),
    sb.from("categories").select("id,name,sort").eq("store_id", STORE_ID).order("sort"),
    sb.from("tables").select("id,name,sort").eq("store_id", STORE_ID).order("sort"),
    sb.from("menu_items").select("id,name,cat,price,sold_out,stock,photo_url,sort").eq("store_id", STORE_ID).order("sort"),
    sb
      .from("orders")
      .select("id,table_id,status,proxy,created_at, order_items(menu_item_id,name,price,qty)")
      .eq("store_id", STORE_ID)
      .order("created_at", { ascending: true }),
    sb.from("staff_calls").select("id,table_id,created_at").eq("store_id", STORE_ID).is("resolved_at", null),
    sb
      .from("checkouts")
      .select("id,table_id,table_name,items,count,subtotal,discount_type,discount_value,discount_amount,charge_amount,tax_amount,total,closed_at")
      .eq("store_id", STORE_ID)
      .order("closed_at", { ascending: false }),
  ]);

  const err = store.error || categories.error || tables.error || menu.error || orders.error || calls.error || checkouts.error;
  if (err) {
    console.error("loadSnapshot error:", err.message);
    return null;
  }

  return {
    storeName: store.data?.name ?? null,
    theme: store.data?.theme ?? null,
    showHeaderPhoto: store.data?.show_header_photo ?? false,
    showFooterPhoto: store.data?.show_footer_photo ?? false,
    headerPhoto: (store.data?.header_photo_url as string | null) ?? null,
    footerPhoto: (store.data?.footer_photo_url as string | null) ?? null,
    taxMode: (store.data?.tax_mode as TaxMode | null) ?? null,
    taxRate: (store.data?.tax_rate as number | null) ?? null,
    chargeRate: (store.data?.charge_rate as number | null) ?? null,
    categories: (categories.data ?? []).map((c) => c.name as string),
    tables: (tables.data ?? []).map((t) => ({ id: t.id as string, name: t.name as string })),
    menu: (menu.data ?? []).map((m) => ({
      id: m.id as string,
      name: m.name as string,
      cat: m.cat as Cat,
      price: m.price as number,
      soldOut: m.sold_out as boolean,
      stock: m.stock as number,
      photo: (m.photo_url as string | null) ?? null,
    })),
    orders: (orders.data ?? []).map((o) => ({
      id: o.id as string,
      table: o.table_id as string,
      createdAt: o.created_at as string,
      status: o.status as Order["status"],
      proxy: (o.proxy as boolean) || undefined,
      items: ((o.order_items ?? []) as Array<Record<string, unknown>>).map((it) => ({
        menuItemId: (it.menu_item_id as string) ?? "",
        name: it.name as string,
        price: it.price as number,
        qty: it.qty as number,
      })) as OrderItem[],
    })),
    calls: (calls.data ?? []).map((c) => ({
      id: c.id as string,
      table: c.table_id as string,
      createdAt: c.created_at as string,
    })),
    checkouts: (checkouts.data ?? []).map((c) => ({
      id: c.id as string,
      tableId: (c.table_id as string) ?? "",
      tableName: c.table_name as string,
      items: (c.items as OrderItem[]) ?? [],
      count: c.count as number,
      subtotal: (c.subtotal as number) ?? (c.total as number),
      discountType: (c.discount_type as DiscountType) ?? null,
      discountValue: (c.discount_value as number) ?? 0,
      discountAmount: (c.discount_amount as number) ?? 0,
      chargeAmount: (c.charge_amount as number) ?? 0,
      taxAmount: (c.tax_amount as number) ?? 0,
      total: c.total as number,
      closedAt: c.closed_at as string,
    })),
  };
}

/** 業務テーブルの変更を購読。onChange をデバウンスして全件再取得するのは呼び出し側の責務 */
export function subscribeRealtime(onChange: () => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const channel = sb
    .channel("qr-order-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "tables" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "staff_calls" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "checkouts" }, onChange)
    .subscribe();
  return () => {
    sb.removeChannel(channel);
  };
}

/** チャネルの接続状態を購読（true=接続, false=切断） */
export function subscribeConnection(onState: (connected: boolean) => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const channel = sb.channel("qr-order-status").subscribe((status) => {
    onState(status === "SUBSCRIBED");
  });
  return () => {
    sb.removeChannel(channel);
  };
}

/* ============================================================
   書き込み
   ============================================================ */

/** Supabaseクエリを実行し、エラーがあればログして false を返す（成功/未設定は true）。
 *  呼び出し側(store)はこの戻り値で成否を判定し、失敗時はトースト表示や状態の巻き戻しを行う。 */
async function ok(promise: PromiseLike<{ error: { message: string } | null }>, label: string): Promise<boolean> {
  const { error } = await promise;
  if (error) {
    console.error(`${label}:`, error.message);
    return false;
  }
  return true;
}

async function decrementStockDb(items: { menuItemId: string; qty: number }[], menu: MenuItem[]) {
  const sb = getSupabase();
  if (!sb) return;
  await Promise.all(
    items.map((it) => {
      const m = menu.find((x) => x.id === it.menuItemId);
      if (!m) return Promise.resolve();
      return sb.from("menu_items").update({ stock: Math.max(0, m.stock - it.qty) }).eq("id", it.menuItemId);
    })
  );
}

/** 注文を作成（明細も）。作成した order の id を返す。在庫も減算 */
export async function dbInsertOrder(
  tableId: string,
  items: OrderItem[],
  proxy: boolean,
  menu: MenuItem[]
): Promise<string | null> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return null;
  const { data, error } = await sb
    .from("orders")
    .insert({ store_id: STORE_ID, table_id: tableId, status: "cooking", proxy })
    .select("id")
    .single();
  if (error || !data) {
    console.error("dbInsertOrder:", error?.message);
    return null;
  }
  const orderId = data.id as string;
  await sb.from("order_items").insert(
    items.map((it) => ({
      order_id: orderId,
      menu_item_id: it.menuItemId,
      name: it.name,
      price: it.price,
      qty: it.qty,
    }))
  );
  await decrementStockDb(items, menu);
  return orderId;
}

export type SubmitResult =
  | { ok: true; orderId: string }
  | { ok: false; code: "out_of_stock" | "session" | "rate_limited" | "error"; message: string };

/** Edge Function `submit_order` 経由で注文（冪等・在庫の原子的減算・スナップショットをサーバで保証） */
export async function dbSubmitOrderViaFunction(
  tableId: string,
  items: OrderItem[],
  proxy: boolean,
  idempotencyKey: string,
  token: string | null
): Promise<SubmitResult> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return { ok: false, code: "error", message: "not configured" };
  const payload = items.map((it) => ({ menuItemId: it.menuItemId, qty: it.qty }));
  const { data, error } = await sb.functions.invoke("submit_order", {
    body: { storeId: STORE_ID, tableId, proxy, idempotencyKey, token, items: payload },
  });
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      const b = ctx ? await ctx.json() : null;
      if (b?.error) msg = b.error as string;
    } catch {
      /* ignore */
    }
    const code = /out of stock/i.test(msg)
      ? "out_of_stock"
      : /session expired|invalid token/i.test(msg)
        ? "session"
        : /too many requests/i.test(msg)
          ? "rate_limited"
          : "error";
    return { ok: false, code, message: msg };
  }
  return { ok: true, orderId: (data?.orderId as string) ?? "" };
}

/** 来店セッション開始: QRの k(=qr_token) を照合し、今の session_token を受け取る。
 *  未設定/失敗時は null（＝ローカルのままM1動作、または照合失敗）。 */
export async function dbOpenSession(tableId: string, k: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return null;
  const { data, error } = await sb.rpc("open_session", {
    p_store: STORE_ID,
    p_table: tableId,
    p_k: k,
  });
  if (error) {
    console.error("dbOpenSession:", error.message);
    return null;
  }
  return (data as string) ?? null;
}

/** 管理QR画面用: 各卓の qr_token を取得（QRのURL生成に使う）。id→qr_token のマップ。 */
export async function dbFetchTableTokens(): Promise<Record<string, string>> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return {};
  const { data, error } = await sb
    .from("tables")
    .select("id,qr_token")
    .eq("store_id", STORE_ID);
  if (error || !data) return {};
  const map: Record<string, string> = {};
  for (const row of data) map[row.id as string] = (row.qr_token as string) ?? "";
  return map;
}

/** QRトークン再発行（印刷QRを無効化）。新しい qr_token を返す。 */
export async function dbRegenerateToken(tableId: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return null;
  const { data, error } = await sb.rpc("regenerate_table_token", {
    p_store: STORE_ID,
    p_table: tableId,
  });
  if (error) {
    console.error("dbRegenerateToken:", error.message);
    return null;
  }
  return (data as string) ?? null;
}

/** 会計を RPC `close_table` で1トランザクション確定（履歴INSERT+注文DELETE+呼出クリア）。
 *  割引はスタッフがその場で入力する値をそのまま渡す。チャージ料率はDB側のstores設定から
 *  計算するが、今回適用するかどうか(chargeEnabled)はその場で指定する。
 *  金額の最終的な正はサーバーが計算するため、確定した内訳をそのまま返す
 *  （呼び出し側はこれをそのまま表示し、自前で再計算しない）。 */
export async function dbCloseTable(
  tableId: string,
  discountType: DiscountType,
  discountValue: number,
  chargeEnabled: boolean
): Promise<CheckoutRecord | null> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return null;
  const { data, error } = await sb.rpc("close_table", {
    p_store: STORE_ID,
    p_table: tableId,
    p_discount_type: discountType,
    p_discount_value: discountValue,
    p_charge_enabled: chargeEnabled,
  });
  if (error) {
    console.error("dbCloseTable:", error.message);
    return null;
  }
  if (!data) return null; // 対象の注文が無かった場合（v_count=0）
  const c = data as Record<string, unknown>;
  return {
    id: c.id as string,
    tableId: (c.table_id as string) ?? "",
    tableName: c.table_name as string,
    items: (c.items as OrderItem[]) ?? [],
    count: c.count as number,
    subtotal: c.subtotal as number,
    discountType: (c.discount_type as DiscountType) ?? null,
    discountValue: (c.discount_value as number) ?? 0,
    discountAmount: (c.discount_amount as number) ?? 0,
    chargeAmount: (c.charge_amount as number) ?? 0,
    taxAmount: (c.tax_amount as number) ?? 0,
    total: c.total as number,
    closedAt: c.closed_at as string,
  };
}

export async function dbSetOrderStatus(orderId: string, status: "cooking" | "served"): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return true;
  return ok(sb.from("orders").update({ status }).eq("id", orderId), "dbSetOrderStatus");
}

/** 会計（Edge Function未使用時の直接書込フォールバック）: 会計履歴を記録し、その卓の注文を削除 */
export async function dbCheckout(record: {
  tableId: string;
  tableName: string;
  items: OrderItem[];
  count: number;
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  chargeAmount: number;
  taxAmount: number;
  total: number;
}): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return true;
  const r1 = await ok(
    sb.from("checkouts").insert({
      store_id: STORE_ID,
      table_id: record.tableId,
      table_name: record.tableName,
      items: record.items,
      count: record.count,
      subtotal: record.subtotal,
      discount_type: record.discountType,
      discount_value: record.discountValue,
      discount_amount: record.discountAmount,
      charge_amount: record.chargeAmount,
      tax_amount: record.taxAmount,
      total: record.total,
    }),
    "dbCheckout(insert)"
  );
  const r2 = await ok(
    sb.from("orders").delete().eq("store_id", STORE_ID).eq("table_id", record.tableId),
    "dbCheckout(delete orders)"
  );
  const r3 = await ok(
    sb.from("staff_calls").delete().eq("store_id", STORE_ID).eq("table_id", record.tableId).is("resolved_at", null),
    "dbCheckout(delete calls)"
  );
  return r1 && r2 && r3;
}

/** 明細を1個取消（対象卓の最初の該当明細を減算/削除し、在庫を1戻す） */
export async function dbCancelUnit(tableId: string, menuItemId: string, orders: Order[], menu: MenuItem[]): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return true;
  // 対象卓の注文から、該当 menu_item の order_item を1件特定
  const target = orders
    .filter((o) => o.table === tableId)
    .flatMap((o) => o.items.map((it) => ({ orderId: o.id, it })))
    .find((x) => x.it.menuItemId === menuItemId);
  if (!target) return true; // 対象なし＝ローカル状態と既に一致（失敗ではない）
  // order_items の該当行を取得（order_id + menu_item_id）
  const { data, error: selErr } = await sb
    .from("order_items")
    .select("id,qty")
    .eq("order_id", target.orderId)
    .eq("menu_item_id", menuItemId)
    .limit(1);
  if (selErr) {
    console.error("dbCancelUnit(select):", selErr.message);
    return false;
  }
  const row = data?.[0];
  if (!row) return true;
  let stepOk: boolean;
  if ((row.qty as number) > 1) {
    stepOk = await ok(
      sb.from("order_items").update({ qty: (row.qty as number) - 1 }).eq("id", row.id as string),
      "dbCancelUnit(update qty)"
    );
  } else {
    stepOk = await ok(sb.from("order_items").delete().eq("id", row.id as string), "dbCancelUnit(delete item)");
    // その注文に明細が残っていなければ注文ごと削除
    const { count } = await sb.from("order_items").select("*", { count: "exact", head: true }).eq("order_id", target.orderId);
    if (!count) stepOk = (await ok(sb.from("orders").delete().eq("id", target.orderId), "dbCancelUnit(delete order)")) && stepOk;
  }
  // 在庫を1戻す
  const m = menu.find((x) => x.id === menuItemId);
  const stockOk = m
    ? await ok(sb.from("menu_items").update({ stock: m.stock + 1 }).eq("id", menuItemId), "dbCancelUnit(restock)")
    : true;
  return stepOk && stockOk;
}

export async function dbInsertCall(tableId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return true;
  return ok(sb.from("staff_calls").insert({ store_id: STORE_ID, table_id: tableId }), "dbInsertCall");
}

export async function dbResolveCall(callId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return true;
  return ok(sb.from("staff_calls").update({ resolved_at: new Date().toISOString() }).eq("id", callId), "dbResolveCall");
}

/* ---- 店舗設定 ---- */
export async function dbUpdateStore(patch: Record<string, unknown>): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return true;
  return ok(sb.from("stores").update(patch).eq("id", STORE_ID), "dbUpdateStore");
}

/* ---- メニュー管理 ---- */
export async function dbUpdateMenu(id: string, patch: Record<string, unknown>): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return true;
  return ok(sb.from("menu_items").update(patch).eq("id", id), "dbUpdateMenu");
}

export async function dbInsertMenu(item: { name: string; cat: string; price: number; stock: number; sort: number }): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return true;
  return ok(sb.from("menu_items").insert({ store_id: STORE_ID, sold_out: false, ...item }), "dbInsertMenu");
}

export async function dbDeleteMenu(ids: string[]): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return true;
  return ok(sb.from("menu_items").delete().in("id", ids), "dbDeleteMenu");
}

export async function dbReorderMenu(idsInOrder: string[]): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return true;
  const results = await Promise.all(
    idsInOrder.map((id, i) => ok(sb.from("menu_items").update({ sort: i }).eq("id", id), "dbReorderMenu"))
  );
  return results.every(Boolean);
}

/* ---- カテゴリ管理 ---- */
export async function dbInsertCategory(name: string, sort: number): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return true;
  return ok(sb.from("categories").insert({ store_id: STORE_ID, name, sort }), "dbInsertCategory");
}

/** カテゴリ名を変更。menu_items.cat への複合FK(ON UPDATE CASCADE)により、
 *  紐づくメニューのカテゴリはDB側で自動的に追従する（アプリ側での付け替えは不要）。 */
export async function dbRenameCategory(oldName: string, newName: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return true;
  return ok(
    sb.from("categories").update({ name: newName }).eq("store_id", STORE_ID).eq("name", oldName),
    "dbRenameCategory"
  );
}

/** カテゴリを削除。先にそのカテゴリのメニューを「その他」へ書き換えてから削除する */
export async function dbDeleteCategory(name: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return true;
  let reassignOk = true;
  if (name !== "その他") {
    reassignOk = await ok(
      sb.from("menu_items").update({ cat: "その他" }).eq("store_id", STORE_ID).eq("cat", name),
      "dbDeleteCategory(reassign)"
    );
  }
  const deleteOk = await ok(
    sb.from("categories").delete().eq("store_id", STORE_ID).eq("name", name),
    "dbDeleteCategory(delete)"
  );
  return reassignOk && deleteOk;
}

/* ---- テーブル ---- */
export async function dbInsertTable(name: string, sort: number): Promise<string | null> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return null;
  const { data, error } = await sb.from("tables").insert({ store_id: STORE_ID, name, sort }).select("id").single();
  if (error) return null;
  return (data?.id as string) ?? null;
}

export async function dbUpdateTableName(id: string, name: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return true;
  return ok(sb.from("tables").update({ name }).eq("id", id), "dbUpdateTableName");
}

export async function dbDeleteTable(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return true;
  return ok(sb.from("tables").delete().eq("id", id), "dbDeleteTable");
}

export async function dbReorderTables(idsInOrder: string[]): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return true;
  const results = await Promise.all(
    idsInOrder.map((id, i) => ok(sb.from("tables").update({ sort: i }).eq("id", id), "dbReorderTables"))
  );
  return results.every(Boolean);
}
