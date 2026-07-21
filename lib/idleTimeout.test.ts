import { describe, it, expect, beforeEach, vi } from "vitest";

// vitest.config.ts の environment は "node" のため localStorage が無い。
// 挙動を左右する最小限の実装だけをその場で用意してグローバルに生やす。
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
}

beforeEach(() => {
  vi.stubGlobal("localStorage", new MemoryStorage());
});

describe("idleTimeout", () => {
  it("一度も記録が無ければ期限切れ扱いにしない（ログイン直後の誤ログアウト防止）", async () => {
    const { isIdleExpired } = await import("./idleTimeout");
    expect(isIdleExpired()).toBe(false);
  });

  it("記録直後は期限切れではない", async () => {
    const { recordActivity, isIdleExpired } = await import("./idleTimeout");
    recordActivity();
    expect(isIdleExpired()).toBe(false);
  });

  it("12時間を超えると期限切れになる", async () => {
    const { recordActivity, isIdleExpired, IDLE_LIMIT_MS } = await import("./idleTimeout");
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    recordActivity();

    vi.spyOn(Date, "now").mockReturnValue(now + IDLE_LIMIT_MS - 1);
    expect(isIdleExpired()).toBe(false);

    vi.spyOn(Date, "now").mockReturnValue(now + IDLE_LIMIT_MS + 1);
    expect(isIdleExpired()).toBe(true);
  });

  it("clearActivityで記録を消すと未記録状態(=期限切れではない)に戻る", async () => {
    const { recordActivity, clearActivity, isIdleExpired, IDLE_LIMIT_MS } = await import(
      "./idleTimeout"
    );
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    recordActivity();
    vi.spyOn(Date, "now").mockReturnValue(now + IDLE_LIMIT_MS + 1);
    expect(isIdleExpired()).toBe(true);

    clearActivity();
    expect(isIdleExpired()).toBe(false);
  });

  it("壊れた値が入っていても例外を投げず期限切れ扱いにしない", async () => {
    const { isIdleExpired } = await import("./idleTimeout");
    localStorage.setItem("adminLastActivityAt", "not-a-number");
    expect(isIdleExpired()).toBe(false);
  });
});
