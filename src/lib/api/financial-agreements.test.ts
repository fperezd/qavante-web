import { describe, expect, it } from "vitest";
import {
  agreementSubjectKey,
  buildFormalizedAgreementIndex,
  type FinancialAgreementDetailResponse,
} from "./financial-agreements";

function agreement(
  over: Partial<FinancialAgreementDetailResponse> = {},
): FinancialAgreementDetailResponse {
  return {
    id: "agreement-1",
    legal_entity_id: "entity-1",
    counterparty_key: "counterparty-1",
    currency_code: "CLP",
    cash_direction: "outflow",
    agreement_kind: "installment_plan",
    created_at: "2026-09-01T00:00:00Z",
    state: "formalized",
    state_changed_at: "2026-09-10T00:00:00Z",
    terms_version: 1,
    subjects: [{ kind: "payable", source_id: "payable-1", external_reference: null, covered_amount: "100" }],
    events: [],
    latest_terms: {
      version: 1,
      effective_on: "2026-09-05",
      agreed_total_amount: "100",
      external_reference: "RES-1",
      evidence_refs: ["document:res-1"],
      responsible_user_id: "user-1",
      schedule: [{ sequence: 1, due_date: "2026-09-20", amount: "100" }],
    },
    ...over,
  } as FinancialAgreementDetailResponse;
}

describe("buildFormalizedAgreementIndex", () => {
  it("indexa un acuerdo FORMALIZADO por su único sujeto", () => {
    const index = buildFormalizedAgreementIndex([agreement()]);

    expect(index.get(agreementSubjectKey("payable", "payable-1"))).toEqual({
      agreementId: "agreement-1",
      latestTerms: agreement().latest_terms,
    });
    expect(index.size).toBe(1);
  });

  it("ignora un acuerdo PROPUESTO (negotiating/offer_received/disputed): es sólo informativo", () => {
    for (const state of ["negotiating", "offer_received", "disputed"] as const) {
      const index = buildFormalizedAgreementIndex([agreement({ state })]);
      expect(index.size).toBe(0);
    }
  });

  it("ignora un acuerdo ya cumplido, incumplido o terminado: no sigue vigente", () => {
    for (const state of ["fulfilled", "defaulted", "terminated"] as const) {
      const index = buildFormalizedAgreementIndex([agreement({ state })]);
      expect(index.size).toBe(0);
    }
  });

  it("ignora sujetos sin source_id (payroll/tax/settlement/other) — no son un payable/receivable", () => {
    const index = buildFormalizedAgreementIndex([
      agreement({
        subjects: [{ kind: "tax", source_id: null, external_reference: "F29-2026-09", covered_amount: "100" }],
      }),
    ]);
    expect(index.size).toBe(0);
  });

  it("tolera entradas null/undefined (detalle todavía cargando)", () => {
    const index = buildFormalizedAgreementIndex([null, undefined, agreement()]);
    expect(index.size).toBe(1);
  });

  it("un acuerdo con más de un sujeto indexa cada documento que cubre", () => {
    const index = buildFormalizedAgreementIndex([
      agreement({
        subjects: [
          { kind: "payable", source_id: "payable-1", external_reference: null, covered_amount: "60" },
          { kind: "payable", source_id: "payable-2", external_reference: null, covered_amount: "40" },
        ],
      }),
    ]);
    expect(index.size).toBe(2);
    expect(index.has(agreementSubjectKey("payable", "payable-1"))).toBe(true);
    expect(index.has(agreementSubjectKey("payable", "payable-2"))).toBe(true);
  });
});
