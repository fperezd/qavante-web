import { describe, it, expect } from "vitest";
import { reorder, moveColumn } from "./data-table-utils";

describe("reorder", () => {
  it("mueve hacia adelante", () => {
    expect(reorder(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
  });
  it("mueve hacia atrás", () => {
    expect(reorder(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });
  it("índice fuera de rango → copia intacta", () => {
    expect(reorder(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });
  it("es inmutable", () => {
    const src = ["a", "b", "c"];
    reorder(src, 0, 2);
    expect(src).toEqual(["a", "b", "c"]);
  });
});

describe("moveColumn", () => {
  it("reordena por id", () => {
    expect(moveColumn(["rut", "nombre", "monto"], "monto", "rut")).toEqual([
      "monto",
      "rut",
      "nombre",
    ]);
  });
  it("id inexistente → orden original", () => {
    expect(moveColumn(["a", "b"], "x", "a")).toEqual(["a", "b"]);
  });
  it("mismo id → sin cambios", () => {
    expect(moveColumn(["a", "b"], "a", "a")).toEqual(["a", "b"]);
  });
});
