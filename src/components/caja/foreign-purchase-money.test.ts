import { describe, expect, it } from "vitest";
import { foreignPurchaseDisplayMoney } from "./foreign-purchase-money";

describe("foreignPurchaseDisplayMoney", () => {
  it("muestra el importe original sólo cuando también conoce su moneda", () => {
    expect(
      foreignPurchaseDisplayMoney({
        amount_origin: "100.00",
        currency_origin: "EUR",
        amount_usd: "110.00",
      }),
    ).toEqual({ amount: 100, currency: "EUR" });
  });

  it("usa la pareja USD publicada cuando falta la moneda del importe original", () => {
    expect(
      foreignPurchaseDisplayMoney({
        amount_origin: "100.00",
        currency_origin: null,
        amount_usd: "110.00",
      }),
    ).toEqual({ amount: 110, currency: "USD" });
  });
});
