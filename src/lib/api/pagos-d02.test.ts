import { describe, expect, it } from "vitest";
import { pagos } from "@/components/pagar/v05/pagar-v05-fixtures";
import {
  accountsPayablePath,
  accountsPayableQueryOptions,
  assertAccountsPayableResponse,
  pagosKeys,
} from "./pagos";

describe("accounts payable D02 boundary", () => {
  it("serializa filtros y cursor en orden estable, con búsqueda normalizada", () => {
    const query = {
      cursor: "opaque+cursor",
      limit: 25,
      category: "payroll" as const,
      criticality: "high" as const,
      due_from: "2026-09-01",
      due_to: "2026-09-30",
      state: "open" as const,
      search: "  76.222.222-2  ",
    };
    expect(accountsPayablePath(query)).toBe(
      "/api/treasury/accounts-payable?cursor=opaque%2Bcursor&limit=25&category=payroll&criticality=high&due_from=2026-09-01&due_to=2026-09-30&state=open&search=76.222.222-2",
    );
    expect(pagosKeys.accountsPayable(query)).toContainEqual({ ...query, search: "76.222.222-2" });
  });

  it("acepta el contrato D02 íntegro y rechaza el payload legacy", () => {
    expect(assertAccountsPayableResponse(pagos()).snapshot_id).toHaveLength(64);
    expect(() => assertAccountsPayableResponse({ total: "0", items: [], has_more: false })).toThrow(
      /contrato completo/,
    );
  });

  it("acepta moneda no verificable declarada y rechaza estados de moneda ausentes", () => {
    const base = pagos();
    const unknownCurrency = {
      ...base.items![0]!,
      currency: null,
      currency_status: "unknown",
      amount_clp: null,
    };
    expect(assertAccountsPayableResponse({ ...base, items: [unknownCurrency] }).items![0]).toEqual(
      unknownCurrency,
    );
    expect(() =>
      assertAccountsPayableResponse({
        ...base,
        items: [{ ...base.items![0]!, currency_status: undefined }],
      }),
    ).toThrow(/contrato completo/);
    expect(() => assertAccountsPayableResponse({ ...base, items: [{ ...base.items![0]!, currency: null, currency_status: "verified" }] })).toThrow(/contrato completo/);
    expect(() => assertAccountsPayableResponse({ ...base, items: [{ ...base.items![0]!, currency: "USD", currency_status: "unknown" }] })).toThrow(/contrato completo/);
  });

  it("rechaza invariantes inconsistentes de cursor y facets", () => {
    expect(() =>
      assertAccountsPayableResponse(pagos({ has_more: true, next_cursor: null })),
    ).toThrow();
    expect(() =>
      assertAccountsPayableResponse(
        pagos({ filter_metadata: { ...pagos().filter_metadata, matched_items_total: 7 } }),
      ),
    ).toThrow();
  });

  it("exige exactamente buk y previred únicos en cobertura de nómina", () => {
    const source = pagos().payroll_coverage.sources[0]!;
    expect(() =>
      assertAccountsPayableResponse(
        pagos({ payroll_coverage: { complete: false, sources: [source, { ...source }] } }),
      ),
    ).toThrow(/contrato completo/);
  });

  it("rechaza complete cuando ambas fuentes no están cubiertas y frescas", () => {
    const payroll = pagos().payroll_coverage;
    expect(() =>
      assertAccountsPayableResponse(
        pagos({
          payroll_coverage: {
            complete: true,
            sources: payroll.sources.map((source, index) =>
              index === 0 ? { ...source, freshness_confirmed: false } : source,
            ),
          },
        }),
      ),
    ).toThrow(/contrato completo/);
  });

  it("no conserva datos de la consulta anterior al cambiar filtros", () => {
    expect(accountsPayableQueryOptions({ category: "tax" })).not.toHaveProperty("placeholderData");
  });

  it("rechaza campos financieros ausentes o con shapes inválidos", () => {
    const base = pagos();
    expect(() => assertAccountsPayableResponse({ ...base, credits: undefined })).toThrow();
    expect(() => assertAccountsPayableResponse({ ...base, due_14d: "no-es-monto" })).toThrow();
    expect(() => assertAccountsPayableResponse({ ...base, zero_balance_count: -1 })).toThrow();
    expect(() =>
      assertAccountsPayableResponse({
        ...base,
        filter_metadata: { ...base.filter_metadata, by_state: [] },
      }),
    ).toThrow();
    expect(() => assertAccountsPayableResponse({ ...base, by_category: [] })).toThrow();
  });

  it("rechaza contradicciones de agregados y de la curva de caja", () => {
    const base = pagos();
    expect(() =>
      assertAccountsPayableResponse({ ...base, cash_gap_amount_14d: "999" }),
    ).toThrow();
    expect(() =>
      assertAccountsPayableResponse({ ...base, cash_projection_publicable_14d: false }),
    ).toThrow();
    expect(() => assertAccountsPayableResponse({ ...base, covers_critical: true })).toThrow();
    expect(() =>
      assertAccountsPayableResponse({
        ...base,
        overdue_summary: { ...base.overdue_summary, complete: false },
      }),
    ).toThrow();
    expect(() => assertAccountsPayableResponse({ ...base, total: "1" })).toThrow();
  });

  it("rechaza montos negativos en los agregados positivos", () => {
    const base = pagos();
    for (const field of ["overdue_summary", "non_postponable_or_overdue_14d"] as const) {
      expect(() =>
        assertAccountsPayableResponse({
          ...base,
          [field]: {
            ...base[field],
            amount_clp: "-100",
            known_amount_clp: "-100",
          },
        }),
      ).toThrow(/contrato completo/);
    }
  });

  it("exige status y last_success_at válido en cada fuente de nómina", () => {
    const base = pagos();
    const [buk, previred] = base.payroll_coverage.sources;
    expect(() =>
      assertAccountsPayableResponse({
        ...base,
        payroll_coverage: {
          complete: true,
          sources: [{ ...buk, status: undefined }, previred],
        },
      }),
    ).toThrow(/contrato completo/);
    expect(() =>
      assertAccountsPayableResponse({
        ...base,
        payroll_coverage: {
          complete: true,
          sources: [buk, { ...previred, last_success_at: 123 }],
        },
      }),
    ).toThrow(/contrato completo/);
    for (const last_success_at of ["2026-02-30T12:00:00Z", "2026-02-28T12:00:00"]) {
      expect(() =>
        assertAccountsPayableResponse({
          ...base,
          payroll_coverage: {
            complete: true,
            sources: [buk, { ...previred, last_success_at }],
          },
        }),
      ).toThrow(/contrato completo/);
    }
  });

  it("rechaza fechas de negocio imposibles y generated_at no RFC3339", () => {
    const base = pagos();
    expect(() => assertAccountsPayableResponse({ ...base, as_of: "2026-02-30" })).toThrow();
    expect(() => assertAccountsPayableResponse({ ...base, as_of: "2026-99-99" })).toThrow();
    expect(() =>
      assertAccountsPayableResponse({
        ...base,
        items: [{ ...base.items![0]!, due_date: "2026-02-30" }],
      }),
    ).toThrow();
    expect(() =>
      assertAccountsPayableResponse({
        ...base,
        next_payroll: { ...base.next_payroll!, due_date: "2026-99-99" },
      }),
    ).toThrow();
    expect(() =>
      assertAccountsPayableResponse({ ...base, generated_at: "2026-02-28T12:00:00" }),
    ).toThrow();
    expect(() =>
      assertAccountsPayableResponse({ ...base, generated_at: "2026-02-30T12:00:00Z" }),
    ).toThrow();
  });
});
