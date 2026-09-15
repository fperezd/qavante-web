import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { debeReiniciarCursor, motivoSinPagos } from "./pagar-v05-live";

describe("Pagar V05 live D02", () => {
  it("reinicia una sola vez únicamente para invalid_cursor paginado", () => {
    const error = new ApiError("cursor inválido", 422, "invalid_cursor");
    expect(debeReiniciarCursor(error, "cursor-2", null)).toBe(true);
    expect(debeReiniciarCursor(error, "cursor-2", "cursor-2")).toBe(false);
    expect(debeReiniciarCursor(error, undefined, null)).toBe(false);
    expect(
      debeReiniciarCursor(new ApiError("filtro", 422, "invalid_filter"), "cursor-2", null),
    ).toBe(false);
  });

  it("explica el guard legacy sin degradar a cifras parciales", () => {
    expect(
      motivoSinPagos(new ApiError("incompatible", 502, "incompatible_accounts_payable_contract")),
    ).toMatch(/versión anterior.*No mostramos cifras ni filtros parciales/);
  });
});
