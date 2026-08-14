/* Sanity del contrato canonical-categories vía MSW + estabilidad de query
   keys. Si rompe tras tocar handlers.ts o treasury.ts, el mock dejó de
   respetar el shape §10.1 (CanonicalCategoryMeta) que la UI espera. */
import { describe, expect, it } from "vitest";
import {
  treasuryKeys,
  monthsInRange,
  type CanonicalCategoryMeta,
  type BankMovementsListResponse,
  type BankMovement,
} from "./treasury";
/* Import aparte a propósito: el bloque de arriba también lo edita la rama del PR #934
   (`caja/selector-cuenta-moneda`) y tocarlo garantizaba un conflicto de merge tonto. */
import {
  currencyByBankAccount,
  groupUnclassifiedInflowByCurrency,
  type BankAccountItem,
} from "./treasury";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

describe("treasuryKeys", () => {
  it("canonicalCategories key es estable y namespaced", () => {
    expect(treasuryKeys.canonicalCategories()).toEqual(["treasury", "canonical-categories"]);
    expect(treasuryKeys.all).toEqual(["treasury"]);
  });

  it("bankMovements key namespaced y varía por params", () => {
    expect(treasuryKeys.bankMovements({ status: "unclassified" })).toEqual([
      "treasury",
      "bank-movements",
      { status: "unclassified" },
    ]);
    expect(treasuryKeys.bankMovements({ status: "unclassified" })).not.toEqual(
      treasuryKeys.bankMovements({ status: "classified" }),
    );
  });

  /* El mapa de monedas pide las cuentas CON las desactivadas (`?active=false`) y el selector solo
     las activas: son dos respuestas distintas y no pueden compartir entrada de caché. El prefijo
     común es lo que permite invalidar las dos de una. */
  it("bankAccounts key separa la variante con cuentas desactivadas, bajo un prefijo común", () => {
    expect(treasuryKeys.bankAccounts()).toEqual(["treasury", "bank-accounts", false]);
    expect(treasuryKeys.bankAccounts(true)).toEqual(["treasury", "bank-accounts", true]);
    expect(treasuryKeys.bankAccounts(true)).not.toEqual(treasuryKeys.bankAccounts());
    const prefijo = treasuryKeys.bankAccountsAll();
    expect(prefijo).toEqual(["treasury", "bank-accounts"]);
    for (const key of [treasuryKeys.bankAccounts(), treasuryKeys.bankAccounts(true)]) {
      expect(key.slice(0, prefijo.length)).toEqual([...prefijo]);
    }
  });
});

describe("monthsInRange", () => {
  it("expande el rango inclusive, mismo año y cruzando año", () => {
    expect(monthsInRange("2026-07", "2026-08")).toEqual(["2026-07", "2026-08"]);
    expect(monthsInRange("2026-01", "2026-03")).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(monthsInRange("2025-11", "2026-01")).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
  it("un solo mes → un elemento; from>to → vacío; sin extremos → vacío", () => {
    expect(monthsInRange("2026-07", "2026-07")).toEqual(["2026-07"]);
    expect(monthsInRange("2026-08", "2026-07")).toEqual([]);
    expect(monthsInRange(undefined, "2026-07")).toEqual([]);
    expect(monthsInRange("2026-07", undefined)).toEqual([]);
  });
  it("acota a 24 meses (guarda anti-runaway)", () => {
    expect(monthsInRange("2020-01", "2030-01").length).toBe(24);
  });
});

describe("MSW — GET /api/treasury/canonical-categories", () => {
  it("devuelve 200 + items con el shape §10.1 completo", async () => {
    const r = await fetch(`${API}/api/treasury/canonical-categories`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as { items: CanonicalCategoryMeta[] };
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);

    for (const it of body.items) {
      expect(typeof it.code).toBe("string");
      expect(typeof it.label).toBe("string");
      expect(typeof it.description).toBe("string");
      expect(typeof it.expected_direction).toBe("string");
      expect(typeof it.cashflow_group).toBe("string");
      expect(typeof it.requires_review).toBe("boolean");
      expect(typeof it.allowed_for_bank_movement).toBe("boolean");
      expect(typeof it.sort_order).toBe("number");
    }
  });

  it("incluye 'unknown' → label humano 'Por clasificar' (§11)", async () => {
    const r = await fetch(`${API}/api/treasury/canonical-categories`);
    const body = (await r.json()) as { items: CanonicalCategoryMeta[] };
    const unknown = body.items.find((c) => c.code === "unknown");
    expect(unknown?.label).toBe("Por clasificar");
  });
});

describe("MSW — bank-movements (status + period filters)", () => {
  it("GET /api/bank-movements?status=unclassified → solo movimientos sin canonical_category", async () => {
    const r = await fetch(`${API}/api/bank-movements?status=unclassified`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as BankMovementsListResponse;
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
    for (const m of body.items) {
      expect(m.canonical_category).toBeNull();
    }
  });

  it("GET /api/bank-movements?status=classified → solo movimientos con canonical_category", async () => {
    const r = await fetch(`${API}/api/bank-movements?status=classified`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as BankMovementsListResponse;
    expect(body.items.length).toBeGreaterThan(0);
    for (const m of body.items) {
      expect(m.canonical_category).not.toBeNull();
      expect(typeof m.canonical_category).toBe("string");
    }
  });

  it("GET /api/bank-movements (sin status) → devuelve TODOS", async () => {
    const r = await fetch(`${API}/api/bank-movements`);
    const body = (await r.json()) as BankMovementsListResponse;
    const classifiedCount = body.items.filter((m) => m.canonical_category != null).length;
    const unclassifiedCount = body.items.filter((m) => m.canonical_category == null).length;
    expect(classifiedCount).toBeGreaterThan(0);
    expect(unclassifiedCount).toBeGreaterThan(0);
  });

  it("GET /api/bank-movements?period=2026-05 → filtra por mes", async () => {
    const r = await fetch(`${API}/api/bank-movements?period=2026-05`);
    const body = (await r.json()) as BankMovementsListResponse;
    for (const m of body.items) {
      expect(m.date.startsWith("2026-05")).toBe(true);
    }
  });

  it("GET /api/bank-movements?period=202604 → acepta formato compacto YYYYMM", async () => {
    /* El backend live acepta YYYY-MM, YYYYMM y "mes año". El handler MSW
       simula los dos numéricos; el FE normaliza a YYYY-MM antes (regla 16). */
    const r = await fetch(`${API}/api/bank-movements?period=202605`);
    const body = (await r.json()) as BankMovementsListResponse;
    expect(Array.isArray(body.items)).toBe(true);
    for (const m of body.items) {
      expect(m.date.startsWith("2026-05")).toBe(true);
    }
  });

  it("PATCH /api/bank-movements/:id/classify → devuelve el movimiento clasificado", async () => {
    const r = await fetch(`${API}/api/bank-movements/mov-unclas-1/classify`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        management_account_id: "acc-9",
        canonical_category: "supplier_payment",
      }),
    });
    expect(r.status).toBe(200);
    const body = (await r.json()) as BankMovement;
    expect(body.id).toBe("mov-unclas-1");
    expect(body.management_account_id).toBe("acc-9");
    expect(body.canonical_category).toBe("supplier_payment");
  });
});

/* INV-FX-001 — las entradas sin clasificar NO se suman entre monedas. El bug cerrado acá:
   `useUnclassifiedInRange` acumulaba `Math.abs(amount)` de TODAS las cuentas en un solo
   `inflow`, que después se pintaba con `formatClp` (afirmando pesos sobre una mezcla) y, peor,
   alimentaba el umbral `incompleto` que el usuario ve. `BankMovement` no trae moneda: sale de
   la cuenta (`BankAccountItem.currency_code`) vía `bank_account_id`. */
describe("groupUnclassifiedInflowByCurrency", () => {
  const mv = (over: Partial<BankMovement>): BankMovement =>
    ({
      id: "m",
      bank_account_id: "acc-clp",
      external_id: "x",
      date: "2026-07-10",
      description: "d",
      amount: "1000",
      direction: "credit",
      canonical_category: null,
      ...over,
    }) as BankMovement;

  const cuentas = currencyByBankAccount([
    { id: "acc-clp", currency_code: "clp" },
    { id: "acc-usd", currency_code: "USD" },
  ] as BankAccountItem[]);

  it("dos monedas → un total por moneda, jamás sumadas (INV-FX-001)", () => {
    const r = groupUnclassifiedInflowByCurrency(
      [
        mv({ id: "1", bank_account_id: "acc-clp", amount: "61500000" }),
        mv({ id: "2", bank_account_id: "acc-usd", amount: "1200" }),
        mv({ id: "3", bank_account_id: "acc-usd", amount: "-800", direction: "debit" }),
      ],
      cuentas,
    );
    // Normaliza "clp" → "CLP" y ordena por código; el USD egreso cuenta pero no suma al inflow.
    expect(r.inflowByCurrency).toEqual([
      { currency: "CLP", inflow: 61_500_000, count: 1 },
      { currency: "USD", inflow: 1200, count: 2 },
    ]);
    // La suma mezclada del bug habría dado 61.502.000 "pesos". Ese número no existe acá.
    expect(r.inflowByCurrency.some((c) => c.inflow === 61_502_000)).toBe(false);
    expect(r.unknownCurrencyCount).toBe(0);
    expect(r.unknownInflowCount).toBe(0);
  });

  it("moneda desconocida (cuenta fuera del listado) → aparte, fuera de todo total", () => {
    const r = groupUnclassifiedInflowByCurrency(
      [
        mv({ id: "1", bank_account_id: "acc-clp", amount: "5000" }),
        mv({ id: "2", bank_account_id: "acc-fantasma", amount: "900" }),
        mv({ id: "3", bank_account_id: "acc-fantasma", amount: "-400", direction: "debit" }),
      ],
      cuentas,
    );
    expect(r.inflowByCurrency).toEqual([{ currency: "CLP", inflow: 5000, count: 1 }]);
    expect(r.unknownCurrencyCount).toBe(2);
    expect(r.unknownInflowCount).toBe(1); // solo la entrada
  });

  it("cuenta con currency_code vacío = desconocida (no cae a CLP)", () => {
    const sinCodigo = currencyByBankAccount([
      { id: "acc-clp", currency_code: "" },
    ] as BankAccountItem[]);
    const r = groupUnclassifiedInflowByCurrency([mv({ amount: "7000" })], sinCodigo);
    expect(r.inflowByCurrency).toEqual([]);
    expect(r.unknownInflowCount).toBe(1);
  });

  it("monto no parseable cuenta el movimiento pero suma 0 (no NaN en una cifra financiera)", () => {
    const r = groupUnclassifiedInflowByCurrency([mv({ amount: "s/d" })], cuentas);
    expect(r.inflowByCurrency).toEqual([{ currency: "CLP", inflow: 0, count: 1 }]);
  });

  it("sin cuentas cargadas → TODO desconocido (no se asume pesos)", () => {
    const r = groupUnclassifiedInflowByCurrency([mv({}), mv({ id: "2" })], new Map());
    expect(r.inflowByCurrency).toEqual([]);
    expect(r.unknownCurrencyCount).toBe(2);
  });
});
