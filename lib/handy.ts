// ハンディ画面（/handy）用の純粋関数。画面から切り離してテストできるようにしている。
import type { MenuItem, Order } from "@/store/useAppStore";

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
