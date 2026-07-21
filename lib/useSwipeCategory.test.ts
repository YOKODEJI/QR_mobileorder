import { describe, it, expect } from "vitest";
import { resolveSwipeTarget } from "./useSwipeCategory";

const CATS = ["すべて", "ドリンク", "一品料理", "揚げ物"];

describe("resolveSwipeTarget", () => {
  it("左スワイプ(dx<0)で次のカテゴリへ進む", () => {
    expect(resolveSwipeTarget("ドリンク", CATS, -100, 0)).toBe("一品料理");
  });

  it("右スワイプ(dx>0)で前のカテゴリへ戻る", () => {
    expect(resolveSwipeTarget("一品料理", CATS, 100, 0)).toBe("ドリンク");
  });

  it("先頭では右スワイプしても循環しない(null)", () => {
    expect(resolveSwipeTarget("すべて", CATS, 100, 0)).toBeNull();
  });

  it("末尾では左スワイプしても循環しない(null)", () => {
    expect(resolveSwipeTarget("揚げ物", CATS, -100, 0)).toBeNull();
  });

  it("横移動量が60px未満は無視する", () => {
    expect(resolveSwipeTarget("ドリンク", CATS, -59, 0)).toBeNull();
    expect(resolveSwipeTarget("ドリンク", CATS, 59, 0)).toBeNull();
  });

  it("60pxちょうどは発火する境界値", () => {
    expect(resolveSwipeTarget("ドリンク", CATS, -60, 0)).toBe("一品料理");
  });

  it("縦移動量が横移動量の2/3を超える(=縦優位)なら無視する", () => {
    // dx=100, dy=70 → |dx| <= |dy|*1.5 (105) なので無視される
    expect(resolveSwipeTarget("ドリンク", CATS, -100, 70)).toBeNull();
  });

  it("縦移動量があっても横優位なら発火する", () => {
    // dx=100, dy=50 → |dx| > |dy|*1.5 (75) なので発火する
    expect(resolveSwipeTarget("ドリンク", CATS, -100, 50)).toBe("一品料理");
  });

  it("現在値がcategoriesに無ければnull", () => {
    expect(resolveSwipeTarget("存在しない", CATS, -100, 0)).toBeNull();
  });
});
