// ハンディ画面（/handy）用の純粋関数。画面から切り離してテストできるようにしている。
import type { MenuItem, Order } from "@/store/useAppStore";
import { optionsLabel, cartKey } from "@/lib/options";

/** 店全体の人気順（杯数の多い順）。同じ杯数・注文なしの品は元の並び（メニュー管理の順）のまま */
export function sortByPopularity<T extends { id: string }>(items: T[], popularity: Record<string, number>): T[] {
  return items
    .map((item, index) => ({ item, index, qty: popularity[item.id] ?? 0 }))
    .sort((a, b) => b.qty - a.qty || a.index - b.index)
    .map((x) => x.item);
}

/** Supabase未設定（ローカル開発）用: 手元の注文から品目ごとの杯数を数える */
export function popularityFromOrders(orders: Order[]): Record<string, number> {
  const pop: Record<string, number> = {};
  for (const o of orders) for (const it of o.items) pop[it.menuItemId] = (pop[it.menuItemId] ?? 0) + it.qty;
  return pop;
}

export interface RepeatItem {
  key: string; // staffCart のキー（商品＋オプション）
  menuItemId: string;
  optionIds: string[];
  name: string;
  optionsText: string;
  note: string | null; // 直近の備考（おかわりでも同じことが多い）
  qty: number; // この卓でこれまでに出た杯数
}

/** この卓でこれまでに頼まれた品（商品＋飲み方ごと）。おかわりしやすいよう、最近頼まれた順 */
export function tableRepeatItems(orders: Order[], tableId: string): RepeatItem[] {
  const map = new Map<string, RepeatItem & { lastAt: number }>();
  for (const o of orders) {
    if (o.table !== tableId || o.checkedOutAt) continue;
    const at = new Date(o.createdAt).getTime();
    for (const it of o.items) {
      const optionIds = (it.options ?? []).map((x) => x.id);
      const key = cartKey(it.menuItemId, optionIds);
      const cur = map.get(key);
      if (cur) {
        cur.qty += it.qty;
        if (at >= cur.lastAt) {
          cur.lastAt = at;
          cur.note = it.note ?? null;
        }
      } else {
        map.set(key, {
          key,
          menuItemId: it.menuItemId,
          optionIds,
          name: it.name,
          optionsText: optionsLabel(it.options),
          note: it.note ?? null,
          qty: it.qty,
          lastAt: at,
        });
      }
    }
  }
  return [...map.values()]
    .sort((a, b) => b.lastAt - a.lastAt)
    .map((r) => ({
      key: r.key,
      menuItemId: r.menuItemId,
      optionIds: r.optionIds,
      name: r.name,
      optionsText: r.optionsText,
      note: r.note,
      qty: r.qty,
    }));
}

/** 検索用の正規化: 全角/半角・大小文字・カタカナ/ひらがなの違いと空白を無視する */
export function normalizeForSearch(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/\s+/g, "");
}

/** 注文入力の品目一覧。検索語があればカテゴリをまたいで探す（種類を覚えていなくても引けるように） */
export function filterMenu(menu: MenuItem[], cat: string, query: string): MenuItem[] {
  const q = normalizeForSearch(query);
  if (q) return menu.filter((m) => normalizeForSearch(m.name).includes(q));
  return cat === "すべて" ? menu : menu.filter((m) => m.cat === cat);
}

export interface TableSummary {
  pendingQty: number; // 厨房で作っている（提供前の）杯数
  servedQty: number;
  orderCount: number;
}

/**
 * メニューのまとめて登録の入力を読む。1行1品。
 *   「焼酎 / 富乃宝山」「焼酎,富乃宝山」「焼酎<TAB>富乃宝山」… 行ごとにカテゴリを書く形
 *   「【焼酎】」「# 焼酎」 … 見出し行。以降の行（区切りの無い行）はそのカテゴリになる
 *   区切りも見出しも無い行は defaultCat
 */
export function parseBulkMenu(text: string, defaultCat: string): { cat: string; name: string }[] {
  const out: { cat: string; name: string }[] = [];
  let current = defaultCat;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const heading = line.match(/^(?:【(.+)】|#+\s*(.+))$/);
    if (heading) {
      current = (heading[1] ?? heading[2]).trim() || defaultCat;
      continue;
    }
    const m = line.match(/^(.+?)\s*(?:\t|[/／,，、])\s*(.+)$/);
    if (m) out.push({ cat: m[1].trim(), name: m[2].trim() });
    else out.push({ cat: current, name: line });
  }
  return out;
}

export interface BillLine {
  name: string;
  optionsText: string; // 飲み方・量など（無ければ空）
  qty: number;
}

/** レジ用の一覧: この卓の未会計のドリンクを「品名＋オプション」ごとにまとめる（初めて出た順） */
export function billLines(orders: Order[], tableId: string): BillLine[] {
  const map = new Map<string, BillLine>();
  const sorted = orders
    .filter((o) => o.table === tableId && !o.checkedOutAt)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  for (const o of sorted) {
    for (const it of o.items) {
      const optionsText = optionsLabel(it.options);
      const key = it.name + "\u0000" + optionsText;
      const line = map.get(key);
      if (line) line.qty += it.qty;
      else map.set(key, { name: it.name, optionsText, qty: it.qty });
    }
  }
  return [...map.values()];
}

/** 卓一覧のタイル用の集計。会計済みの繰越伝票(checkedOutAt)は前のお客様の分なので数えない */
export function tableSummary(orders: Order[], tableId: string): TableSummary {
  let pendingQty = 0;
  let servedQty = 0;
  let orderCount = 0;
  for (const o of orders) {
    if (o.table !== tableId || o.checkedOutAt) continue;
    orderCount++;
    const qty = o.items.reduce((a, it) => a + it.qty, 0);
    if (o.status === "cooking") pendingQty += qty;
    else servedQty += qty;
  }
  return { pendingQty, servedQty, orderCount };
}
