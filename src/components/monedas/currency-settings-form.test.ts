/* Tests del schema + transforms del editor de Ajustes de Monedas
   (Addendum §15.4/§15.6). Validamos coherencia cliente-side antes de
   pegarle al backend: funcional ≠ reporting, default_reporting ∈ reporting,
   indexed_unit_enabled ⇒ code presente. */
import { describe, expect, it } from "vitest";
import {
  settingsSchema,
  settingsToForm,
  formToRequest,
  type SettingsFormValues,
} from "./currency-settings-form";
import type { CompanyCurrencySettings } from "@/lib/api/currencies";

function validForm(overrides: Partial<SettingsFormValues> = {}): SettingsFormValues {
  return {
    functional_currency_code: "CLP",
    default_reporting_currency_code: "",
    reporting_currency_codes: ["USD"],
    indexed_unit_enabled: false,
    indexed_unit_currency_code: "",
    default_exchange_rate_source: "",
    ...overrides,
  };
}

describe("settingsSchema — validación de coherencia (§15.4/§15.6)", () => {
  it("acepta un form mínimo válido (funcional + un reporting)", () => {
    const r = settingsSchema.safeParse(validForm());
    expect(r.success).toBe(true);
  });

  it("acepta funcional sin reporting (config mínima)", () => {
    const r = settingsSchema.safeParse(validForm({ reporting_currency_codes: [] }));
    expect(r.success).toBe(true);
  });

  it("rechaza funcional dentro de reporting (§15.2 — roles disjuntos)", () => {
    const r = settingsSchema.safeParse(
      validForm({
        functional_currency_code: "USD",
        reporting_currency_codes: ["USD", "EUR"],
      }),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path.includes("reporting_currency_codes"));
      expect(issue?.message).toMatch(/funcional/i);
    }
  });

  it("rechaza default_reporting fuera de reporting_codes", () => {
    const r = settingsSchema.safeParse(
      validForm({
        reporting_currency_codes: ["USD"],
        default_reporting_currency_code: "EUR",
      }),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path.includes("default_reporting_currency_code"));
      expect(issue?.message).toMatch(/reporte por defecto/i);
    }
  });

  it("acepta default_reporting cuando está en reporting_codes", () => {
    const r = settingsSchema.safeParse(
      validForm({
        reporting_currency_codes: ["USD", "EUR"],
        default_reporting_currency_code: "USD",
      }),
    );
    expect(r.success).toBe(true);
  });

  it("rechaza indexed_unit_enabled=true sin code (§15.6)", () => {
    const r = settingsSchema.safeParse(
      validForm({
        indexed_unit_enabled: true,
        indexed_unit_currency_code: "",
      }),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path.includes("indexed_unit_currency_code"));
      expect(issue?.message).toMatch(/unidad indexada/i);
    }
  });

  it("acepta indexed_unit_enabled=true con code presente", () => {
    const r = settingsSchema.safeParse(
      validForm({
        indexed_unit_enabled: true,
        indexed_unit_currency_code: "UF",
      }),
    );
    expect(r.success).toBe(true);
  });

  it("rechaza functional vacío", () => {
    const r = settingsSchema.safeParse(validForm({ functional_currency_code: "" }));
    expect(r.success).toBe(false);
  });
});

describe("settingsToForm — snapshot → defaults", () => {
  it("settings=null → defaults Chile (CLP + sin reporting + sin UF)", () => {
    const v = settingsToForm(null);
    expect(v.functional_currency_code).toBe("CLP");
    expect(v.reporting_currency_codes).toEqual([]);
    expect(v.indexed_unit_enabled).toBe(false);
    expect(v.indexed_unit_currency_code).toBe("");
    expect(v.default_reporting_currency_code).toBe("");
    expect(v.default_exchange_rate_source).toBe("");
  });

  it("mapea null → '' para strings opcionales (UX: '' = sin valor)", () => {
    const s: CompanyCurrencySettings = {
      tenant_id: "t1",
      functional_currency_code: "CLP",
      default_reporting_currency_code: null,
      reporting_currency_codes: [],
      indexed_unit_enabled: false,
      indexed_unit_currency_code: null,
      default_exchange_rate_source: null,
      updated_at: "2026-05-22T00:00:00Z",
    };
    const v = settingsToForm(s);
    expect(v.default_reporting_currency_code).toBe("");
    expect(v.indexed_unit_currency_code).toBe("");
    expect(v.default_exchange_rate_source).toBe("");
  });

  it("preserva configuración completa (CLP + UF + reporting USD/EUR + BCCH)", () => {
    const s: CompanyCurrencySettings = {
      tenant_id: "t1",
      functional_currency_code: "CLP",
      default_reporting_currency_code: "USD",
      reporting_currency_codes: ["USD", "EUR"],
      indexed_unit_enabled: true,
      indexed_unit_currency_code: "UF",
      default_exchange_rate_source: "BCCH",
      updated_at: "2026-05-22T00:00:00Z",
    };
    const v = settingsToForm(s);
    expect(v).toEqual({
      functional_currency_code: "CLP",
      default_reporting_currency_code: "USD",
      reporting_currency_codes: ["USD", "EUR"],
      indexed_unit_enabled: true,
      indexed_unit_currency_code: "UF",
      default_exchange_rate_source: "BCCH",
    });
  });
});

describe("formToRequest — form → PATCH body", () => {
  it("mapea '' → null en campos opcionales (semántica de limpiar)", () => {
    const body = formToRequest(validForm());
    expect(body.functional_currency_code).toBe("CLP");
    expect(body.default_reporting_currency_code).toBeNull();
    expect(body.default_exchange_rate_source).toBeNull();
  });

  it("indexed_unit_enabled=false → fuerza indexed_unit_currency_code=null (reset)", () => {
    const body = formToRequest(
      validForm({
        indexed_unit_enabled: false,
        indexed_unit_currency_code: "UF",
      }),
    );
    expect(body.indexed_unit_enabled).toBe(false);
    expect(body.indexed_unit_currency_code).toBeNull();
  });

  it("indexed_unit_enabled=true con code → manda el code", () => {
    const body = formToRequest(
      validForm({
        indexed_unit_enabled: true,
        indexed_unit_currency_code: "UF",
      }),
    );
    expect(body.indexed_unit_enabled).toBe(true);
    expect(body.indexed_unit_currency_code).toBe("UF");
  });

  it("reporting_currency_codes se mantiene como array (incluso vacío)", () => {
    const empty = formToRequest(validForm({ reporting_currency_codes: [] }));
    expect(empty.reporting_currency_codes).toEqual([]);

    const filled = formToRequest(validForm({ reporting_currency_codes: ["USD", "EUR"] }));
    expect(filled.reporting_currency_codes).toEqual(["USD", "EUR"]);
  });
});
