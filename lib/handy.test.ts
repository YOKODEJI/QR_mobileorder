import { describe, it, expect } from "vitest";
import { normalizeForSearch, filterMenu, tableSummary } from "./handy";
import type { MenuItem, Order } from "@/store/useAppStore";

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
