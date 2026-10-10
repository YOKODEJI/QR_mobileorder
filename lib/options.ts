// 商品オプション（トッピング等）の型と、カート行キー・価格計算のヘルパー。
// SQL側(supabase/step14-menu-options.sql の options_key / options_delta)と
// 同じ正規化・計算ルールを実装している。常に一致させること。

/** 店舗共通のオプション候補。どの商品に出すかは menu_item_options で紐付ける。 */
export interface MenuOption {
  id: string;
  name: string;
  priceDelta: number; // 追加料金（円）。0円やマイナス（値引き）も可
  sort: number;
  /** 同じ値を持つオプションは「どれか1つを必ず選ぶ」組（例: 量＝一合／グラス）。無ければ個別に付け外しするチェック（step27） */
  choiceGroup?: string | null;
}

/** 「どれか1つを必ず選ぶ」組ごとにまとめる（並び順のまま）。 */
export function choiceGroups(options: readonly MenuOption[]): { group: string; options: MenuOption[] }[] {
  const out: { group: string; options: MenuOption[] }[] = [];
  for (const o of options) {
    if (!o.choiceGroup) continue;
    const g = out.find((x) => x.group === o.choiceGroup);
    if (g) g.options.push(o);
    else out.push({ group: o.choiceGroup, options: [o] });
  }
  return out;
}

/** 数を＋−で合わせる組の中身（数の小さい順）。 */
export interface CountSteps {
  /** 数字の前の言葉（例: 「グラス」） */
  label: string;
  steps: { value: number; option: MenuOption }[];
}

/** 数を＋−で合わせる組かどうか。組の中の名前がすべて「同じ言葉＋数字」（例: グラス0〜グラス10）のときだけ
 *  その一覧を返す。それ以外（一合／グラス、飲み方など）は null＝ボタンで選ぶ組。
 *  数そのものを持つ仕組みは無いので、数ごとのオプションを用意しておき、画面だけ＋−にしている */
export function countSteps(options: readonly MenuOption[]): CountSteps | null {
  if (options.length < 2) return null;
  let label: string | null = null;
  const steps: CountSteps["steps"] = [];
  for (const option of options) {
    const m = option.name.match(/^(.*\D)(\d+)$/);
    if (!m) return null;
    if (label === null) label = m[1];
    else if (label !== m[1]) return null;
    steps.push({ value: Number(m[2]), option });
  }
  steps.sort((a, b) => a.value - b.value);
  if (new Set(steps.map((s) => s.value)).size !== steps.length) return null;
  return { label: label ?? "", steps };
}

/** 個別に付け外しするオプション（組に入っていないもの。例: Cドリンク）。 */
export function freeOptions(options: readonly MenuOption[]): MenuOption[] {
  return options.filter((o) => !o.choiceGroup);
}

/** オプションを1つ押したあとの選択。組のものは同じ組の中で入れ替え（外せない）、個別のものは付け外し。 */
export function toggleOptionId(options: readonly MenuOption[], selected: readonly string[], id: string): string[] {
  const opt = options.find((o) => o.id === id);
  if (!opt) return [...selected];
  if (!opt.choiceGroup) return selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
  const sameGroup = new Set(options.filter((o) => o.choiceGroup === opt.choiceGroup).map((o) => o.id));
  return [...selected.filter((x) => !sameGroup.has(x)), id];
}

/** まだ選んでいない組があるか（あるうちは追加できない）。 */
export function hasMissingChoice(options: readonly MenuOption[], selected: readonly string[]): boolean {
  return choiceGroups(options).some((g) => !g.options.some((o) => selected.includes(o.id)));
}

/** カートの行を別のキーへ移す（確認画面でオプションを付け外ししたとき）。行の位置は保ち、
 *  移動先の行が既にあれば数量を足す。備考は、移動先に備考が無ければ引き継ぐ。 */
export function moveCartLine(
  cart: Record<string, number>,
  notes: Record<string, string>,
  fromKey: string,
  toKey: string
): { cart: Record<string, number>; notes: Record<string, string> } {
  if (fromKey === toKey || !cart[fromKey]) return { cart, notes };
  const merge = toKey in cart;
  const outCart: Record<string, number> = {};
  for (const k of Object.keys(cart)) {
    if (k === fromKey) {
      if (!merge) outCart[toKey] = cart[fromKey];
    } else {
      outCart[k] = k === toKey ? cart[k] + cart[fromKey] : cart[k];
    }
  }
  const outNotes = { ...notes };
  const note = outNotes[fromKey];
  delete outNotes[fromKey];
  if (note && !outNotes[toKey]) outNotes[toKey] = note;
  return { cart: outCart, notes: outNotes };
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
