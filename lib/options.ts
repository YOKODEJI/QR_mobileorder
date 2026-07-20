// 商品オプション（トッピング等）の型と、カート行キー・価格計算のヘルパー。
// SQL側(supabase/step14-menu-options.sql の options_key / options_delta)と
// 同じ正規化・計算ルールを実装している。常に一致させること。

/** 店舗共通のオプション候補。どの商品に出すかは menu_item_options で紐付ける。 */
export interface MenuOption {
  id: string;
  name: string;
  priceDelta: number; // 追加料金（円）。0円やマイナス（値引き）も可
  sort: number;
}

/** 注文明細に焼き付ける、選択されたオプションのスナップショット。 */
export interface SelectedOption {
  id: string;
  name: string;
  priceDelta: number;
}

/** オプションIDの正規化（昇順・重複排除）。
 *  「同じ組み合わせを違う順で選んだだけ」を同一視するための唯一のルール。 */
export function normalizeOptionIds(ids: readonly string[]): string[] {
  return Array.from(new Set(ids)).sort();
}

/** カート行キー: 「商品ID|オプションID昇順のカンマ連結」。
 *  同じ商品でもオプションの組み合わせが違えば別の行として数量を管理する。 */
export function cartKey(menuItemId: string, optionIds: readonly string[] = []): string {
  return menuItemId + "|" + normalizeOptionIds(optionIds).join(",");
}

/** カート行キーを分解する。旧形式（"|"無しの商品IDのみ）も読めるようにしておく。 */
export function parseCartKey(key: string): { menuItemId: string; optionIds: string[] } {
  const i = key.indexOf("|");
  if (i === -1) return { menuItemId: key, optionIds: [] };
  const rest = key.slice(i + 1);
  return { menuItemId: key.slice(0, i), optionIds: rest ? rest.split(",") : [] };
}

/** 選択オプションの追加料金合計。 */
export function optionsDelta(options: readonly SelectedOption[] | undefined): number {
  if (!options || options.length === 0) return 0;
  return options.reduce((sum, o) => sum + o.priceDelta, 0);
}

/** 明細1個あたりの実売価（本体単価 + オプション追加料金）。
 *  order_items.price は本体単価のみを保持しているため、金額表示は必ずこれを通すこと。 */
export function unitPrice(basePrice: number, options?: readonly SelectedOption[]): number {
  return basePrice + optionsDelta(options);
}

/** 明細行の小計（実売価 × 数量）。 */
export function lineTotal(item: {
  price: number;
  qty: number;
  options?: readonly SelectedOption[];
}): number {
  return unitPrice(item.price, item.options) * item.qty;
}

/** 表示用のオプション名（例: 「大盛り・ネギ増し」）。無選択なら空文字。 */
export function optionsLabel(options: readonly SelectedOption[] | undefined): string {
  if (!options || options.length === 0) return "";
  return options.map((o) => o.name).join("・");
}
