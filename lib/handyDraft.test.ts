import { describe, it, expect } from "vitest";
import { saveDraft, loadDraft, clearDraft, createDraftStore, DRAFT_TTL_MS } from "./handyDraft";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe("createDraftStore（置き場ごとの控え。お客様のカートなど）", () => {
  it("置き場が違えば混ざらず、どの着席のものか（seat）も一緒に戻る", () => {
    const st = fakeStorage();
    const customer = createDraftStore("customerDraft");
    customer.save({ tableId: "t1", cart: { "a|": 2 }, seat: "2026-10-10T10:00:00Z" }, 1000, st);
    saveDraft("t9", { "z|": 1 }, {}, 1000, st);
    expect(customer.load(2000, st)).toEqual({
      tableId: "t1",
      cart: { "a|": 2 },
      notes: {},
      savedAt: 1000,
      seat: "2026-10-10T10:00:00Z",
    });
    expect(loadDraft(2000, st)?.tableId).toBe("t9");
    customer.save({ tableId: "t1", cart: {} }, 3000, st);
    expect(customer.load(3001, st)).toBeNull();
    expect(loadDraft(3001, st)?.tableId).toBe("t9");
  });
});

describe("handyDraft（入力中の注文の控え）", () => {
  it("控えた注文を、卓・数量・備考ごと読み戻せる", () => {
    const st = fakeStorage();
    saveDraft("t1", { "a|": 2, "b|x": 1 }, { "b|x": "氷なし" }, 1000, st);
    expect(loadDraft(2000, st)).toEqual({
      tableId: "t1",
      cart: { "a|": 2, "b|x": 1 },
      notes: { "b|x": "氷なし" },
      savedAt: 1000,
    });
  });

  it("注文が空になったら控えも消える", () => {
    const st = fakeStorage();
    saveDraft("t1", { "a|": 1 }, {}, 1000, st);
    saveDraft("t1", {}, {}, 1100, st);
    expect(st.map.size).toBe(0);
    expect(loadDraft(1200, st)).toBeNull();
  });

  it("3時間より古い控えは捨てる", () => {
    const st = fakeStorage();
    saveDraft("t1", { "a|": 1 }, {}, 1000, st);
    expect(loadDraft(1000 + DRAFT_TTL_MS, st)).not.toBeNull();
    expect(loadDraft(1000 + DRAFT_TTL_MS + 1, st)).toBeNull();
    expect(st.map.size).toBe(0);
  });

  it("壊れた控えや、数量がおかしい行は読まない", () => {
    const st = fakeStorage();
    st.setItem("handyDraft", "{こわれたJSON");
    expect(loadDraft(1000, st)).toBeNull();
    st.setItem(
      "handyDraft",
      JSON.stringify({ tableId: "t1", cart: { "a|": 0, "b|": -1, "c|": "2", "d|": 1 }, notes: { "a|": "x", "d|": "y" }, savedAt: 900 })
    );
    expect(loadDraft(1000, st)).toEqual({ tableId: "t1", cart: { "d|": 1 }, notes: { "d|": "y" }, savedAt: 900 });
  });

  it("clearDraft で消える", () => {
    const st = fakeStorage();
    saveDraft("t1", { "a|": 1 }, {}, 1000, st);
    clearDraft(st);
    expect(loadDraft(1001, st)).toBeNull();
  });
});
