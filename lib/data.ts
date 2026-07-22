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
  MenuOption,
  SelectedOption,
} from "@/store/useAppStore";

export interface Snapshot {
  storeName: string | null;
  theme: string | null;
  showHeaderPhoto: boolean;
  showFooterPhoto: boolean;
  headerPhoto: string | null;
  footerPhoto: string | null;
  pwaIconUrl: string | null;
  taxMode: TaxMode | null;
  taxRate: number | null;
  chargeRate: number | null;
  categories: string[];
  tables: TableRec[];
  menu: MenuItem[];
  itemOptions: Record<string, MenuOption[]>;
  orders: Order[];
  calls: StaffCall[];
  checkouts: CheckoutRecord[];
}

export interface StoreSettingsSlice {
  storeName: string | null;
  theme: string | null;
  showHeaderPhoto: boolean;
  showFooterPhoto: boolean;
  headerPhoto: string | null;
  footerPhoto: string | null;
  pwaIconUrl: string | null;
  taxMode: TaxMode | null;
  taxRate: number | null;
  chargeRate: number | null;
}

/** 店舗設定のみ取得（Realtime差分更新用の1テーブル分）。
 *  pwa_icon_url は別クエリで取得する（step16未適用のDBでは列が存在せず
 *  selectごと失敗するため、混ぜると「PWAアイコンが無いだけ」で店舗設定
 *  全体＝メニュー/注文/会計の同期まで止まってしまう。分離して耐障害にする）。 */
export async function fetchStoreSettings(): Promise<StoreSettingsSlice | null> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return null;
  const { data, error } = await sb
    .from("stores")
    .select("name,theme,show_header_photo,show_footer_photo,header_photo_url,footer_photo_url,tax_mode,tax_rate,charge_rate")
    .eq("id", STORE_ID)
    .single();
  if (error) {
    console.error("fetchStoreSettings:", error.message);
    return null;
  }
  return {
    storeName: data?.name ?? null,
    theme: data?.theme ?? null,
    showHeaderPhoto: data?.show_header_photo ?? false,
    showFooterPhoto: data?.show_footer_photo ?? false,
    headerPhoto: (data?.header_photo_url as string | null) ?? null,
    footerPhoto: (data?.footer_photo_url as string | null) ?? null,
    pwaIconUrl: await fetchPwaIconUrl(),
    taxMode: (data?.tax_mode as TaxMode | null) ?? null,
    taxRate: (data?.tax_rate as number | null) ?? null,
    chargeRate: (data?.charge_rate as number | null) ?? null,
  };
}

async function fetchPwaIconUrl(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return null;
  const { data, error } = await sb.from("stores").select("pwa_icon_url").eq("id", STORE_ID).single();
  if (error) return null; // 列未追加(step16未適用)や通信失敗はPWAアイコン無しとして扱う
  return (data?.pwa_icon_url as string | null) ?? null;
}

/** カテゴリ一覧のみ取得（Realtime差分更新用の1テーブル分） */
export async function fetchCategories(): Promise<string[] | null> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return null;
  const { data, error } = await sb.from("categories").select("id,name,sort").eq("store_id", STORE_ID).order("sort");
  if (error) {
    console.error("fetchCategories:", error.message);
    return null;
  }
  return (data ?? []).map((c) => c.name as string);
}

/** テーブル(卓)一覧のみ取得（Realtime差分更新用の1テーブル分） */
export async function fetchTables(): Promise<TableRec[] | null> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return null;
  const { data, error } = await sb.from("tables").select("id,name,sort,open_since").eq("store_id", STORE_ID).order("sort");
  if (error) {
    console.error("fetchTables:", error.message);
    return null;
  }
  return (data ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    openSince: (t.open_since as string | null) ?? null,
  }));
}

/** メニュー一覧のみ取得（Realtime差分更新用の1テーブル分） */
export async function fetchMenu(): Promise<MenuItem[] | null> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return null;
  const { data, error } = await sb
    .from("menu_items")
    .select("id,name,cat,price,sold_out,stock,photo_url,sort")
    .eq("store_id", STORE_ID)
    .order("sort");
  if (error) {
    console.error("fetchMenu:", error.message);
    return null;
  }
  return (data ?? []).map((m) => ({
    id: m.id as string,
    name: m.name as string,
    cat: m.cat as Cat,
    price: m.price as number,
    soldOut: m.sold_out as boolean,
    stock: m.stock as number,
    photo: (m.photo_url as string | null) ?? null,
  }));
}

/** 商品ごとのオプションを取得し、商品idをキーにまとめる（Realtime差分更新用の1テーブル分）。
 *  失敗しても null を返さず空で返す。オプションは「あれば使う」追加機能であり、
 *  ここで null を返すと loadSnapshot 全体が失敗扱いになって、メニュー・注文・会計まで
 *  同期が止まってしまうため（step15未適用の環境でも他機能は動き続ける必要がある）。 */
export async function fetchItemOptions(): Promise<Record<string, MenuOption[]>> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return {};
  // store_id 列を持たないため、自店舗の商品idで絞り込む
  const { data: items, error: e1 } = await sb
    .from("menu_items")
    .select("id")
    .eq("store_id", STORE_ID);
  if (e1) {
    console.error("fetchItemOptions(menu):", e1.message);
    return {};
  }
  const ids = (items ?? []).map((m) => m.id as string);
  if (ids.length === 0) return {};
  const { data, error } = await sb
    .from("menu_item_options")
    .select("id,menu_item_id,name,price_delta,sort")
    .in("menu_item_id", ids)
    .order("sort");
  if (error) {
    console.error("fetchItemOptions:", error.message);
    return {};
  }
  const map: Record<string, MenuOption[]> = {};
  for (const r of data ?? []) {
    const k = r.menu_item_id as string;
    (map[k] ||= []).push({
      id: r.id as string,
      name: r.name as string,
      priceDelta: (r.price_delta as number) ?? 0,
      sort: (r.sort as number) ?? 0,
    });
  }
  return map;
}

/** 未会計の注文(明細つき)のみ取得（Realtime差分更新用。ordersとorder_items両方をカバー） */
export async function fetchOrders(): Promise<Order[] | null> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return null;
  const { data, error } = await sb
    .from("orders")
    .select("id,table_id,status,proxy,created_at,checked_out_at, order_items(menu_item_id,name,price,qty,options)")
    .eq("store_id", STORE_ID)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("fetchOrders:", error.message);
    return null;
  }
  return (data ?? []).map((o) => ({
    id: o.id as string,
    table: o.table_id as string,
    createdAt: o.created_at as string,
    status: o.status as Order["status"],
    proxy: (o.proxy as boolean) || undefined,
    checkedOutAt: (o.checked_out_at as string | null) ?? undefined,
    items: ((o.order_items ?? []) as Array<Record<string, unknown>>).map((it) => ({
      menuItemId: (it.menu_item_id as string) ?? "",
      name: it.name as string,
      price: it.price as number,
      qty: it.qty as number,
      options: (it.options as SelectedOption[] | null) ?? [],
    })) as OrderItem[],
  }));
}

/** 未対応のスタッフ呼び出しのみ取得（Realtime差分更新用の1テーブル分） */
export async function fetchCalls(): Promise<StaffCall[] | null> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return null;
  const { data, error } = await sb
    .from("staff_calls")
    .select("id,table_id,created_at")
    .eq("store_id", STORE_ID)
    .is("resolved_at", null);
  if (error) {
    console.error("fetchCalls:", error.message);
    return null;
  }
  return (data ?? []).map((c) => ({
    id: c.id as string,
    table: c.table_id as string,
    createdAt: c.created_at as string,
  }));
}

/** 会計履歴のみ取得（Realtime差分更新用の1テーブル分） */
export async function fetchCheckouts(): Promise<CheckoutRecord[] | null> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return null;
  const { data, error } = await sb
    .from("checkouts")
    .select("id,table_id,table_name,items,count,subtotal,discount_type,discount_value,discount_amount,charge_amount,tax_amount,total,closed_at")
    .eq("store_id", STORE_ID)
    .order("closed_at", { ascending: false });
  if (error) {
    console.error("fetchCheckouts:", error.message);
    return null;
  }
  return (data ?? []).map((c) => ({
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
  }));
}

/** 店舗の全業務データをDBから取得してストア形状にマップ（初回ロード・ポーリング用の全件取得） */
export async function loadSnapshot(): Promise<Snapshot | null> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return null;

  const [store, categories, tables, menu, itemOptions, orders, calls, checkouts] =
    await Promise.all([
      fetchStoreSettings(),
      fetchCategories(),
      fetchTables(),
      fetchMenu(),
      fetchItemOptions(),
      fetchOrders(),
      fetchCalls(),
      fetchCheckouts(),
    ]);

  // どれか1つでも取得失敗したら（部分的に古いデータのまま反映せず）全体を失敗扱いにする
  // itemOptions は失敗しても空で返る設計なので、ここでの判定対象に含めない
  if (
    !store || categories == null || tables == null || menu == null ||
    orders == null || calls == null || checkouts == null
  ) {
    return null;
  }

  return { ...store, categories, tables, menu, itemOptions, orders, calls, checkouts };
}

/** Realtimeで変化があったテーブル名（"orders"等）を都度通知する。
 *  デバウンスして「変わったテーブルだけ」再取得するのは呼び出し側(SupabaseSync)の責務。 */
export function subscribeRealtime(onChange: (table: string) => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const tables = ["stores", "categories", "tables", "menu_items", "menu_item_options", "orders", "order_items", "staff_calls", "checkouts"];
  let channel = sb.channel("qr-order-changes");
  for (const t of tables) {
    channel = channel.on("postgres_changes", { event: "*", schema: "public", table: t }, () => onChange(t));
  }
  channel.subscribe();
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
      options: it.options ?? [],
    }))
  );
  await decrementStockDb(items, menu);
  return orderId;
}

export type SubmitResult =
  | { ok: true; orderId: string }
  | { ok: false; code: "out_of_stock" | "session" | "rate_limited" | "closed" | "error"; message: string };

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
  // 送るのは optionIds だけ。追加料金は place_order がDBから引く（クライアント申告は信用しない）
  const payload = items.map((it) => ({
    menuItemId: it.menuItemId,
    qty: it.qty,
    optionIds: (it.options ?? []).map((o) => o.id),
  }));
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
      : /table closed/i.test(msg)
        ? "closed"
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
    // 卓が閉じている(来店受付前)のは正常系。UI側はtables.open_sinceで待機画面を出す
    if (!/table closed/i.test(error.message)) console.error("dbOpenSession:", error.message);
    return null;
  }
  return (data as string) ?? null;
}

/** 管理QR画面用: 各卓の qr_token を取得（QRのURL生成に使う）。id→qr_token のマップ。
 *  qr_token列はauthenticatedからも直接select不可(RLS/GRANTで封鎖済み)のため、
 *  staff_store_id()で自店舗に絞る fetch_table_tokens() RPC 経由で取得する。 */
export async function dbFetchTableTokens(): Promise<Record<string, string>> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return {};
  const { data, error } = await sb.rpc("fetch_table_tokens");
  if (error || !data) return {};
  const map: Record<string, string> = {};
  for (const row of data as Array<{ id: string; qr_token: string }>) map[row.id] = row.qr_token ?? "";
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

/** 明細を1個取消（対象卓の最初の該当明細を減算/削除し、在庫を1戻す）。
 *  cancel_order_item() RPCで「行ロック→減算/削除→在庫戻し」を1トランザクションに
 *  まとめている（従来は3リクエストに分かれており同時操作でズレる理論上の余地があった）。 */
export async function dbCancelUnit(
  tableId: string,
  menuItemId: string,
  orders: Order[],
  options: SelectedOption[] = []
): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return true;
  // 対象卓の注文から、該当 menu_item かつ「同じオプションの組み合わせ」の order_item を
  // 1件特定する（どの注文から引くか、はクライアント側の状態で決める）。
  const key = optionsKeyOf(options);
  const target = orders
    .filter((o) => o.table === tableId)
    .flatMap((o) => o.items.map((it) => ({ orderId: o.id, it })))
    .find((x) => x.it.menuItemId === menuItemId && optionsKeyOf(x.it.options) === key);
  if (!target) return true; // 対象なし＝ローカル状態と既に一致（失敗ではない）
  return ok(
    sb.rpc("cancel_order_item", {
      p_order: target.orderId,
      p_menu_item: menuItemId,
      p_options: options,
    }),
    "dbCancelUnit"
  );
}

/** SQL側 options_key() と同じ正規化（id昇順のカンマ連結）。取消対象の突合に使う。 */
function optionsKeyOf(options?: SelectedOption[] | null): string {
  return (options ?? []).map((o) => o.id).sort().join(",");
}

/** 来店受付: 卓を開く（step17）。成功時は開いた時刻、失敗時はnull */
export async function dbOpenTable(tableId: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return new Date().toISOString(); // 未設定(ローカル開発)は常に成功扱い
  const { data, error } = await sb.rpc("open_table", { p_store: STORE_ID, p_table: tableId });
  if (error) {
    console.error("dbOpenTable:", error.message);
    return null;
  }
  return (data as string) ?? new Date().toISOString();
}

/** 誤タップで開いた卓を閉じ直す（step17） */
export async function dbCloseTableGate(tableId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return true;
  return ok(sb.rpc("close_table_gate", { p_store: STORE_ID, p_table: tableId }), "dbCloseTableGate");
}

/** 会計済み・未提供の繰越伝票を提供完了として削除する（step17。在庫は戻さない） */
export async function dbFinishCheckedOutOrder(orderId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return true;
  return ok(sb.rpc("finish_checked_out_order", { p_order: orderId }), "dbFinishCheckedOutOrder");
}

/** 会計履歴を全消去（自店舗分のみ）。取り消せないため呼び出し側で複数回確認すること。
 *  何件・誰が・いつ消したかはDB側(checkout_deletion_log)に必ず記録される。
 *  失敗時はnull、成功時は削除した件数を返す。 */
export async function dbClearCheckoutHistory(): Promise<number | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc("clear_checkout_history");
  if (error) {
    console.error("dbClearCheckoutHistory:", error.message);
    return null;
  }
  return (data as number) ?? 0;
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

/* ---- オプション管理（商品ごとの個別設定） ---- */
/** 商品にオプションを追加。成功時は採番されたidを返す（失敗時null） */
export async function dbInsertItemOption(
  menuItemId: string,
  name: string,
  priceDelta: number,
  sort: number
): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("menu_item_options")
    .insert({ menu_item_id: menuItemId, name, price_delta: priceDelta, sort })
    .select("id")
    .single();
  if (error || !data) {
    console.error("dbInsertItemOption:", error?.message);
    return null;
  }
  return data.id as string;
}

export async function dbUpdateItemOption(
  id: string,
  patch: { name?: string; price_delta?: number }
): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return true;
  return ok(sb.from("menu_item_options").update(patch).eq("id", id), "dbUpdateItemOption");
}

/** オプションを削除。既存注文の order_items.options はスナップショットなので影響を受けない。 */
export async function dbDeleteItemOption(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return true;
  return ok(sb.from("menu_item_options").delete().eq("id", id), "dbDeleteItemOption");
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
