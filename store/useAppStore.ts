"use client";

import { create } from "zustand";

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
  name: string;
  qty: number;
  price: number;
}

export interface Order {
  id: number;
  table: number;
  time: string;
  status: Status;
  items: OrderItem[];
  proxy?: boolean;
}

export interface TableRec {
  id: number;
  name: string;
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
  mgmtTab: "kitchen" | "staff" | "menu";
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
  customerTableId: number;
  tables: TableRec[];
  tableEditMode: boolean;
  editingTableId: number | null;
  editTableName: string;
  // 業務データ
  orders: Order[];
  menu: MenuItem[];
  // 厨房 / 接続
  connected: boolean;
  soundOn: boolean;
  highlightId: number | null;
  // UI一時状態
  submitting: boolean;
  justOrdered: boolean;
  showHistory: boolean;
  selectedStaffTable: number | null;
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
  // カウンタ
  nextId: number;
  nextTableId: number;

  // ---- ヘルパー ----
  yen: (n: number) => string;
  tableName: (id: number) => string;
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

  // ---- 厨房 ----
  confirmStatus: (o: Order) => void;
  toggleSound: () => void;
  toggleConnection: () => void;

  // ---- 会計 / テーブル ----
  selectStaffTable: (id: number) => void;
  checkout: () => void;
  cancelUnit: (name: string) => void;
  setTableEditMode: (v: boolean) => void;
  addTable: () => void;
  startEditTable: (id: number) => void;
  setEditTableName: (v: string) => void;
  saveEditTable: () => void;

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

function nowHM(): string {
  const d = new Date();
  return (
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0")
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
  customerTableId: 5,
  tables: [
    { id: 1, name: "テーブル 1" },
    { id: 2, name: "テーブル 2" },
    { id: 3, name: "テーブル 3" },
    { id: 4, name: "テーブル 4" },
    { id: 5, name: "テーブル 5" },
    { id: 6, name: "テーブル 6" },
    { id: 7, name: "カウンター A" },
    { id: 8, name: "個室 松" },
  ],
  tableEditMode: false,
  editingTableId: null,
  editTableName: "",
  orders: [
    {
      id: 1,
      table: 3,
      time: "18:42",
      status: "cooking",
      items: [
        { name: "生ビール", qty: 2, price: 550 },
        { name: "枝豆", qty: 1, price: 380 },
        { name: "鶏の唐揚げ", qty: 1, price: 580 },
      ],
    },
    {
      id: 2,
      table: 7,
      time: "18:47",
      status: "served",
      items: [
        { name: "ハイボール", qty: 1, price: 450 },
        { name: "餃子", qty: 2, price: 480 },
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
  nextId: 3,
  nextTableId: 9,

  // ---- ヘルパー ----
  yen: (n) => "¥" + Number(n).toLocaleString("ja-JP"),
  tableName: (id) => {
    const t = get().tables.find((x) => x.id === id);
    return t ? t.name : "テーブル " + id;
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
    set((s) => ({ cart: { ...s.cart, [id]: (s.cart[id] || 0) + 1 } })),
  removeCart: (id) =>
    set((s) => {
      const c = { ...s.cart };
      const v = (c[id] || 0) - 1;
      if (v <= 0) delete c[id];
      else c[id] = v;
      return { cart: c };
    }),
  addStaff: (id) =>
    set((s) => ({ staffCart: { ...s.staffCart, [id]: (s.staffCart[id] || 0) + 1 } })),
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
    const items = Object.keys(s.cart).map((id) => {
      const m = s.menu.find((x) => x.id === id)!;
      return { name: m.name, qty: s.cart[id], price: m.price };
    });
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
    const items = Object.keys(s.cart).map((id) => {
      const m = s.menu.find((x) => x.id === id)!;
      return { name: m.name, qty: s.cart[id], price: m.price };
    });
    if (items.length === 0) return;
    set({ submitting: true });
    setTimeout(() => {
      const id = get().nextId;
      set((st) => ({
        orders: [
          { id, table: st.customerTableId, time: nowHM(), status: "cooking", items },
          ...st.orders,
        ],
        cart: {},
        submitting: false,
        justOrdered: true,
        highlightId: id,
        nextId: st.nextId + 1,
      }));
      playBeep(get().soundOn);
      setTimeout(() => {
        if (get().highlightId === id) set({ highlightId: null });
      }, 2600);
    }, 800);
  },
  submitProxy: () => {
    const s = get();
    const t = s.selectedStaffTable;
    if (t == null) return;
    const items = Object.keys(s.staffCart).map((id) => {
      const m = s.menu.find((x) => x.id === id)!;
      return { name: m.name, qty: s.staffCart[id], price: m.price };
    });
    if (items.length === 0) return;
    const id = s.nextId;
    set((st) => ({
      orders: [
        { id, table: t, time: nowHM(), status: "cooking", items, proxy: true },
        ...st.orders,
      ],
      staffCart: {},
      nextId: st.nextId + 1,
      highlightId: id,
    }));
    playBeep(get().soundOn);
    setTimeout(() => {
      if (get().highlightId === id) set({ highlightId: null });
    }, 2600);
  },
  dismissSuccess: () => set({ justOrdered: false }),

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
          set((s) => ({
            orders: s.orders.map((x) =>
              x.id === o.id
                ? { ...x, status: x.status === "cooking" ? "served" : "cooking" }
                : x
            ),
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
  checkout: () => {
    const t = get().selectedStaffTable;
    set((s) => ({
      orders: s.orders.filter((o) => o.table !== t),
      selectedStaffTable: null,
    }));
  },
  cancelUnit: (name) => {
    const t = get().selectedStaffTable;
    set((s) => {
      let done = false;
      const orders = s.orders
        .map((o) => {
          if (o.table !== t) return o;
          const items = o.items
            .map((it) => {
              if (done || it.name !== name) return it;
              done = true;
              return { ...it, qty: it.qty - 1 };
            })
            .filter((it) => it.qty > 0);
          return { ...o, items };
        })
        .filter((o) => o.items.length > 0);
      return { orders };
    });
  },
  setTableEditMode: (v) =>
    set({ tableEditMode: v, editingTableId: null, editTableName: "" }),
  addTable: () =>
    set((s) => {
      const id = s.nextTableId;
      const name = "テーブル " + id;
      // 追加した行はそのまま名前編集状態にする
      return {
        tables: [...s.tables, { id, name }],
        nextTableId: s.nextTableId + 1,
        tableEditMode: true,
        editingTableId: id,
        editTableName: name,
      };
    }),
  startEditTable: (id) => {
    const t = get().tables.find((x) => x.id === id);
    set({ editingTableId: id, editTableName: t ? t.name : "" });
  },
  setEditTableName: (v) => set({ editTableName: v }),
  saveEditTable: () => {
    const id = get().editingTableId;
    const name = get().editTableName.trim() || "テーブル " + id;
    set((s) => ({
      tables: s.tables.map((t) => (t.id === id ? { ...t, name } : t)),
      editingTableId: null,
    }));
  },

  // ---- メニュー管理 ----
  setPrice: (id, val) => {
    const n = Math.max(0, parseInt(val, 10) || 0);
    set((s) => ({ menu: s.menu.map((m) => (m.id === id ? { ...m, price: n } : m)) }));
  },
  setStock: (id, val) => {
    const n = Math.max(0, parseInt(val, 10) || 0);
    set((s) => ({ menu: s.menu.map((m) => (m.id === id ? { ...m, stock: n } : m)) }));
  },
  bumpStock: (id, d) =>
    set((s) => ({
      menu: s.menu.map((m) =>
        m.id === id ? { ...m, stock: Math.max(0, m.stock + d) } : m
      ),
    })),
  toggleSoldOut: (id) =>
    set((s) => ({
      menu: s.menu.map((m) => (m.id === id ? { ...m, soldOut: !m.soldOut } : m)),
    })),
  setNewField: (k, v) => set({ [k]: v } as Pick<AppState, typeof k>),
  setNewCat: (c) => set({ newCat: c }),
  addItem: () => {
    const s = get();
    const name = s.newName.trim();
    if (!name) return;
    const id = "m" + Date.now();
    set((st) => ({
      menu: [
        ...st.menu,
        {
          id,
          name,
          cat: st.newCat,
          price: Math.max(0, parseInt(st.newPrice, 10) || 0),
          stock: Math.max(0, parseInt(st.newStock, 10) || 0),
          soldOut: false,
          photo: null,
        },
      ],
      newName: "",
      newPrice: "",
      newStock: "",
    }));
  },
  setPhoto: (id, url) =>
    set((s) => ({ menu: s.menu.map((m) => (m.id === id ? { ...m, photo: url } : m)) })),
  removePhoto: (id) =>
    set((s) => ({ menu: s.menu.map((m) => (m.id === id ? { ...m, photo: null } : m)) })),

  // 並び替え
  dragStart: (id) => set({ dragId: id }),
  dragEnd: () => set({ dragId: null }),
  dropOn: (targetId) => {
    const dragId = get().dragId;
    if (!dragId || dragId === targetId) {
      set({ dragId: null });
      return;
    }
    set((s) => {
      const cat = s.adminCat;
      const filtered =
        cat === "すべて"
          ? s.menu.map((m) => m.id)
          : s.menu.filter((m) => m.cat === cat).map((m) => m.id);
      const from = filtered.indexOf(dragId);
      const to = filtered.indexOf(targetId);
      if (from < 0 || to < 0) return { dragId: null };
      filtered.splice(to, 0, filtered.splice(from, 1)[0]);
      let k = 0;
      const byId = Object.fromEntries(s.menu.map((m) => [m.id, m]));
      const menu = s.menu.map((m) =>
        cat === "すべて" || m.cat === cat ? byId[filtered[k++]] : m
      );
      return { menu, dragId: null };
    });
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
              onConfirm: () =>
                set((s) => ({
                  menu: s.menu.filter((m) => !s.selectedIds.includes(m.id)),
                  selectedIds: [],
                  deleteMode: false,
                  dialog: null,
                })),
            },
          });
        },
      },
    });
  },

  // ---- 設定 / ダイアログ ----
  setSetting: (k, v) => set((s) => ({ settings: { ...s.settings, [k]: v } })),
  openSettings: () => set({ showSettings: true }),
  closeSettings: () => set({ showSettings: false }),
  toggleHistory: (v) => set({ showHistory: v }),
  closeDialog: () => set({ dialog: null }),
}));
