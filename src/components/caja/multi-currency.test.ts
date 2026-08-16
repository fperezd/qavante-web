import { describe, it, expect } from "vitest";
import type { BankAccountItem, BankMovement } from "@/lib/api/treasury";
import {
  buildMultiCurrencyTotals,
  currencyByAccount,
  currencyCodes,
  formatMovementAmount,
  hasMixedCurrencies,
  noTotalReason,
} from "./multi-currency";

/* INV-FX-001: nunca sumar CLP con USD sin conversión explícita. Estos tests son
   la guarda de regresión de esa invariante en el frontend de Caja. */

const acct = (over: Partial<BankAccountItem>): BankAccountItem =>
  ({
    id: "acc-clp",
    name: "Cuenta Corriente",
    bank_name: "BICE",
    currency_code: "CLP",
    account_type: "checking",
    active: true,
    ...over,
  }) as BankAccountItem;

const mov = (over: Partial<BankMovement>): BankMovement =>
  ({
    id: "m1",
    bank_account_id: "acc-clp",
    external_id: "e1",
    date: "2026-08-05",
    description: "MOV",
    amount: "1000",
    direction: "credit",
    imported_at: "2026-08-05T00:00:00Z",
    ...over,
  }) as BankMovement;

const CUENTAS = [
  acct({ id: "acc-clp", currency_code: "CLP" }),
  acct({ id: "acc-usd", currency_code: "USD", name: "Cuenta USD" }),
];

describe("currencyByAccount", () => {
  it("mapea id → currency_code", () => {
    const map = currencyByAccount(CUENTAS);
    expect(map.get("acc-clp")).toBe("CLP");
    expect(map.get("acc-usd")).toBe("USD");
    expect(map.get("acc-fantasma")).toBeUndefined();
  });
});

describe("hasMixedCurrencies / currencyCodes", () => {
  it("detecta mezcla y lista los códigos ordenados sin repetir", () => {
    expect(hasMixedCurrencies(CUENTAS)).toBe(true);
    expect(currencyCodes(CUENTAS)).toEqual(["CLP", "USD"]);
  });
  it("una sola moneda no es mezcla", () => {
    const solo = [acct({ id: "a" }), acct({ id: "b" })];
    expect(hasMixedCurrencies(solo)).toBe(false);
    expect(currencyCodes(solo)).toEqual(["CLP"]);
  });
  it("sin cuentas no hay mezcla", () => {
    expect(hasMixedCurrencies([])).toBe(false);
    expect(currencyCodes([])).toEqual([]);
  });
});

describe("buildMultiCurrencyTotals", () => {
  const map = currencyByAccount(CUENTAS);

  it("una sola moneda: totaliza y expone la moneda", () => {
    const totals = buildMultiCurrencyTotals(
      [
        mov({ id: "a", amount: "1000", direction: "credit" }),
        mov({ id: "b", amount: "-400", direction: "debit" }),
      ],
      map,
    );
    expect(totals.totalizable).toBe(true);
    expect(totals.currency).toBe("CLP");
    expect(totals.totals).toHaveLength(1);
    expect(totals.totals[0]).toMatchObject({ currency: "CLP", credit: 1000, debit: 400, net: 600 });
    expect(noTotalReason(totals)).toBeNull();
  });

  it("NO suma CLP con USD: un bucket por moneda y sin total único", () => {
    const totals = buildMultiCurrencyTotals(
      [
        mov({ id: "a", bank_account_id: "acc-clp", amount: "1000", direction: "credit" }),
        mov({ id: "b", bank_account_id: "acc-usd", amount: "500", direction: "credit" }),
        mov({ id: "c", bank_account_id: "acc-usd", amount: "-200", direction: "debit" }),
      ],
      map,
    );
    expect(totals.totalizable).toBe(false);
    expect(totals.currency).toBeNull();
    // USD primero: 2 movimientos vs 1 de CLP (orden por count desc).
    expect(totals.totals.map((t) => t.currency)).toEqual(["USD", "CLP"]);
    const usd = totals.totals[0]!;
    const clp = totals.totals[1]!;
    expect(usd).toMatchObject({ credit: 500, debit: 200, net: 300, count: 2 });
    expect(clp).toMatchObject({ credit: 1000, debit: 0, net: 1000, count: 1 });
    // La suma cruda (1000 + 500 - 200 = 1300) NO aparece en ningún lado.
    expect(totals.totals.some((t) => t.net === 1300)).toBe(false);
    expect(noTotalReason(totals)).toContain("CLP y USD");
  });

  it("movimiento de cuenta desconocida: no entra en ningún total, se declara", () => {
    const totals = buildMultiCurrencyTotals(
      [
        mov({ id: "a", bank_account_id: "acc-clp", amount: "1000", direction: "credit" }),
        mov({ id: "z", bank_account_id: "acc-desactivada", amount: "9999", direction: "credit" }),
      ],
      map,
    );
    expect(totals.unknownCount).toBe(1);
    expect(totals.count).toBe(2);
    // El 9999 NO se sumó al bucket CLP (sería inventarle la moneda).
    expect(totals.totals).toHaveLength(1);
    expect(totals.totals[0]).toMatchObject({ currency: "CLP", credit: 1000, count: 1 });
    // Una sola moneda conocida pero con desconocidos ⇒ NO totalizable.
    expect(totals.totalizable).toBe(false);
    expect(totals.currency).toBeNull();
    expect(noTotalReason(totals)).toContain("1 movimiento");
  });

  it("mezcla + desconocidos: el motivo menciona ambas cosas", () => {
    const totals = buildMultiCurrencyTotals(
      [
        mov({ id: "a", bank_account_id: "acc-clp" }),
        mov({ id: "b", bank_account_id: "acc-usd" }),
        mov({ id: "z", bank_account_id: "acc-x" }),
      ],
      map,
    );
    const reason = noTotalReason(totals) ?? "";
    expect(reason).toContain("CLP y USD");
    expect(reason).toContain("sin moneda conocida");
  });

  it("lista vacía: sin totales, no totalizable, sin cero inventado", () => {
    const totals = buildMultiCurrencyTotals([], map);
    expect(totals.totals).toEqual([]);
    expect(totals.totalizable).toBe(false);
    expect(totals.currency).toBeNull();
    expect(totals.count).toBe(0);
  });

  it("montos no parseables cuentan como movimiento pero suman 0", () => {
    const totals = buildMultiCurrencyTotals(
      [mov({ id: "a", amount: "no-es-numero", direction: "credit" })],
      map,
    );
    expect(totals.totals[0]).toMatchObject({ currency: "CLP", credit: 0, count: 1 });
  });

  it("usa MAGNITUD: el débito negativo del banco no infla el neto", () => {
    const totals = buildMultiCurrencyTotals(
      [
        mov({ id: "a", amount: "1000", direction: "credit" }),
        mov({ id: "b", amount: "-1000", direction: "debit" }),
      ],
      map,
    );
    // neto = 1000 − 1000 = 0 (no 2000, que es el bug de sumar el negativo).
    expect(totals.totals[0]!.net).toBe(0);
  });
});

describe("formatMovementAmount", () => {
  it("formatea en la moneda de la cuenta", () => {
    expect(formatMovementAmount(1000, "CLP")).toContain("1.000");
    expect(formatMovementAmount(1000, "USD")).toContain("US$");
  });
  it("moneda desconocida: NO cae a CLP, lo declara", () => {
    const out = formatMovementAmount(1000, undefined);
    expect(out).toContain("moneda s/d");
    expect(out).not.toContain("$");
  });
});
