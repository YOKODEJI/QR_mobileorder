"use client";

import { create } from "zustand";
import * as db from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase";

/** 新規エンティティのID: 未設定uuid。Supabase書き込みが返すidがあればそちらを優先 */
function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "local-" + Math.random().toString(36).slice(2);
}

/* ============================================================
   型定義（_planning/02-data-model.md 準拠。M1はローカル状態）
   ============================================================ */
export type Cat = "ドリンク" | "一品料理" | "刺身" | "揚げ物" | "〆";
export type CatFilter = "すべて" | Cat;
export type Status = "cooking" | "served";

export interface MenuItem {
  id: string;
  name: string;
  cat: Cat;
  price: number;
  soldOut: boolean;
  stock: number;
  photo: string | null;
}

export interface OrderItem {
  menuItemId: string; // 商品ID参照（名前一致に依存しない）
  name: string; // 注文時点の名称スナップショット
  qty: number;
  price: number; // 注文時点の価格スナップショット
}

export interface Order {
  id: string; // uuid（Supabase）またはローカル生成uuid
  table: string; // table id
  createdAt: string; // ISO文字列（表示はhm()で整形、経過はelapsedMin()）
  status: Status;
  items: OrderItem[];
  proxy?: boolean;
}

export interface TableRec {
  id: string;
  name: string;
}

export interface StaffCall {
  id: string;
  table: string;
  createdAt: string;
}

/** 会計履歴（セッション締め時のスナップショット。永続的に閲覧可能） */
export interface CheckoutRecord {
  id: string;
  tableId: string;
  tableName: string; // 会計時点の卓名スナップショット（後で改名/削除されても残す）
  items: OrderItem[]; // 品目名で集約済みのスナップショット
  count: number;
  total: number;
  closedAt: string; // ISO
}

export interface Settings {
  storeName: string;
  theme: string;
  showHeaderPhoto: boolean;
  showFooterPhoto: boolean;
}

export interface DialogSpec {
  title: string;
  body: string;
  confirmText: string;
  danger: boolean;
  onConfirm: () => void;
}

export const CATS: Cat[] = ["ドリンク", "一品料理", "刺身", "揚げ物", "〆"];
export const CAT_FILTERS: CatFilter[] = ["すべて", ...CATS];

/* ============================================================
   状態 + アクション
   ============================================================ */
interface AppState {
  // ナビ
  topTab: "customer" | "mgmt";
  mgmtTab: "kitchen" | "staff" | "menu" | "history";
  // 設定
  settings: Settings;
  showSettings: boolean;
  // カテゴリフィルタ
  customerCat: CatFilter;
  proxyCat: CatFilter;
  adminCat: CatFilter;
  // カート
  cart: Record<string, number>;
  staffCart: Record<string, number>;
  // テーブル
  customerTableId: string;
  tables: TableRec[];
  tableEditMode: boolean;
  editingTableId: string | null;
  editTableName: string;
  justAddedTableId: string | null; // 追加直後、視認性のため先頭に表示する卓
  dragTableId: string | null; // テーブル並び替えのドラッグ中ID
  // 業務データ
  orders: Order[];
  menu: MenuItem[];
  calls: StaffCall[];
  checkouts: CheckoutRecord[]; // 会計履歴（永続）
  // 厨房 / 接続
  connected: boolean;
  soundOn: boolean;
  highlightId: string | null;
  // データ層
  loaded: boolean; // Supabaseからの初回読込が完了したか
  // UI一時状態
  submitting: boolean;
  justOrdered: boolean;
  showHistory: boolean;
  selectedStaffTable: string | null;
  // メニュー管理
  deleteMode: boolean;
  selectedIds: string[];
  dragId: string | null;
  // メニュー追加フォーム
  newName: string;
  newCat: Cat;
  newPrice: string;
  newStock: string;
  // 汎用ダイアログ
  dialog: DialogSpec | null;

  // ---- データ層（Supabase） ----
  hydrate: (snap: {
    storeName: string | null;
    theme: string | null;
    showHeaderPhoto: boolean;
    showFooterPhoto: boolean;
    tables: TableRec[];
    menu: MenuItem[];
    orders: Order[];
    calls: StaffCall[];
    checkouts: CheckoutRecord[];
  }) => void;
  setConnected: (v: boolean) => void;
  setCustomerTable: (id: string) => void;

  // ---- ヘルパー ----
  yen: (n: number) => string;
  tableName: (id: string) => string;
  avail: (m: MenuItem) => boolean;

  // ---- ナビ ----
  setTop: (t: AppState["topTab"]) => void;
  setMgmt: (t: AppState["mgmtTab"]) => void;
  setCustomerCat: (c: CatFilter) => void;
  setProxyCat: (c: CatFilter) => void;
  setAdminCat: (c: CatFilter) => void;

  // ---- カート ----
  addCart: (id: string) => void;
  removeCart: (id: string) => void;
  addStaff: (id: string) => void;
  removeStaff: (id: string) => void;

  // ---- 注文 ----
  confirmOrder: () => void;
  submitOrder: () => void;
  submitProxy: () => void;
  dismissSuccess: () => void;

  // ---- スタッフ呼び出し ----
  confirmCallStaff: () => void;
  callStaff: () => void;
  confirmClearCall: (id: string) => void;
  clearCall: (id: string) => void;

  // ---- 厨房 ----
  confirmStatus: (o: Order) => void;
  toggleSound: () => void;
  toggleConnection: () => void;

  // ---- 会計 / テーブル ----
  selectStaffTable: (id: string) => void;
  confirmCheckout: () => void;
  checkout: () => void;
  cancelUnit: (menuItemId: string) => void;
  setTableEditMode: (v: boolean) => void;
  addTable: () => void;
  startEditTable: (id: string) => void;
  setEditTableName: (v: string) => void;
  saveEditTable: () => void;
  confirmDeleteTable: (id: string) => void;
  // テーブル並び替え
  dragStartTable: (id: string) => void;
  dragEndTable: () => void;
  dropOnTable: (targetId: string) => void;

  // ---- メニュー管理 ----
  setPrice: (id: string, val: string) => void;
  setStock: (id: string, val: string) => void;
  bumpStock: (id: string, d: number) => void;
  toggleSoldOut: (id: string) => void;
  setNewField: (k: "newName" | "newPrice" | "newStock", v: string) => void;
  setNewCat: (c: Cat) => void;
  addItem: () => void;
  setPhoto: (id: string, url: string) => void;
  removePhoto: (id: string) => void;
  // 並び替え
  dragStart: (id: string) => void;
  dragEnd: () => void;
  dropOn: (targetId: string) => void;
  // 削除
  enterDeleteMode: () => void;
  cancelDeleteMode: () => void;
  toggleSelect: (id: string) => void;
  requestDelete: () => void;

  // ---- 設定 / ダイアログ ----
  setSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
  openSettings: () => void;
  closeSettings: () => void;
  toggleHistory: (v: boolean) => void;
  closeDialog: () => void;
}

let audioCtx: AudioContext | null = null;
function playBeep(soundOn: boolean) {
  if (!soundOn) return;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = audioCtx || (audioCtx = new AC());
    if (ctx.state === "suspended") ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.start();
    o.stop(ctx.currentTime + 0.42);
  } catch {
    /* noop */
  }
}

/** カート（id→qty）から注文明細を生成。menuItemIdと当時の名前/価格スナップショットを持たせる */
function buildItems(
  cart: Record<string, number>,
  menu: MenuItem[]
): OrderItem[] {
  return Object.keys(cart)
    .map((id) => {
      const m = menu.find((x) => x.id === id);
      if (!m) return null;
      return { menuItemId: id, name: m.name, qty: cart[id], price: m.price };
    })
    .filter((x): x is OrderItem => x !== null);
}

/** 注文された分だけ在庫を減らす（0未満にはしない） */
function decrementStock(menu: MenuItem[], items: OrderItem[]): MenuItem[] {
  const dec: Record<string, number> = {};
  items.forEach((it) => {
    dec[it.menuItemId] = (dec[it.menuItemId] || 0) + it.qty;
  });
  return menu.map((m) =>
    dec[m.id] ? { ...m, stock: Math.max(0, m.stock - dec[m.id]) } : m
  );
}

export const useAppStore = create<AppState>((set, get) => ({
  topTab: "customer",
  mgmtTab: "kitchen",
  settings: {
    storeName: "居酒屋 灯り",
    theme: "#cf4b2c",
    showHeaderPhoto: false,
    showFooterPhoto: false,
  },
  showSettings: false,
  customerCat: "すべて",
  proxyCat: "すべて",
  adminCat: "すべて",
  cart: {},
  staffCart: {},
  customerTableId: "t5",
  tables: [
    { id: "t1", name: "テーブル 1" },
    { id: "t2", name: "テーブル 2" },
    { id: "t3", name: "テーブル 3" },
    { id: "t4", name: "テーブル 4" },
    { id: "t5", name: "テーブル 5" },
    { id: "t6", name: "テーブル 6" },
    { id: "t7", name: "カウンター A" },
    { id: "t8", name: "個室 松" },
  ],
  tableEditMode: false,
  editingTableId: null,
  editTableName: "",
  justAddedTableId: null,
  dragTableId: null,
  orders: [
    {
      id: "o1",
      table: "t3",
      createdAt: new Date(Date.now() - 18 * 60000).toISOString(),
      status: "cooking",
      items: [
        { menuItemId: "beer", name: "生ビール", qty: 2, price: 550 },
        { menuItemId: "edamame", name: "枝豆", qty: 1, price: 380 },
        { menuItemId: "karaage", name: "鶏の唐揚げ", qty: 1, price: 580 },
      ],
    },
    {
      id: "o2",
      table: "t7",
      createdAt: new Date(Date.now() - 6 * 60000).toISOString(),
      status: "served",
      items: [
        { menuItemId: "high", name: "ハイボール", qty: 1, price: 450 },
        { menuItemId: "gyoza", name: "餃子", qty: 2, price: 480 },
      ],
    },
  ],
  menu: [
    { id: "beer", name: "生ビール", cat: "ドリンク", price: 550, soldOut: false, stock: 80, photo: null },
    { id: "high", name: "ハイボール", cat: "ドリンク", price: 450, soldOut: false, stock: 80, photo: null },
    { id: "edamame", name: "枝豆", cat: "一品料理", price: 380, soldOut: false, stock: 40, photo: null },
    { id: "caesar", name: "シーザーサラダ", cat: "一品料理", price: 680, soldOut: false, stock: 15, photo: null },
    { id: "gyoza", name: "餃子", cat: "一品料理", price: 480, soldOut: false, stock: 30, photo: null },
    { id: "maguro", name: "マグロ刺身", cat: "刺身", price: 880, soldOut: false, stock: 12, photo: null },
    { id: "moriawase", name: "本日の刺身盛り合わせ", cat: "刺身", price: 1480, soldOut: true, stock: 0, photo: null },
    { id: "karaage", name: "鶏の唐揚げ", cat: "揚げ物", price: 580, soldOut: false, stock: 25, photo: null },
    { id: "potato", name: "ポテトフライ", cat: "揚げ物", price: 420, soldOut: false, stock: 25, photo: null },
    { id: "ramen", name: "締めのラーメン", cat: "〆", price: 780, soldOut: false, stock: 20, photo: null },
  ],
  calls: [],
  checkouts: [
    {
      id: "c1",
      tableId: "t2",
      tableName: "テーブル 2",
      items: [
        { menuItemId: "beer", name: "生ビール", qty: 3, price: 550 },
        { menuItemId: "karaage", name: "鶏の唐揚げ", qty: 2, price: 580 },
        { menuItemId: "edamame", name: "枝豆", qty: 1, price: 380 },
      ],
      count: 6,
      total: 3190,
      closedAt: new Date(Date.now() - 95 * 60000).toISOString(),
    },
    {
      id: "c2",
      tableId: "t6",
      tableName: "テーブル 6",
      items: [
        { menuItemId: "high", name: "ハイボール", qty: 2, price: 450 },
        { menuItemId: "ramen", name: "締めのラーメン", qty: 2, price: 780 },
      ],
      count: 4,
      total: 2460,
      closedAt: new Date(Date.now() - 40 * 60000).toISOString(),
    },
  ],
  connected: true,
  soundOn: false,
  highlightId: null,
  submitting: false,
  justOrdered: false,
  showHistory: false,
  selectedStaffTable: null,
  deleteMode: false,
  selectedIds: [],
  dragId: null,
  newName: "",
  newCat: "ドリンク",
  newPrice: "",
  newStock: "",
  dialog: null,
  loaded: false,

  // ---- データ層（Supabase） ----
  hydrate: (snap) =>
    set((s) => {
      // customerTableId をロードした卓に合わせる（QR未実装のデモは「テーブル 5」→先頭の順で選択）
      const preferred =
        snap.tables.find((t) => t.name === "テーブル 5") ?? snap.tables[0];
      const customerTableId =
        snap.tables.some((t) => t.id === s.customerTableId)
          ? s.customerTableId
          : preferred?.id ?? s.customerTableId;
      return {
        settings: {
          storeName: snap.storeName ?? s.settings.storeName,
          theme: snap.theme ?? s.settings.theme,
          showHeaderPhoto: snap.showHeaderPhoto,
          showFooterPhoto: snap.showFooterPhoto,
        },
        tables: snap.tables,
        menu: snap.menu,
        orders: snap.orders,
        calls: snap.calls,
        checkouts: snap.checkouts,
        customerTableId,
        loaded: true,
      };
    }),
  setConnected: (v) => set({ connected: v }),
  setCustomerTable: (id) => set({ customerTableId: id }),

  // ---- ヘルパー ----
  yen: (n) => "¥" + Number(n).toLocaleString("ja-JP"),
  tableName: (id) => {
    const t = get().tables.find((x) => x.id === id);
    return t ? t.name : "テーブル";
  },
  avail: (m) => !m.soldOut && m.stock > 0,

  // ---- ナビ ----
  setTop: (t) => set({ topTab: t }),
  setMgmt: (t) => set({ mgmtTab: t }),
  setCustomerCat: (c) => set({ customerCat: c }),
  setProxyCat: (c) => set({ proxyCat: c }),
  setAdminCat: (c) => set({ adminCat: c }),

  // ---- カート ----
  addCart: (id) =>
    set((s) => {
      const m = s.menu.find((x) => x.id === id);
      // 在庫を超えてカートに入れない（売切・在庫0も弾く）
      if (!m || m.soldOut || (s.cart[id] || 0) >= m.stock) return {};
      return { cart: { ...s.cart, [id]: (s.cart[id] || 0) + 1 } };
    }),
  removeCart: (id) =>
    set((s) => {
      const c = { ...s.cart };
      const v = (c[id] || 0) - 1;
      if (v <= 0) delete c[id];
      else c[id] = v;
      return { cart: c };
    }),
  addStaff: (id) =>
    set((s) => {
      const m = s.menu.find((x) => x.id === id);
      if (!m || m.soldOut || (s.staffCart[id] || 0) >= m.stock) return {};
      return { staffCart: { ...s.staffCart, [id]: (s.staffCart[id] || 0) + 1 } };
    }),
  removeStaff: (id) =>
    set((s) => {
      const c = { ...s.staffCart };
      const v = (c[id] || 0) - 1;
      if (v <= 0) delete c[id];
      else c[id] = v;
      return { staffCart: c };
    }),

  // ---- 注文 ----
  confirmOrder: () => {
    const s = get();
    const items = buildItems(s.cart, s.menu);
    if (items.length === 0 || s.submitting) return;
    let total = 0;
    let count = 0;
    items.forEach((it) => {
      total += it.price * it.qty;
      count += it.qty;
    });
    const lines = items.map((it) => it.name + " ×" + it.qty).join("\n");
    set({
      dialog: {
        title: "ご注文の確認",
        body: lines + "\n\n合計 " + count + "点 / " + s.yen(total) + "（税込）",
        confirmText: "この内容で注文",
        danger: false,
        onConfirm: () => {
          get().closeDialog();
          get().submitOrder();
        },
      },
    });
  },
  submitOrder: () => {
    const s = get();
    const items = buildItems(s.cart, s.menu);
    if (items.length === 0) return;
    const tableId = s.customerTableId;
    const configured = isSupabaseConfigured();
    set({ submitting: true });
    setTimeout(async () => {
      const menu = get().menu;
      let id: string | null = null;
      if (configured) {
        id = await db.dbInsertOrder(tableId, items, false, menu);
        if (!id) {
          // 送信失敗: 成功演出を出さず、カートを保持して再試行を促す
          set({
            submitting: false,
            dialog: {
              title: "送信できませんでした",
              body: "注文を送信できませんでした。通信環境を確認して、もう一度お試しください。",
              confirmText: "再試行",
              danger: false,
              onConfirm: () => {
                get().closeDialog();
                get().submitOrder();
              },
            },
          });
          return;
        }
      } else {
        id = newId();
      }
      set((st) => ({
        orders: [
          { id: id!, table: tableId, createdAt: new Date().toISOString(), status: "cooking", items },
          ...st.orders,
        ],
        menu: decrementStock(st.menu, items),
        cart: {},
        submitting: false,
        justOrdered: true,
        highlightId: id,
      }));
      playBeep(get().soundOn);
      setTimeout(() => {
        if (get().highlightId === id) set({ highlightId: null });
      }, 2600);
    }, 800);
  },
  submitProxy: async () => {
    const s = get();
    const t = s.selectedStaffTable;
    if (t == null) return;
    const items = buildItems(s.staffCart, s.menu);
    if (items.length === 0) return;
    const menu = s.menu;
    const configured = isSupabaseConfigured();
    let id: string | null = null;
    if (configured) {
      id = await db.dbInsertOrder(t, items, true, menu);
      if (!id) {
        set({
          dialog: {
            title: "送信できませんでした",
            body: "代理注文を送信できませんでした。通信環境を確認して、もう一度お試しください。",
            confirmText: "再試行",
            danger: false,
            onConfirm: () => {
              get().closeDialog();
              get().submitProxy();
            },
          },
        });
        return;
      }
    } else {
      id = newId();
    }
    set((st) => ({
      orders: [
        { id: id!, table: t, createdAt: new Date().toISOString(), status: "cooking", items, proxy: true },
        ...st.orders,
      ],
      menu: decrementStock(st.menu, items),
      staffCart: {},
      highlightId: id,
    }));
    playBeep(get().soundOn);
    setTimeout(() => {
      if (get().highlightId === id) set({ highlightId: null });
    }, 2600);
  },
  dismissSuccess: () => set({ justOrdered: false }),

  // ---- スタッフ呼び出し ----
  confirmCallStaff: () => {
    const s = get();
    // 既に未対応の呼び出しがあれば何もしない（ボタンは無効化済み）
    if (s.calls.some((c) => c.table === s.customerTableId)) return;
    set({
      dialog: {
        title: "スタッフの呼び出し",
        body: "スタッフを呼び出します。よろしいですか？",
        confirmText: "呼び出す",
        danger: false,
        onConfirm: () => {
          get().callStaff();
          get().closeDialog();
        },
      },
    });
  },
  callStaff: () => {
    const st = get();
    // 同一テーブルの未対応呼び出しが既にあれば重複させない
    if (st.calls.some((c) => c.table === st.customerTableId)) return;
    const tableId = st.customerTableId;
    db.dbInsertCall(tableId);
    playBeep(st.soundOn);
    set((s) => ({
      calls: [...s.calls, { id: newId(), table: tableId, createdAt: new Date().toISOString() }],
    }));
  },
  confirmClearCall: (id) => {
    const s = get();
    const call = s.calls.find((c) => c.id === id);
    if (!call) return;
    set({
      dialog: {
        title: s.tableName(call.table) + " の呼び出し",
        body: "この呼び出しを「対応済み」にしますか？",
        confirmText: "対応済みにする",
        danger: false,
        onConfirm: () => {
          get().clearCall(id);
          get().closeDialog();
        },
      },
    });
  },
  clearCall: (id) => {
    db.dbResolveCall(id);
    set((st) => ({ calls: st.calls.filter((c) => c.id !== id) }));
  },

  // ---- 厨房 ----
  confirmStatus: (o) => {
    const to = o.status === "cooking" ? "提供済み" : "調理中";
    set({
      dialog: {
        title: get().tableName(o.table) + " の伝票",
        body: "この伝票を「" + to + "」に変更しますか？",
        confirmText: to + "にする",
        danger: false,
        onConfirm: () => {
          const next: Status = o.status === "cooking" ? "served" : "cooking";
          db.dbSetOrderStatus(o.id, next);
          set((s) => ({
            orders: s.orders.map((x) => (x.id === o.id ? { ...x, status: next } : x)),
          }));
          get().closeDialog();
        },
      },
    });
  },
  toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
  toggleConnection: () => set((s) => ({ connected: !s.connected })),

  // ---- 会計 / テーブル ----
  selectStaffTable: (id) => set({ selectedStaffTable: id }),
  confirmCheckout: () => {
    const s = get();
    const t = s.selectedStaffTable;
    if (t == null) return;
    const total = s.orders
      .filter((o) => o.table === t)
      .reduce(
        (sum, o) => sum + o.items.reduce((x, it) => x + it.price * it.qty, 0),
        0
      );
    set({
      dialog: {
        title: s.tableName(t) + " のお会計",
        body:
          "合計 " +
          s.yen(total) +
          "（税込）でこのテーブルのセッションを締めます。よろしいですか？\n\n※決済は既存レジで実施してください。",
        confirmText: "お会計する",
        danger: false,
        onConfirm: () => {
          get().checkout();
          get().closeDialog();
        },
      },
    });
  },
  checkout: () => {
    const s = get();
    const t = s.selectedStaffTable;
    if (t == null) return;
    const tableOrders = s.orders.filter((o) => o.table === t);
    if (tableOrders.length === 0) {
      set({ selectedStaffTable: null });
      return;
    }
    // 品目を menuItemId+価格で集約してスナップショット化
    const agg: Record<string, OrderItem> = {};
    let total = 0;
    let count = 0;
    tableOrders.forEach((o) =>
      o.items.forEach((it) => {
        const k = it.menuItemId + ":" + it.price;
        if (!agg[k]) agg[k] = { ...it, qty: 0 };
        agg[k].qty += it.qty;
        total += it.price * it.qty;
        count += it.qty;
      })
    );
    const items = Object.values(agg);
    const tableName = s.tableName(t);
    // DBへ: 会計履歴を記録し、その卓の注文を削除
    db.dbCheckout({ tableId: t, tableName, items, count, total });
    const record: CheckoutRecord = {
      id: newId(),
      tableId: t,
      tableName,
      items,
      count,
      total,
      closedAt: new Date().toISOString(),
    };
    set((st) => ({
      checkouts: [record, ...st.checkouts],
      orders: st.orders.filter((o) => o.table !== t),
      calls: st.calls.filter((c) => c.table !== t),
      selectedStaffTable: null,
    }));
  },
  cancelUnit: (menuItemId) => {
    const t = get().selectedStaffTable;
    // DB用に取消前の orders/menu を渡す
    db.dbCancelUnit(t ?? "", menuItemId, get().orders, get().menu);
    set((s) => {
      let done = false;
      const orders = s.orders
        .map((o) => {
          if (o.table !== t) return o;
          const items = o.items
            .map((it) => {
              if (done || it.menuItemId !== menuItemId) return it;
              done = true;
              return { ...it, qty: it.qty - 1 };
            })
            .filter((it) => it.qty > 0);
          return { ...o, items };
        })
        .filter((o) => o.items.length > 0);
      if (!done) return {};
      // 取消した1個ぶんは在庫を戻す（まだ提供前の想定）
      const menu = s.menu.map((m) =>
        m.id === menuItemId ? { ...m, stock: m.stock + 1 } : m
      );
      return { orders, menu };
    });
  },
  setTableEditMode: (v) =>
    set({
      tableEditMode: v,
      editingTableId: null,
      editTableName: "",
      justAddedTableId: null,
    }),
  addTable: async () => {
    const s = get();
    const name = "テーブル " + (s.tables.length + 1);
    const sort = s.tables.length;
    // 並びは末尾に追加（データ順）。追加直後は視認性のため先頭にピン留めし、名前編集状態に。
    const id = (await db.dbInsertTable(name, sort)) ?? newId();
    set((st) => ({
      tables: [...st.tables, { id, name }],
      tableEditMode: true,
      editingTableId: id,
      editTableName: name,
      justAddedTableId: id,
    }));
  },
  startEditTable: (id) => {
    const t = get().tables.find((x) => x.id === id);
    set({ editingTableId: id, editTableName: t ? t.name : "" });
  },
  setEditTableName: (v) => set({ editTableName: v }),
  saveEditTable: () => {
    const id = get().editingTableId;
    if (id == null) return;
    const name = get().editTableName.trim() || "テーブル";
    db.dbUpdateTableName(id, name);
    set((s) => ({
      tables: s.tables.map((t) => (t.id === id ? { ...t, name } : t)),
      editingTableId: null,
      justAddedTableId: null, // 確定したらピン留め解除→末尾の並びに落ち着く
    }));
  },
  // テーブル並び替え（メニュー管理と同じD&D）
  dragStartTable: (id) => set({ dragTableId: id }),
  dragEndTable: () => set({ dragTableId: null }),
  dropOnTable: (targetId) => {
    const s = get();
    const dragId = s.dragTableId;
    if (dragId == null || dragId === targetId) {
      set({ dragTableId: null });
      return;
    }
    const arr = [...s.tables];
    const from = arr.findIndex((t) => t.id === dragId);
    const to = arr.findIndex((t) => t.id === targetId);
    if (from < 0 || to < 0) {
      set({ dragTableId: null });
      return;
    }
    arr.splice(to, 0, arr.splice(from, 1)[0]);
    db.dbReorderTables(arr.map((t) => t.id));
    set({ tables: arr, dragTableId: null });
  },
  confirmDeleteTable: (id) => {
    const s = get();
    const t = s.tables.find((x) => x.id === id);
    if (!t) return;
    const hasOrders = s.orders.some((o) => o.table === id);
    set({
      dialog: {
        title: t.name + " を削除",
        body: hasOrders
          ? "このテーブルには未会計の注文が残っています。削除すると注文も消えます。よろしいですか？"
          : "このテーブルを削除します。よろしいですか？",
        confirmText: "削除する",
        danger: true,
        onConfirm: () => {
          db.dbDeleteTable(id);
          set((st) => ({
            tables: st.tables.filter((x) => x.id !== id),
            orders: st.orders.filter((o) => o.table !== id),
            calls: st.calls.filter((c) => c.table !== id),
            selectedStaffTable:
              st.selectedStaffTable === id ? null : st.selectedStaffTable,
            editingTableId: null,
            justAddedTableId:
              st.justAddedTableId === id ? null : st.justAddedTableId,
            dialog: null,
          }));
        },
      },
    });
  },

  // ---- メニュー管理 ----
  setPrice: (id, val) => {
    const n = Math.max(0, parseInt(val, 10) || 0);
    db.dbUpdateMenu(id, { price: n });
    set((s) => ({ menu: s.menu.map((m) => (m.id === id ? { ...m, price: n } : m)) }));
  },
  setStock: (id, val) => {
    const n = Math.max(0, parseInt(val, 10) || 0);
    db.dbUpdateMenu(id, { stock: n });
    set((s) => ({ menu: s.menu.map((m) => (m.id === id ? { ...m, stock: n } : m)) }));
  },
  bumpStock: (id, d) => {
    const m0 = get().menu.find((m) => m.id === id);
    if (!m0) return;
    const n = Math.max(0, m0.stock + d);
    db.dbUpdateMenu(id, { stock: n });
    set((s) => ({
      menu: s.menu.map((m) => (m.id === id ? { ...m, stock: n } : m)),
    }));
  },
  toggleSoldOut: (id) => {
    const m0 = get().menu.find((m) => m.id === id);
    if (!m0) return;
    db.dbUpdateMenu(id, { sold_out: !m0.soldOut });
    set((s) => ({
      menu: s.menu.map((m) => (m.id === id ? { ...m, soldOut: !m.soldOut } : m)),
    }));
  },
  setNewField: (k, v) => set({ [k]: v } as Pick<AppState, typeof k>),
  setNewCat: (c) => set({ newCat: c }),
  addItem: () => {
    const s = get();
    const name = s.newName.trim();
    if (!name) return;
    const id = newId();
    const price = Math.max(0, parseInt(s.newPrice, 10) || 0);
    const stock = Math.max(0, parseInt(s.newStock, 10) || 0);
    db.dbInsertMenu({ name, cat: s.newCat, price, stock, sort: s.menu.length });
    set((st) => ({
      menu: [
        ...st.menu,
        { id, name, cat: st.newCat, price, stock, soldOut: false, photo: null },
      ],
      newName: "",
      newPrice: "",
      newStock: "",
    }));
  },
  setPhoto: (id, url) => {
    db.dbUpdateMenu(id, { photo_url: url });
    set((s) => ({ menu: s.menu.map((m) => (m.id === id ? { ...m, photo: url } : m)) }));
  },
  removePhoto: (id) => {
    db.dbUpdateMenu(id, { photo_url: null });
    set((s) => ({ menu: s.menu.map((m) => (m.id === id ? { ...m, photo: null } : m)) }));
  },

  // 並び替え
  dragStart: (id) => set({ dragId: id }),
  dragEnd: () => set({ dragId: null }),
  dropOn: (targetId) => {
    const s = get();
    const dragId = s.dragId;
    if (!dragId || dragId === targetId) {
      set({ dragId: null });
      return;
    }
    const cat = s.adminCat;
    const filtered =
      cat === "すべて"
        ? s.menu.map((m) => m.id)
        : s.menu.filter((m) => m.cat === cat).map((m) => m.id);
    const from = filtered.indexOf(dragId);
    const to = filtered.indexOf(targetId);
    if (from < 0 || to < 0) {
      set({ dragId: null });
      return;
    }
    filtered.splice(to, 0, filtered.splice(from, 1)[0]);
    let k = 0;
    const byId = Object.fromEntries(s.menu.map((m) => [m.id, m]));
    const menu = s.menu.map((m) =>
      cat === "すべて" || m.cat === cat ? byId[filtered[k++]] : m
    );
    db.dbReorderMenu(menu.map((m) => m.id));
    set({ menu, dragId: null });
  },

  // 削除
  enterDeleteMode: () => set({ deleteMode: true, selectedIds: [] }),
  cancelDeleteMode: () => set({ deleteMode: false, selectedIds: [] }),
  toggleSelect: (id) =>
    set((s) => {
      const has = s.selectedIds.includes(id);
      return {
        selectedIds: has
          ? s.selectedIds.filter((x) => x !== id)
          : [...s.selectedIds, id],
      };
    }),
  requestDelete: () => {
    const n = get().selectedIds.length;
    if (n === 0) return;
    set({
      dialog: {
        title: "メニューを削除",
        body: n + "件のメニューを削除します。よろしいですか？",
        confirmText: "削除する",
        danger: true,
        onConfirm: () => {
          const n2 = get().selectedIds.length;
          set({
            dialog: {
              title: "最終確認",
              body: "この操作は取り消せません。本当に " + n2 + " 件を削除しますか？",
              confirmText: "完全に削除",
              danger: true,
              onConfirm: () => {
                db.dbDeleteMenu(get().selectedIds);
                set((s) => ({
                  menu: s.menu.filter((m) => !s.selectedIds.includes(m.id)),
                  selectedIds: [],
                  deleteMode: false,
                  dialog: null,
                }));
              },
            },
          });
        },
      },
    });
  },

  // ---- 設定 / ダイアログ ----
  setSetting: (k, v) => {
    const col = {
      storeName: "name",
      theme: "theme",
      showHeaderPhoto: "show_header_photo",
      showFooterPhoto: "show_footer_photo",
    }[k];
    db.dbUpdateStore({ [col]: v });
    set((s) => ({ settings: { ...s.settings, [k]: v } }));
  },
  openSettings: () => set({ showSettings: true }),
  closeSettings: () => set({ showSettings: false }),
  toggleHistory: (v) => set({ showHistory: v }),
  closeDialog: () => set({ dialog: null }),
}));
