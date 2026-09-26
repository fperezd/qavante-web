import { describe, expect, it } from "vitest";
import type { LegalEntity } from "@/lib/api/legal-entities";
import { companiesForHolder } from "./qavante-bank-connect-widget";

function company(id: string, legalName: string, rut: string): LegalEntity {
  return {
    id,
    legal_name: legalName,
    is_default: false,
    identifiers: [
      {
        id: `${id}-rut`,
        jurisdiction_code: "CL",
        identifier_scheme: "rut",
        normalized_value: rut,
        label: "RUT",
        assertion_quality: "manual",
        evidence_ref: null,
        valid_from: "2026-01-01T00:00:00Z",
      },
    ],
  };
}

describe("companiesForHolder", () => {
  it("reconoce el mismo RUT aunque FinToc lo devuelva con puntos", () => {
    const matching = company("bice", "Tooxs Digital SpA", "76828485-7");
    const other = company("other", "Otra sociedad", "76454786-1");

    expect(companiesForHolder([matching, other], "76.828.485-7")).toEqual([matching]);
  });
});
