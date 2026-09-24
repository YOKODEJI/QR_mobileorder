import { describe, it, expect } from "vitest";
import { mergeFresherRemote, pruneRemote, type RemoteEntry } from "./remoteMerge";

type Row = { id: string; v?: number };

function remoteOf(entries: Array<[string, number]>): Map<string, RemoteEntry<Row>> {
  return new Map(entries.map(([id, at]) => [id, { item: { id }, receivedAt: at }]));
}

describe("mergeFresherRemote", () => {
  it("取得開始より後に届いた行は、取得結果に無くても残す", () => {
    const merged = mergeFresherRemote([{ id: "a" }], remoteOf([["b", 200]]), 100);
    expect(merged.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("取得開始より前に届いた行は、取得結果（DBの正）に従って消える", () => {
    const merged = mergeFresherRemote([{ id: "a" }], remoteOf([["b", 50]]), 100);
    expect(merged.map((r) => r.id)).toEqual(["a"]);
  });

  it("取得結果に既にある行は二重にしない（DB側の内容を優先）", () => {
    const merged = mergeFresherRemote([{ id: "b", v: 2 }], remoteOf([["b", 200]]), 100);
    expect(merged).toEqual([{ id: "b", v: 2 }]);
  });

  it("足す行が無ければ取得結果をそのまま返す", () => {
    const fetched = [{ id: "a" }];
    expect(mergeFresherRemote(fetched, new Map(), 100)).toBe(fetched);
  });
});

describe("pruneRemote", () => {
  it("期限を過ぎた控えだけを捨てる", () => {
    const remote = remoteOf([["old", 0], ["new", 900]]);
    pruneRemote(remote, 1000, 500);
    expect([...remote.keys()]).toEqual(["new"]);
  });
});
