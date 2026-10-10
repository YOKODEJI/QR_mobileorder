import { describe, it, expect } from "vitest";
import {
  normalizeForSearch,
  filterMenu,
  tableSummary,
  parseBulkMenu,
  billLines,
  sortByPopularity,
  popularityFromOrders,
  tableRepeatItems,
  shiftInList,
  fitTableGrid,
  settleTargets,
} from "./handy";
import type { MenuItem, Order } from "@/store/useAppStore";

describe("shiftInList", () => {
  it("1つ前・1つ後ろへ動かす", () => {
    expect(shiftInList(["イ", "ロ", "ハ"], 1, -1)).toEqual(["ロ", "イ", "ハ"]);
    expect(shiftInList(["イ", "ロ", "ハ"], 1, 1)).toEqual(["イ", "ハ", "ロ"]);
  });

  it("端からは動かせず、元の配列をそのまま返す", () => {
    const list = ["イ", "ロ", "ハ"];
    expect(shiftInList(list, 0, -1)).toBe(list);
    expect(shiftInList(list, 2, 1)).toBe(list);
    expect(shiftInList(list, -1, 1)).toBe(list);
  });
});

const item = (id: string, name: string, cat: string): MenuItem => ({
  id,
  name,
  cat,
  price: 0,
  soldOut: false,
  stock: 0,
  photo: null,
});

const menu = [
  item("1", "ハイボール", "ウイスキー"),
  item("2", "鳳凰美田 純米吟醸", "日本酒"),
  item("3", "ＣＡＶＡ", "ワイン"),
];

describe("normalizeForSearch", () => {
  it("カタカナとひらがな、全角と半角、大文字と小文字、空白の違いを無視する", () => {
    expect(normalizeForSearch("ハイ ボール")).toBe(normalizeForSearch("はいぼーる"));
    expect(normalizeForSearch("ＣＡＶＡ")).toBe("cava");
  });
});

describe("filterMenu", () => {
  it("検索語が無ければカテゴリで絞る", () => {
    expect(filterMenu(menu, "日本酒", "").map((m) => m.id)).toEqual(["2"]);
    expect(filterMenu(menu, "すべて", "")).toHaveLength(3);
  });

  it("検索語があればカテゴリをまたいで探す", () => {
    expect(filterMenu(menu, "日本酒", "はいぼ").map((m) => m.id)).toEqual(["1"]);
    expect(filterMenu(menu, "すべて", "cava").map((m) => m.id)).toEqual(["3"]);
  });
});

describe("parseBulkMenu", () => {
  it("行ごとのカテゴリ（/ ／ , 、 タブ）と、見出し行（【】 #）の両方を読む", () => {
    const text = [
      "焼酎 / 富乃宝山",
      "ワイン，CAVA",
      "",
      "【ウイスキー】",
      "  山崎 12年  ",
      "# ソフトドリンク",
      "ウーロン茶",
      "ビール\tアサヒ",
    ].join("\n");
    expect(parseBulkMenu(text, "その他")).toEqual([
      { cat: "焼酎", name: "富乃宝山" },
      { cat: "ワイン", name: "CAVA" },
      { cat: "ウイスキー", name: "山崎 12年" },
      { cat: "ソフトドリンク", name: "ウーロン茶" },
      { cat: "ビール", name: "アサヒ" },
    ]);
  });

  it("区切りも見出しも無い行は既定のカテゴリ", () => {
    expect(parseBulkMenu("ハイボール\r\n", "その他")).toEqual([{ cat: "その他", name: "ハイボール" }]);
  });
});

describe("billLines", () => {
  it("未会計の注文を品名＋オプションごとに合算し、繰越伝票と他の卓は含めない", () => {
    const rock = [{ id: "r", name: "ロック", priceDelta: 0 }];
    const orders: Order[] = [
      { id: "1", table: "A", createdAt: "2026-09-26T10:00:00Z", status: "served",
        items: [{ menuItemId: "w", name: "山崎", price: 0, qty: 1, options: rock }] },
      { id: "2", table: "A", createdAt: "2026-09-26T10:10:00Z", status: "cooking",
        items: [
          { menuItemId: "w", name: "山崎", price: 0, qty: 2, options: rock },
          { menuItemId: "w", name: "山崎", price: 0, qty: 1 },
        ] },
      { id: "3", table: "A", createdAt: "2026-09-26T09:00:00Z", status: "cooking", checkedOutAt: "x",
        items: [{ menuItemId: "b", name: "ビール", price: 0, qty: 5 }] },
      { id: "4", table: "B", createdAt: "2026-09-26T10:00:00Z", status: "cooking",
        items: [{ menuItemId: "b", name: "ビール", price: 0, qty: 1 }] },
    ];
    expect(billLines(orders, "A")).toEqual([
      { name: "山崎", optionsText: "ロック", qty: 3 },
      { name: "山崎", optionsText: "", qty: 1 },
    ]);
  });
});

describe("billLines の並び", () => {
  it("同じ品のオプション違いは、あとから注文されても隣り合わせにする", () => {
    const c = [{ id: "c", name: "Cドリンク", priceDelta: 0 }];
    const orders: Order[] = [
      { id: "1", table: "A", createdAt: "2026-10-03T10:00:00Z", status: "served",
        items: [
          { menuItemId: "b", name: "小生ビール", price: 0, qty: 2 },
          { menuItemId: "m", name: "魔王", price: 0, qty: 1 },
        ] },
      { id: "2", table: "A", createdAt: "2026-10-03T10:10:00Z", status: "cooking",
        items: [{ menuItemId: "b", name: "小生ビール", price: 0, qty: 1, options: c }] },
    ];
    expect(billLines(orders, "A")).toEqual([
      { name: "小生ビール", optionsText: "", qty: 2 },
      { name: "小生ビール", optionsText: "Cドリンク", qty: 1 },
      { name: "魔王", optionsText: "", qty: 1 },
    ]);
  });
});

describe("sortByPopularity", () => {
  it("杯数の多い順。同数・注文なしは元の並びのまま", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    expect(sortByPopularity(items, { c: 5, b: 2, d: 2 }).map((x) => x.id)).toEqual(["c", "b", "d", "a"]);
  });
});

describe("popularityFromOrders", () => {
  it("注文の明細を品目ごとに合算する", () => {
    const orders = [
      { id: "1", table: "A", createdAt: "", status: "cooking" as const,
        items: [{ menuItemId: "x", name: "", price: 0, qty: 2 }, { menuItemId: "y", name: "", price: 0, qty: 1 }] },
      { id: "2", table: "B", createdAt: "", status: "served" as const,
        items: [{ menuItemId: "x", name: "", price: 0, qty: 3 }] },
    ];
    expect(popularityFromOrders(orders)).toEqual({ x: 5, y: 1 });
  });
});

describe("tableRepeatItems", () => {
  it("この卓の品を商品＋飲み方ごとにまとめ、最近頼まれた順・直近の備考を持つ。他の卓と繰越伝票は含めない", () => {
    const rock = [{ id: "r", name: "ロック", priceDelta: 0 }];
    const orders: Order[] = [
      { id: "1", table: "A", createdAt: "2026-09-26T10:00:00Z", status: "served",
        items: [{ menuItemId: "w", name: "山崎", price: 0, qty: 1, options: rock, note: "氷少なめ" }] },
      { id: "2", table: "A", createdAt: "2026-09-26T10:05:00Z", status: "served",
        items: [{ menuItemId: "b", name: "ビール", price: 0, qty: 2 }] },
      { id: "3", table: "A", createdAt: "2026-09-26T10:20:00Z", status: "cooking",
        items: [{ menuItemId: "w", name: "山崎", price: 0, qty: 1, options: rock, note: "氷なし" }] },
      { id: "4", table: "B", createdAt: "2026-09-26T10:30:00Z", status: "cooking",
        items: [{ menuItemId: "x", name: "他卓", price: 0, qty: 1 }] },
      { id: "5", table: "A", createdAt: "2026-09-26T09:00:00Z", status: "cooking", checkedOutAt: "x",
        items: [{ menuItemId: "old", name: "前の客", price: 0, qty: 1 }] },
    ];
    expect(tableRepeatItems(orders, "A")).toEqual([
      { key: "w|r", menuItemId: "w", optionIds: ["r"], name: "山崎", optionsText: "ロック", note: "氷なし", qty: 2 },
      { key: "b|", menuItemId: "b", optionIds: [], name: "ビール", optionsText: "", note: null, qty: 2 },
    ]);
  });
});

describe("tableSummary", () => {
  const order = (table: string, status: Order["status"], qty: number, checkedOutAt?: string): Order => ({
    id: Math.random().toString(),
    table,
    createdAt: "2026-09-26T10:00:00Z",
    status,
    items: [{ menuItemId: "1", name: "ハイボール", price: 0, qty }],
    checkedOutAt,
  });

  it("提供前と提供済みの杯数を卓ごとに数え、繰越伝票と他の卓は数えない", () => {
    const orders = [
      order("A", "cooking", 2),
      order("A", "served", 1),
      order("A", "cooking", 5, "2026-09-26T09:00:00Z"),
      order("B", "cooking", 3),
    ];
    expect(tableSummary(orders, "A")).toEqual({ pendingQty: 2, servedQty: 1, orderCount: 2 });
  });
});

describe("fitTableGrid（卓一覧の並べ方）", () => {
  it("スマホで8卓なら2列で、スクロール無しに収まる", () => {
    const fit = fitTableGrid(8, 351, 700);
    expect(fit.cols).toBe(2);
    expect(fit.scrolls).toBe(false);
    expect(fit.tileHeight * 4 + 10 * 3).toBeLessThanOrEqual(700);
  });
  it("卓が少なければ大きく（間延びしない上限つき）", () => {
    const fit = fitTableGrid(3, 351, 700);
    expect(fit.cols).toBe(1);
    expect(fit.tileHeight).toBe(200);
  });
  it("卓が多ければ列を増やして収める", () => {
    const fit = fitTableGrid(20, 351, 700);
    expect(fit.cols).toBe(3);
    expect(fit.scrolls).toBe(false);
    expect(fit.tileHeight).toBeGreaterThanOrEqual(84);
  });
  it("どうしても入り切らなければ、縦に流す", () => {
    const fit = fitTableGrid(40, 351, 700);
    expect(fit.scrolls).toBe(true);
    expect(fit.cols).toBe(3);
  });
  it("測れていないとき・卓が無いときは既定の並び", () => {
    expect(fitTableGrid(8, 0, 0).cols).toBe(2);
    expect(fitTableGrid(0, 351, 700).cols).toBe(2);
  });
  it("卓名の文字はタイルに合わせて 22〜40px", () => {
    expect(fitTableGrid(20, 351, 700).nameSize).toBeGreaterThanOrEqual(22);
    expect(fitTableGrid(2, 351, 700).nameSize).toBeLessThanOrEqual(40);
  });
});

describe("settleTargets（一括清算の対象）", () => {
  const tables = [
    { id: "a", name: "A", openSince: "2026-10-10T10:00:00Z" },
    { id: "b", name: "B", openSince: "2026-10-10T10:00:00Z" },
    { id: "c", name: "C", openSince: null },
    { id: "d", name: "D", openSince: null },
  ];
  const order = (table: string, checkedOutAt?: string): Order =>
    ({ id: table + (checkedOutAt ?? ""), table, createdAt: "2026-10-10T10:05:00Z", status: "cooking", items: [], checkedOutAt }) as Order;

  it("注文のある卓と、受付だけの卓を分ける。空席は対象外", () => {
    const t = settleTargets(tables, [order("a")]);
    expect(t.withOrders.map((x) => x.id)).toEqual(["a"]);
    expect(t.openOnly.map((x) => x.id)).toEqual(["b"]);
  });
  it("会計済みの繰越伝票だけの卓は、注文なしとして扱う", () => {
    const t = settleTargets(tables, [order("b", "2026-10-10T11:00:00Z"), order("d", "2026-10-10T11:00:00Z")]);
    expect(t.withOrders).toEqual([]);
    expect(t.openOnly.map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("受付の記録が無くても、注文があれば対象（ローカル開発）", () => {
    expect(settleTargets([{ id: "x" }], [order("x")]).withOrders.map((x) => x.id)).toEqual(["x"]);
  });
});
