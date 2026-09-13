import type { ForeignPurchaseItem } from "@/lib/api/foreign-purchases";

/** Conserva monto y moneda como pareja; nunca atribuye USD al importe original sin moneda. */
export function foreignPurchaseDisplayMoney(
  purchase: Pick<ForeignPurchaseItem, "amount_origin" | "currency_origin" | "amount_usd">,
): { amount: number; currency: string } {
  const originalCurrency = purchase.currency_origin?.trim();
  if (purchase.amount_origin != null && originalCurrency) {
    return { amount: Number(purchase.amount_origin), currency: originalCurrency };
  }

  return { amount: Number(purchase.amount_usd), currency: "USD" };
}
