import { describe, expect, it } from "vitest";
import { categoriasParaDireccion } from "./canonical-direction";
import type { CanonicalCategoryMeta } from "@/lib/api/treasury";

function meta(p: Partial<CanonicalCategoryMeta> & { code: string }): CanonicalCategoryMeta {
  return {
    label: p.code,
    description: "",
    expected_direction: "any",
    allowed_for_bank_movement: true,
    affects_operational_result_by_default: true,
    cashflow_group: "cash_in",
    default_financial_model: "accrual",
    default_impact_type: "cash_in",
    default_management_root: "income",
    is_internal_movement: false,
    ...p,
  } as CanonicalCategoryMeta;
}

const CATALOGO = [
  meta({ code: "client_collection", label: "Cobro de cliente", expected_direction: "credit" }),
  meta({ code: "supplier_payment", label: "Pago a proveedor", expected_direction: "debit" }),
  meta({ code: "internal_bank_transfer", label: "Traspaso", expected_direction: "any" }),
  meta({ code: "unknown", label: "Sin clasificar", expected_direction: "any" }),
  meta({ code: "no_banco", expected_direction: "any", allowed_for_bank_movement: false }),
];

describe("categoriasParaDireccion", () => {
  /* GEMELO DEL MUTANTE (b): si el filtro por dirección se invierte, estos dos caen. */
  it("un CARGO no ofrece tipos de entrada", () => {
    const codes = categoriasParaDireccion(CATALOGO, "debit").map((c) => c.code);
    expect(codes).toContain("supplier_payment");
    expect(codes).not.toContain("client_collection");
  });

  it("un ABONO no ofrece tipos de salida", () => {
    const codes = categoriasParaDireccion(CATALOGO, "credit").map((c) => c.code);
    expect(codes).toContain("client_collection");
    expect(codes).not.toContain("supplier_payment");
  });

  it("`any` sirve en las dos direcciones", () => {
    expect(categoriasParaDireccion(CATALOGO, "credit").map((c) => c.code)).toContain(
      "internal_bank_transfer",
    );
    expect(categoriasParaDireccion(CATALOGO, "debit").map((c) => c.code)).toContain(
      "internal_bank_transfer",
    );
  });

  it("`unknown` y lo no imputable a un movimiento bancario quedan fuera siempre", () => {
    for (const d of ["credit", "debit", null] as const) {
      const codes = categoriasParaDireccion(CATALOGO, d).map((c) => c.code);
      expect(codes).not.toContain("unknown");
      expect(codes).not.toContain("no_banco");
    }
  });

  it("sin dirección no se adivina: quedan los dos sentidos y el usuario elige", () => {
    const codes = categoriasParaDireccion(CATALOGO, null).map((c) => c.code);
    expect(codes).toContain("client_collection");
    expect(codes).toContain("supplier_payment");
  });

  it("catálogo vacío ⇒ []", () => {
    expect(categoriasParaDireccion([], "debit")).toEqual([]);
  });
});
