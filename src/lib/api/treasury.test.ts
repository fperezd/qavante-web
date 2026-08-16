/* Sanity del contrato canonical-categories vía MSW + estabilidad de query
   keys. Si rompe tras tocar handlers.ts o treasury.ts, el mock dejó de
   respetar el shape §10.1 (CanonicalCategoryMeta) que la UI espera. */
import { describe, expect, it } from "vitest";
import {
  treasuryKeys,
  monthsInRange,
  buildBankMovementsQuery,
  type CanonicalCategoryMeta,
  type BankMovementsListResponse,
  type BankMovement,
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
});

/* Los filtros de Caja del contrato (api PR #653): `bank_account_id` es el que
   permite NO mezclar CLP y USD, así que su traducción camelCase → snake_case es
   parte de la garantía INV-FX-001, no un detalle cosmético. */
describe("buildBankMovementsQuery", () => {
  it("sin params no arma querystring", () => {
    expect(buildBankMovementsQuery({})).toBe("");
  });

  it("traduce cada param al nombre del contrato", () => {
    const qs = buildBankMovementsQuery({
      status: "classified",
      periodFrom: "2026-01",
      periodTo: "2026-08",
      direction: "debit",
      bankAccountId: "acc-usd",
      limit: 500,
      offset: 0,
    });
    const params = new URLSearchParams(qs.slice(1));
    expect(params.get("status")).toBe("classified");
    expect(params.get("period_from")).toBe("2026-01");
    expect(params.get("period_to")).toBe("2026-08");
    expect(params.get("direction")).toBe("debit");
    expect(params.get("bank_account_id")).toBe("acc-usd");
    expect(params.get("limit")).toBe("500");
    expect(params.get("offset")).toBe("0");
  });

  it("omite los params vacíos (no manda bank_account_id='' = todas las cuentas)", () => {
    const qs = buildBankMovementsQuery({ status: "unclassified", bankAccountId: "" });
    const params = new URLSearchParams(qs.slice(1));
    expect(params.has("bank_account_id")).toBe(false);
    expect(params.get("status")).toBe("unclassified");
  });

  it("`period` (un mes) es independiente del rango", () => {
    const params = new URLSearchParams(buildBankMovementsQuery({ period: "2026-08" }).slice(1));
    expect(params.get("period")).toBe("2026-08");
    expect(params.has("period_from")).toBe(false);
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
