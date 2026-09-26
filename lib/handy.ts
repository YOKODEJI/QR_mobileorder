// ハンディ画面（/handy）用の純粋関数。画面から切り離してテストできるようにしている。
import type { MenuItem, Order } from "@/store/useAppStore";
import { optionsLabel } from "@/lib/options";

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
