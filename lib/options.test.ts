import { describe, it, expect } from "vitest";
import {
  cartKey,
  parseCartKey,
  normalizeOptionIds,
  optionsDelta,
  unitPrice,
  lineTotal,
  optionsLabel,
} from "./options";

describe("normalizeOptionIds", () => {
  it("昇順に並べ替える（選んだ順に依存しない）", () => {
    expect(normalizeOptionIds(["b", "a", "c"])).toEqual(["a", "b", "c"]);
  });

  it("重複を除去する", () => {
    expect(normalizeOptionIds(["a", "a", "b"])).toEqual(["a", "b"]);
  });
});

describe("cartKey", () => {
  it("オプション無しは 商品ID| になる", () => {
    expect(cartKey("m1")).toBe("m1|");
    expect(cartKey("m1", [])).toBe("m1|");
  });

  it("選択順が違っても同じキーになる（同じ組み合わせは同じ行に集約される）", () => {
    expect(cartKey("m1", ["o2", "o1"])).toBe(cartKey("m1", ["o1", "o2"]));
  });

  it("組み合わせが違えば別のキーになる", () => {
    expect(cartKey("m1", ["o1"])).not.toBe(cartKey("m1", ["o2"]));
    expect(cartKey("m1", ["o1"])).not.toBe(cartKey("m1", ["o1", "o2"]));
  });

  it("商品が違えば別のキーになる", () => {
    expect(cartKey("m1", ["o1"])).not.toBe(cartKey("m2", ["o1"]));
  });

  it("parseCartKeyで元に戻せる", () => {
    expect(parseCartKey(cartKey("m1", ["o2", "o1"]))).toEqual({
      menuItemId: "m1",
      optionIds: ["o1", "o2"],
    });
    expect(parseCartKey(cartKey("m1"))).toEqual({ menuItemId: "m1", optionIds: [] });
  });

  it("旧形式（商品IDのみ）も読める", () => {
    expect(parseCartKey("m1")).toEqual({ menuItemId: "m1", optionIds: [] });
  });
});

describe("価格計算", () => {
  const opts = [
    { id: "o1", name: "大盛り", priceDelta: 100 },
    { id: "o2", name: "ネギ増し", priceDelta: 50 },
  ];

  it("optionsDelta: 追加料金の合計", () => {
    expect(optionsDelta(opts)).toBe(150);
    expect(optionsDelta([])).toBe(0);
    expect(optionsDelta(undefined)).toBe(0);
  });

  it("optionsDelta: マイナス（値引き）も扱える", () => {
    expect(optionsDelta([{ id: "o3", name: "ライス抜き", priceDelta: -50 }])).toBe(-50);
  });

  it("unitPrice: 本体単価 + 追加料金", () => {
    expect(unitPrice(800, opts)).toBe(950);
    expect(unitPrice(800)).toBe(800);
  });

  it("lineTotal: 実売価 × 数量", () => {
    expect(lineTotal({ price: 800, qty: 2, options: opts })).toBe(1900);
    expect(lineTotal({ price: 800, qty: 2 })).toBe(1600);
  });
});

describe("optionsLabel", () => {
  it("中黒で連結する", () => {
    expect(
      optionsLabel([
        { id: "o1", name: "大盛り", priceDelta: 100 },
        { id: "o2", name: "ネギ増し", priceDelta: 50 },
      ])
    ).toBe("大盛り・ネギ増し");
  });

  it("無選択なら空文字", () => {
    expect(optionsLabel([])).toBe("");
    expect(optionsLabel(undefined)).toBe("");
  });
});
