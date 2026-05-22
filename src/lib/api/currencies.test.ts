/* Sanity del contrato currencies vía MSW + estabilidad de query keys
   (Addendum §15.2/§15.4/§15.7). Si rompe tras tocar handlers.ts o
   currencies.ts, el mock dejó de respetar el shape Currency /
   ExchangeRateLookupResponse / CompanyCurrencySettings que la UI espera. */
import { describe, expect, it } from "vitest";
import {
  currenciesKeys,
  type Currency,
  type ExchangeRateLookupResponse,
  type CompanyCurrencySettings,
} from "./currencies";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

describe("currenciesKeys", () => {
  it("namespacing estable", () => {
    expect(currenciesKeys.all).toEqual(["currencies"]);
    expect(currenciesKeys.list()).toEqual(["currencies", "list"]);
    expect(currenciesKeys.companySettings()).toEqual(["currencies", "company-settings"]);
  });

  it("exchangeRate key varía por params (cache discriminado)", () => {
    const a = currenciesKeys.exchangeRate({ base: "USD", quote: "CLP" });
    const b = currenciesKeys.exchangeRate({ base: "EUR", quote: "CLP" });
    expect(a).not.toEqual(b);
    /* misma estructura, mismo prefijo */
    expect(a[0]).toBe("currencies");
    expect(a[1]).toBe("exchange-rate");
  });
});

describe("MSW — GET /api/core/currencies", () => {
  it("devuelve catálogo con shape Currency completo", async () => {
    const r = await fetch(`${API}/api/core/currencies`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as { items: Currency[] };
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);

    for (const c of body.items) {
      expect(typeof c.code).toBe("string");
      expect(typeof c.name).toBe("string");
      expect(["fiat", "indexed_unit"]).toContain(c.currency_type);
      expect(typeof c.decimals).toBe("number");
      expect(typeof c.active).toBe("boolean");
    }
  });

  it("incluye CLP fiat (functional default Chile) + UF indexed_unit", async () => {
    const r = await fetch(`${API}/api/core/currencies`);
    const body = (await r.json()) as { items: Currency[] };
    const clp = body.items.find((c) => c.code === "CLP");
    const uf = body.items.find((c) => c.code === "UF");
    expect(clp?.currency_type).toBe("fiat");
    expect(clp?.decimals).toBe(0);
    expect(uf?.currency_type).toBe("indexed_unit");
  });
});

describe("MSW — GET /api/core/exchange-rates", () => {
  it("par conocido (USD→CLP) → data_status=ok + rate poblado", async () => {
    const r = await fetch(`${API}/api/core/exchange-rates?base=USD&quote=CLP`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as ExchangeRateLookupResponse;
    expect(body.data_status).toBe("ok");
    expect(body.rate).not.toBeNull();
    expect(body.rate?.base_currency_code).toBe("USD");
    expect(body.rate?.quote_currency_code).toBe("CLP");
    expect(typeof body.rate?.rate).toBe("string");
  });

  it("par ausente (XXX→CLP) → data_status=requires_attention + rate=null (§15.7)", async () => {
    const r = await fetch(`${API}/api/core/exchange-rates?base=XXX&quote=CLP`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as ExchangeRateLookupResponse;
    expect(body.data_status).toBe("requires_attention");
    expect(body.rate).toBeNull();
  });

  it("falta base o quote → 422 validation_error", async () => {
    const r = await fetch(`${API}/api/core/exchange-rates?base=USD`);
    expect(r.status).toBe(422);
  });
});

describe("MSW — company-currency-settings", () => {
  it("GET → settings sembrados (CLP funcional + UF indexed_unit)", async () => {
    const r = await fetch(`${API}/api/core/company-currency-settings`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as CompanyCurrencySettings;
    expect(body.functional_currency_code).toBe("CLP");
    expect(body.indexed_unit_enabled).toBe(true);
    expect(body.indexed_unit_currency_code).toBe("UF");
    expect(Array.isArray(body.reporting_currency_codes)).toBe(true);
  });

  it("PATCH parcial → solo actualiza campos presentes, preserva resto", async () => {
    /* Cambiamos reporting; functional debe seguir CLP. */
    const r = await fetch(`${API}/api/core/company-currency-settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reporting_currency_codes: ["USD"] }),
    });
    expect(r.status).toBe(200);
    const body = (await r.json()) as CompanyCurrencySettings;
    expect(body.functional_currency_code).toBe("CLP"); // preservado
    expect(body.reporting_currency_codes).toEqual(["USD"]); // actualizado
  });
});
