import { describe, it, expect } from "vitest";
import {
  cartKey,
  parseCartKey,
  normalizeOptionIds,
  optionsDelta,
  unitPrice,
  lineTotal,
  optionsLabel,
  choiceGroups,
  freeOptions,
  toggleOptionId,
  hasMissingChoice,
  moveCartLine,
  countSteps,
  type MenuOption,
} from "./options";

describe("countSteps（数を＋−で合わせる組）", () => {
  const opt = (name: string, sort: number): MenuOption => ({ id: name, name, priceDelta: 0, sort, choiceGroup: "グラスの数" });

  it("名前が「同じ言葉＋数字」だけの組は、数の小さい順の一覧になる（10 は 9 の次）", () => {
    const r = countSteps([opt("グラス10", 10), opt("グラス2", 2), opt("グラス0", 0), opt("グラス9", 9)]);
    expect(r?.label).toBe("グラス");
    expect(r?.steps.map((s) => s.value)).toEqual([0, 2, 9, 10]);
    expect(r?.steps[3].option.name).toBe("グラス10");
  });

  it("数字で終わらない名前が混ざる組・言葉が違う組・同じ数が重なる組は、ボタンで選ぶ組のまま", () => {
    expect(countSteps([opt("グラス1", 0), opt("グラスなし", 1)])).toBeNull();
    expect(countSteps([opt("一合", 0), opt("グラス", 1)])).toBeNull();
    expect(countSteps([opt("グラス1", 0), opt("おちょこ2", 1)])).toBeNull();
    expect(countSteps([opt("グラス1", 0), opt("グラス01", 1)])).toBeNull();
    expect(countSteps([opt("グラス1", 0)])).toBeNull();
  });
});

describe("どれか1つを選ぶ組（日本酒の一合／グラス）と個別のチェック（Cドリンク）", () => {
  const sake: MenuOption[] = [
    { id: "go", name: "一合", priceDelta: 0, sort: 0, choiceGroup: "量" },
    { id: "glass", name: "グラス", priceDelta: 0, sort: 1, choiceGroup: "量" },
    { id: "c", name: "Cドリンク", priceDelta: 0, sort: 9, choiceGroup: null },
  ];

  it("組と個別のチェックに分ける", () => {
    expect(choiceGroups(sake)).toEqual([{ group: "量", options: [sake[0], sake[1]] }]);
    expect(freeOptions(sake)).toEqual([sake[2]]);
  });

  it("組の中は入れ替わり、同じものを押しても外れない", () => {
    expect(toggleOptionId(sake, [], "go")).toEqual(["go"]);
    expect(toggleOptionId(sake, ["go"], "glass")).toEqual(["glass"]);
    expect(toggleOptionId(sake, ["go"], "go")).toEqual(["go"]);
  });

  it("個別のチェックは組の選択を変えずに付け外しできる", () => {
    expect(toggleOptionId(sake, ["go"], "c")).toEqual(["go", "c"]);
    expect(toggleOptionId(sake, ["go", "c"], "c")).toEqual(["go"]);
  });

  it("組を選ぶまでは追加できない", () => {
    expect(hasMissingChoice(sake, [])).toBe(true);
    expect(hasMissingChoice(sake, ["c"])).toBe(true);
    expect(hasMissingChoice(sake, ["glass"])).toBe(false);
    expect(hasMissingChoice([sake[2]], [])).toBe(false);
  });
});

describe("moveCartLine", () => {
  it("行の位置を保ったまま別のキーへ移し、備考も引き継ぐ", () => {
    const r = moveCartLine({ "a|": 1, "b|": 2, "d|": 1 }, { "b|": "氷なし" }, "b|", "b|c");
    expect(Object.entries(r.cart)).toEqual([
      ["a|", 1],
      ["b|c", 2],
      ["d|", 1],
    ]);
    expect(r.notes).toEqual({ "b|c": "氷なし" });
  });

  it("移動先の行が既にあれば数量を足し、移動先の備考を残す", () => {
    const r = moveCartLine({ "b|c": 1, "b|": 2 }, { "b|c": "先", "b|": "後" }, "b|", "b|c");
    expect(r.cart).toEqual({ "b|c": 3 });
    expect(r.notes).toEqual({ "b|c": "先" });
  });

  it("無い行を指定したら何も変えない", () => {
    const cart = { "a|": 1 };
    expect(moveCartLine(cart, {}, "x|", "y|").cart).toBe(cart);
  });
});

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
