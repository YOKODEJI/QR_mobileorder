// 入力中（まだ送っていない）の注文を、この端末に控えておく。
// スマホでは画面を下に引っぱると再読み込みになったり、別のアプリに切り替えた間にページが
// 読み直されたりして、入力中の注文が消える。送るまでは控えを残し、開き直したら元に戻す。
// スタッフのハンディ（handyDraft）と、お客様の注文画面（customerDraft）の両方で使う。

/** これより古い控えは捨てる（前の営業日・前の来店の入力を持ち越さない） */
export const DRAFT_TTL_MS = 3 * 60 * 60 * 1000;

export interface HandyDraft {
  tableId: string;
  cart: Record<string, number>;
  notes: Record<string, string>;
  savedAt: number;
  /** どの着席のものか（卓の来店受付の時刻など）。同じ卓でも、次に座った人には引き継がないために使う */
  seat?: string;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function storage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // プライベートブラウズ等。控え無しで動かす
  }
}

/** key ごとの控え置き場を作る */
export function createDraftStore(key: string) {
  return {
    /** 入力中の注文を控える。空になったら控えも消す */
    save(
      draft: { tableId: string; cart: Record<string, number>; notes?: Record<string, string>; seat?: string },
      now: number = Date.now(),
      st: StorageLike | null = storage()
    ): void {
      if (!st) return;
      try {
        if (Object.keys(draft.cart).length === 0) st.removeItem(key);
        else {
          const value: HandyDraft = { tableId: draft.tableId, cart: draft.cart, notes: draft.notes ?? {}, savedAt: now };
          if (draft.seat !== undefined) value.seat = draft.seat;
          st.setItem(key, JSON.stringify(value));
        }
      } catch {
        /* 容量不足などは諦める */
      }
    },

    /** 控えを読む。壊れている・古い・空のときは null（控えも消す） */
    load(now: number = Date.now(), st: StorageLike | null = storage()): HandyDraft | null {
      if (!st) return null;
      try {
        const raw = st.getItem(key);
        if (!raw) return null;
        const d = JSON.parse(raw) as Partial<HandyDraft>;
        const cart: Record<string, number> = {};
        for (const [k, v] of Object.entries(d.cart ?? {})) {
          if (typeof v === "number" && Number.isInteger(v) && v > 0) cart[k] = v;
        }
        const notes: Record<string, string> = {};
        for (const [k, v] of Object.entries(d.notes ?? {})) {
          if (typeof v === "string" && k in cart) notes[k] = v;
        }
        const fresh = typeof d.savedAt === "number" && now - d.savedAt >= 0 && now - d.savedAt <= DRAFT_TTL_MS;
        if (typeof d.tableId !== "string" || !fresh || Object.keys(cart).length === 0) {
          st.removeItem(key);
          return null;
        }
        const out: HandyDraft = { tableId: d.tableId, cart, notes, savedAt: d.savedAt as number };
        if (typeof d.seat === "string") out.seat = d.seat;
        return out;
      } catch {
        try {
          st.removeItem(key);
        } catch {
          /* ignore */
        }
        return null;
      }
    },

    clear(st: StorageLike | null = storage()): void {
      try {
        st?.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}

/** お客様の注文画面のカートの控え */
export const customerDraft = createDraftStore("customerDraft");

// ---- スタッフのハンディ用（従来の呼び方のまま） ----
const handy = createDraftStore("handyDraft");

export function saveDraft(
  tableId: string,
  cart: Record<string, number>,
  notes: Record<string, string>,
  now: number = Date.now(),
  st: StorageLike | null = storage()
): void {
  handy.save({ tableId, cart, notes }, now, st);
}

export function loadDraft(now: number = Date.now(), st: StorageLike | null = storage()): HandyDraft | null {
  return handy.load(now, st);
}

export function clearDraft(st: StorageLike | null = storage()): void {
  handy.clear(st);
}
