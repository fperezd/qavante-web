import { describe, expect, it } from "vitest";
import { filterByQuery } from "./filter";

const items = [
  { code: "supplier_payment", label: "Pago a proveedor", description: "Pago comercial" },
  { code: "client_collection", label: "Cobro de cliente", description: "Entrada de caja" },
  { code: "internal_bank_transfer", label: "Transferencia entre cuentas propias", description: "" },
];

describe("filterByQuery", () => {
  it("query vacía devuelve todo (copia, no la referencia)", () => {
    const out = filterByQuery(items, "", ["label"]);
    expect(out).toHaveLength(3);
    expect(out).not.toBe(items);
  });

  it("matchea por substring en label", () => {
    expect(filterByQuery(items, "proveedor", ["label"]).map((i) => i.code)).toEqual([
      "supplier_payment",
    ]);
  });

  it("es case-insensitive y acento-insensible", () => {
    expect(filterByQuery(items, "TRANSFERÉNCIA", ["label"]).map((i) => i.code)).toEqual([
      "internal_bank_transfer",
    ]);
  });

  it("busca en múltiples campos", () => {
    expect(filterByQuery(items, "caja", ["label", "description"]).map((i) => i.code)).toEqual([
      "client_collection",
    ]);
  });

  it("trim de la query", () => {
    expect(filterByQuery(items, "  cobro  ", ["label"])).toHaveLength(1);
  });

  it("sin matches devuelve []", () => {
    expect(filterByQuery(items, "xyz", ["label", "description"])).toEqual([]);
  });

  it("query de solo diacríticos/símbolos (ej. '´', '^') devuelve [], NO toda la lista", () => {
    /* normalize() colapsa '´'/'^' a "" tras NFD+strip; una búsqueda no vacía no
       debe comportarse como vacía (code-review #2). */
    expect(filterByQuery(items, "´", ["label"])).toEqual([]);
    expect(filterByQuery(items, "^", ["label"])).toEqual([]);
  });
});
