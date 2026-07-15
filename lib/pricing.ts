// 会計金額の計算（税・割引・チャージ料）。
// SQL側(supabase/functions.sql の close_table)にも同じ式を実装しており、常に一致させること。
export type DiscountType = "percent" | "amount" | null;

export interface CheckoutBreakdown {
  subtotal: number; // 品目の合計（メニュー表示価格の合計。内税/外税いずれの場合もこの値そのまま）
  discountAmount: number; // 割引額（円）
  chargeAmount: number; // チャージ料（円）
  taxAmount: number; // 消費税額（外税のときのみ0超）
  total: number; // 最終合計（お客様に請求する額）
}

/**
 * 小計 → 割引 → チャージ料 → (外税なら)消費税 の順で計算する。
 * 円未満は都度四捨五入。
 */
export function computeCheckoutBreakdown(
  subtotal: number,
  discountType: DiscountType,
  discountValue: number,
  chargeRatePercent: number,
  taxMode: "inclusive" | "exclusive",
  taxRatePercent: number
): CheckoutBreakdown {
  let discountAmount = 0;
  if (discountType === "percent") {
    discountAmount = Math.round((subtotal * Math.max(0, discountValue)) / 100);
  } else if (discountType === "amount") {
    discountAmount = Math.round(Math.max(0, discountValue));
  }
  discountAmount = Math.min(discountAmount, subtotal);

  const afterDiscount = subtotal - discountAmount;
  const chargeAmount = Math.round((afterDiscount * Math.max(0, chargeRatePercent)) / 100);
  const preTax = afterDiscount + chargeAmount;
  const taxAmount = taxMode === "exclusive" ? Math.round((preTax * Math.max(0, taxRatePercent)) / 100) : 0;
  const total = preTax + taxAmount;

  return { subtotal, discountAmount, chargeAmount, taxAmount, total };
}

/** 客用画面向け: 税込価格を返す（外税のときだけ加算。内税ならそのまま） */
export function priceWithTax(
  amount: number,
  taxMode: "inclusive" | "exclusive",
  taxRatePercent: number
): number {
  if (taxMode !== "exclusive") return amount;
  return amount + Math.round((amount * Math.max(0, taxRatePercent)) / 100);
}
