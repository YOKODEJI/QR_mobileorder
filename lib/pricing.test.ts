import { describe, it, expect } from "vitest";
import { computeCheckoutBreakdown, priceWithTax } from "./pricing";

describe("computeCheckoutBreakdown", () => {
  it("内税・割引/チャージ料なし: 合計は小計そのまま、税額は常に0", () => {
    const b = computeCheckoutBreakdown(1000, null, 0, 0, "inclusive", 10);
    expect(b).toEqual({ subtotal: 1000, discountAmount: 0, chargeAmount: 0, taxAmount: 0, total: 1000 });
  });

  it("外税・割引/チャージ料なし: 税額が加算される", () => {
    const b = computeCheckoutBreakdown(1000, null, 0, 0, "exclusive", 10);
    expect(b.taxAmount).toBe(100);
    expect(b.total).toBe(1100);
  });

  it("割引(%): 小計に対して%引き、以降の計算は割引後の額に対して行う", () => {
    const b = computeCheckoutBreakdown(1000, "percent", 10, 0, "inclusive", 10);
    expect(b.discountAmount).toBe(100);
    expect(b.total).toBe(900);
  });

  it("割引(円): 指定額そのまま引く", () => {
    const b = computeCheckoutBreakdown(1000, "amount", 300, 0, "inclusive", 10);
    expect(b.discountAmount).toBe(300);
    expect(b.total).toBe(700);
  });

  it("割引(円)が小計を超える: 小計でクランプされ、合計はマイナスにならない", () => {
    const b = computeCheckoutBreakdown(1000, "amount", 5000, 0, "inclusive", 10);
    expect(b.discountAmount).toBe(1000);
    expect(b.total).toBe(0);
  });

  it("割引が負の値: 0として扱われる（割引にならない）", () => {
    const b = computeCheckoutBreakdown(1000, "amount", -500, 0, "inclusive", 10);
    expect(b.discountAmount).toBe(0);
    expect(b.total).toBe(1000);
  });

  it("チャージ料: 割引後の額に対して加算される", () => {
    const b = computeCheckoutBreakdown(1000, "amount", 200, 10, "inclusive", 10);
    // (1000-200) * 10% = 80
    expect(b.chargeAmount).toBe(80);
    expect(b.total).toBe(1000 - 200 + 80);
  });

  it("チャージ料が負の料率: 0として扱われる", () => {
    const b = computeCheckoutBreakdown(1000, null, 0, -10, "inclusive", 10);
    expect(b.chargeAmount).toBe(0);
  });

  it("計算順序: 小計→割引→チャージ料→(外税なら)消費税 の複合ケース", () => {
    // 小計3000, 10%割引=300 → 2700, チャージ料10%=270 → 2970, 消費税10%=297 → 合計3267
    const b = computeCheckoutBreakdown(3000, "percent", 10, 10, "exclusive", 10);
    expect(b.discountAmount).toBe(300);
    expect(b.chargeAmount).toBe(270);
    expect(b.taxAmount).toBe(297);
    expect(b.total).toBe(3267);
  });

  it("端数は都度四捨五入される", () => {
    // 小計999, 10%割引 = 99.9 → 100に丸め
    const b = computeCheckoutBreakdown(999, "percent", 10, 0, "inclusive", 10);
    expect(b.discountAmount).toBe(100);
  });

  it("discountType が null なら discountValue を無視する", () => {
    const b = computeCheckoutBreakdown(1000, null, 999, 0, "inclusive", 10);
    expect(b.discountAmount).toBe(0);
    expect(b.total).toBe(1000);
  });

  it("小計0円: すべて0で返る", () => {
    const b = computeCheckoutBreakdown(0, "percent", 50, 20, "exclusive", 10);
    expect(b).toEqual({ subtotal: 0, discountAmount: 0, chargeAmount: 0, taxAmount: 0, total: 0 });
  });
});

describe("priceWithTax", () => {
  it("内税: そのまま返す", () => {
    expect(priceWithTax(1000, "inclusive", 10)).toBe(1000);
  });

  it("外税: 税率分を加算する", () => {
    expect(priceWithTax(1000, "exclusive", 10)).toBe(1100);
  });

  it("外税・税率0: 加算なし", () => {
    expect(priceWithTax(1000, "exclusive", 0)).toBe(1000);
  });

  it("外税・負の税率: 0として扱われ加算なし", () => {
    expect(priceWithTax(1000, "exclusive", -10)).toBe(1000);
  });

  it("端数は四捨五入される", () => {
    // 999 * 10% = 99.9 → 100
    expect(priceWithTax(999, "exclusive", 10)).toBe(1099);
  });
});
