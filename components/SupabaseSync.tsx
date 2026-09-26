"use client";

import { useEffect, useRef } from "react";
import { useAppStore, type Order, type StaffCall } from "@/store/useAppStore";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  loadSnapshot,
  fetchStoreSettings,
  fetchCategories,
  fetchTables,
  fetchMenu,
  fetchItemOptions,
  fetchOrders,
  fetchCalls,
  fetchCheckouts,
  subscribeRealtime,
  subscribeConnection,
  subscribeStoreBroadcast,
} from "@/lib/data";
import { mergeFresherRemote, pruneRemote, type RemoteEntry } from "@/lib/remoteMerge";

// Broadcastで届いた行を控えておく時間。再取得1回ぶん（通常0.1秒前後）を十分に上回ればよい。
const REMOTE_TTL_MS = 60_000;

// Realtimeで通知されたテーブル名 → 再取得すべきスナップショットの区分
const TABLE_TO_SLICE: Record<string, string> = {
  stores: "store",
  categories: "categories",
  tables: "tables",
  menu_items: "menu",
  menu_item_options: "options",
  orders: "orders",
  order_items: "orders", // 明細もordersと同じ区分（orders側にJOINして取得するため）
  staff_calls: "calls",
  checkouts: "checkouts",
};

/**
 * Supabase が設定されていれば、業務データをDBから読み込み、
 * 変更をリアルタイム購読（+ポーリングのフォールバック）でストアに反映する。
 * 未設定なら何もしない（アプリはローカルのまま動く）。
 *
 * Realtime通知は「変わったテーブルだけ」を再取得する（docs/04 B-2の全件再取得から変更）。
 * 例えば客が1件注文しても、メニュー・会計履歴・カテゴリ等の無関係なテーブルは再取得しない。
 * 初回ロードとポーリングのフォールバックは、取りこぼし防止のため引き続き全件取得する。
 *
 * staff（管理画面）では、DBが注文確定・呼び出し作成と同時に送る中身入りBroadcast（step20）も
 * 購読し、取り直しを待たずに即反映する。上記の購読・ポーリングはその安全網として残す。
 */
export default function SupabaseSync({ staff = false }: { staff?: boolean }) {
  const hydrate = useAppStore((s) => s.hydrate);
  const setConnected = useAppStore((s) => s.setConnected);
  const applyRemoteOrder = useAppStore((s) => s.applyRemoteOrder);
  const applyRemoteCall = useAppStore((s) => s.applyRemoteCall);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSlices = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    const remoteOrders = new Map<string, RemoteEntry<Order>>();
    const remoteCalls = new Map<string, RemoteEntry<StaffCall>>();

    // 取得開始より後にBroadcastで届いた注文・呼び出しを、古い取得結果で消さない
    const withRemote = <T extends { orders: Order[] | null; calls: StaffCall[] | null }>(
      snap: T,
      startedAt: number
    ): T => {
      pruneRemote(remoteOrders, Date.now(), REMOTE_TTL_MS);
      pruneRemote(remoteCalls, Date.now(), REMOTE_TTL_MS);
      return {
        ...snap,
        orders: snap.orders && mergeFresherRemote(snap.orders, remoteOrders, startedAt),
        calls: snap.calls && mergeFresherRemote(snap.calls, remoteCalls, startedAt),
      };
    };

    const fullReload = async () => {
      const startedAt = Date.now();
      const snap = await loadSnapshot();
      if (!cancelled && snap) hydrate(withRemote(snap, startedAt));
    };

    const partialReload = async () => {
      const slices = pendingSlices.current;
      pendingSlices.current = new Set();
      if (slices.size === 0) return;
      const startedAt = Date.now();

      // メニューが増減すると対象商品も変わるため、options は menu 変更時も取り直す
      const needOptions = slices.has("options") || slices.has("menu");
      const [store, categories, tables, menu, itemOptions, orders, calls, checkouts] =
        await Promise.all([
          slices.has("store") ? fetchStoreSettings() : null,
          slices.has("categories") ? fetchCategories() : null,
          slices.has("tables") ? fetchTables() : null,
          slices.has("menu") ? fetchMenu() : null,
          needOptions ? fetchItemOptions() : null,
          slices.has("orders") ? fetchOrders() : null,
          slices.has("calls") ? fetchCalls() : null,
          slices.has("checkouts") ? fetchCheckouts() : null,
        ]);
      if (cancelled) return;
      const fresh = withRemote({ orders, calls }, startedAt);

      // 変わっていない区分は現在のstateをそのまま使う（取得もしない＝差分更新の要）
      const cur = useAppStore.getState();
      hydrate({
        storeName: store?.storeName ?? cur.settings.storeName,
        theme: store?.theme ?? cur.settings.theme,
        showHeaderPhoto: store?.showHeaderPhoto ?? cur.settings.showHeaderPhoto,
        showFooterPhoto: store?.showFooterPhoto ?? cur.settings.showFooterPhoto,
        headerPhoto: store?.headerPhoto ?? cur.settings.headerPhoto,
        footerPhoto: store?.footerPhoto ?? cur.settings.footerPhoto,
        pwaIconUrl: store?.pwaIconUrl ?? cur.settings.pwaIconUrl,
        taxMode: store?.taxMode ?? cur.settings.taxMode,
        taxRate: store?.taxRate ?? cur.settings.taxRate,
        chargeRate: store?.chargeRate ?? cur.settings.chargeRate,
        squarePosMode: store?.squarePosMode ?? cur.settings.squarePosMode,
        squareApplicationId: store?.squareApplicationId ?? cur.settings.squareApplicationId,
        squareLocationId: store?.squareLocationId ?? cur.settings.squareLocationId,
        orderMode: store?.orderMode ?? cur.settings.orderMode,
        trackStock: store?.trackStock ?? cur.settings.trackStock,
        categories: categories ?? cur.categories,
        tables: tables ?? cur.tables,
        menu: menu ?? cur.menu,
        itemOptions: itemOptions ?? cur.itemOptions,
        orders: fresh.orders ?? cur.orders,
        calls: fresh.calls ?? cur.calls,
        checkouts: checkouts ?? cur.checkouts,
      });
    };

    fullReload(); // 初回ロードのみ全件取得

    const debounced = (table: string) => {
      pendingSlices.current.add(TABLE_TO_SLICE[table] ?? table);
      if (timer.current) clearTimeout(timer.current);
      // orders/order_itemsの連続イベントを1回のfetchにまとめる待ち時間。
      // 短すぎるとイベントが分裂してfetch回数が増え、長すぎると体感ラグになる。
      timer.current = setTimeout(partialReload, 150);
    };
    const unsubRealtime = subscribeRealtime(debounced);
    const unsubConn = subscribeConnection(setConnected);
    const unsubBroadcast = staff
      ? subscribeStoreBroadcast({
          onOrder: (order) => {
            remoteOrders.set(order.id, { item: order, receivedAt: Date.now() });
            applyRemoteOrder(order);
          },
          onCall: (call) => {
            remoteCalls.set(call.id, { item: call, receivedAt: Date.now() });
            applyRemoteCall(call);
          },
        })
      : () => {};

    // ポーリングのフォールバック（Realtimeが切れても最悪拾う。安全網なので全件取得のまま）
    const poll = setInterval(fullReload, 20000);

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      unsubRealtime();
      unsubConn();
      unsubBroadcast();
      clearInterval(poll);
    };
  }, [hydrate, setConnected, applyRemoteOrder, applyRemoteCall, staff]);

  return null;
}
