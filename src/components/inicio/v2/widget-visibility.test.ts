import { describe, it, expect } from "vitest";
import {
  readHidden,
  withHidden,
  toggleHidden,
  applyVisibility,
  isVisible,
  WIDGET_HIDDEN_KEY,
} from "./widget-visibility";

describe("readHidden", () => {
  it("lee la lista de apagados", () => {
    expect(readHidden({ [WIDGET_HIDDEN_KEY]: ["cobranza", "pagos"] })).toEqual([
      "cobranza",
      "pagos",
    ]);
  });
  it("defensivo: blob ausente / clave ausente / forma inválida → []", () => {
    expect(readHidden(undefined)).toEqual([]);
    expect(readHidden({})).toEqual([]);
    expect(readHidden({ [WIDGET_HIDDEN_KEY]: "cobranza" })).toEqual([]);
    expect(readHidden({ [WIDGET_HIDDEN_KEY]: [1, 2] })).toEqual([]);
  });
});

describe("withHidden", () => {
  it("guarda la lista preservando el resto del blob (reemplaza, no merge)", () => {
    const blob = { inicio_widget_order: ["caja", "cobranza"], otra: 1 };
    const next = withHidden(blob, ["pagos"]);
    expect(next[WIDGET_HIDDEN_KEY]).toEqual(["pagos"]);
    expect(next.inicio_widget_order).toEqual(["caja", "cobranza"]);
    expect(next.otra).toBe(1);
  });
  it("funciona con blob undefined", () => {
    expect(withHidden(undefined, ["caja"])).toEqual({ [WIDGET_HIDDEN_KEY]: ["caja"] });
  });
});

describe("toggleHidden", () => {
  it("apaga uno visible (lo agrega)", () => {
    expect(toggleHidden([], "caja")).toEqual(["caja"]);
    expect(toggleHidden(["pagos"], "caja")).toEqual(["pagos", "caja"]);
  });
  it("prende uno apagado (lo saca)", () => {
    expect(toggleHidden(["caja", "pagos"], "caja")).toEqual(["pagos"]);
  });
  it("no muta el original", () => {
    const orig = ["caja"];
    toggleHidden(orig, "pagos");
    expect(orig).toEqual(["caja"]);
  });
});

describe("applyVisibility", () => {
  const items = [{ id: "caja" }, { id: "cobranza" }, { id: "pagos" }, { id: "resultado" }];
  it("filtra los apagados, conserva el orden", () => {
    expect(applyVisibility(items, ["cobranza", "resultado"]).map((i) => i.id)).toEqual([
      "caja",
      "pagos",
    ]);
  });
  it("hidden vacío → misma lista (mismo ref)", () => {
    expect(applyVisibility(items, [])).toBe(items);
  });
  it("puede apagar todo (queda vacío)", () => {
    expect(applyVisibility(items, ["caja", "cobranza", "pagos", "resultado"])).toEqual([]);
  });
});

describe("isVisible", () => {
  it("true si no está apagado", () => {
    expect(isVisible(["caja"], "pagos")).toBe(true);
    expect(isVisible(["caja"], "caja")).toBe(false);
  });
});
