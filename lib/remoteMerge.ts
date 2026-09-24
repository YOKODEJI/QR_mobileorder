// Broadcastで先に届いた行を、それより前に始まった再取得の結果で消さないための控え。
// 再取得（HTTP）は送信前のDBを読んでいることがあり、そのまま反映すると届いたばかりの
// 注文が一瞬消えてしまう。受信時刻が取得開始より後の行は、取得結果に無くても残す。

export interface RemoteEntry<T> {
  item: T;
  receivedAt: number;
}

export function mergeFresherRemote<T extends { id: string }>(
  fetched: T[],
  remote: Map<string, RemoteEntry<T>>,
  fetchStartedAt: number
): T[] {
  const ids = new Set(fetched.map((x) => x.id));
  const extra: T[] = [];
  for (const [id, e] of remote) {
    if (e.receivedAt > fetchStartedAt && !ids.has(id)) extra.push(e.item);
  }
  return extra.length > 0 ? [...fetched, ...extra] : fetched;
}

export function pruneRemote<T>(remote: Map<string, RemoteEntry<T>>, now: number, ttlMs: number): void {
  for (const [id, e] of remote) {
    if (now - e.receivedAt > ttlMs) remote.delete(id);
  }
}
