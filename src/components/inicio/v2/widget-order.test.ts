import { describe, it, expect } from "vitest";
import {
  WIDGET_ORDER_KEY,
  applyWidgetOrder,
  moveItem,
  readWidgetOrder,
  withWidgetOrder,
} from "./widget-order";

const items = [{ id: "caja" }, { id: "cobranza" }, { id: "pagos" }, { id: "resultado" }];

describe("applyWidgetOrder", () => {
  it("sin orden guardado devuelve los items tal cual", () => {
    expect(applyWidgetOrder(items, undefined)).toEqual(items);
    expect(applyWidgetOrder(items, [])).toEqual(items);
  });

  it("reordena según el orden guardado", () => {
    const out = applyWidgetOrder(items, ["resultado", "caja", "pagos", "cobranza"]);
    expect(out.map((i) => i.id)).toEqual(["resultado", "caja", "pagos", "cobranza"]);
  });

  it("ids guardados que ya no existen se ignoran (deriva del blob)", () => {
    const out = applyWidgetOrder(items, ["fantasma", "pagos", "caja"]);
    // pagos y caja van primero (en ese orden); cobranza y resultado (sin rank) al final estables
    expect(out.map((i) => i.id)).toEqual(["pagos", "caja", "cobranza", "resultado"]);
  });

  it("items nuevos sin rank van al final conservando su orden original", () => {
    const out = applyWidgetOrder(items, ["pagos"]);
    expect(out.map((i) => i.id)).toEqual(["pagos", "caja", "cobranza", "resultado"]);
  });

  it("no muta el array de entrada", () => {
    const copy = [...items];
    applyWidgetOrder(items, ["resultado", "caja"]);
    expect(items).toEqual(copy);
  });
});

describe("moveItem", () => {
  it("mueve un item a una posición posterior", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("mueve un item a una posición anterior", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("devuelve EL MISMO ref cuando es no-op o fuera de rango", () => {
    const arr = ["a", "b", "c"];
    expect(moveItem(arr, 1, 1)).toBe(arr);
    expect(moveItem(arr, -1, 0)).toBe(arr);
    expect(moveItem(arr, 0, 5)).toBe(arr);
  });
});

describe("readWidgetOrder", () => {
  it("lee un array de strings del blob", () => {
    expect(readWidgetOrder({ [WIDGET_ORDER_KEY]: ["caja", "pagos"] })).toEqual(["caja", "pagos"]);
  });

  it("undefined si la clave no está o no es array de strings", () => {
    expect(readWidgetOrder(undefined)).toBeUndefined();
    expect(readWidgetOrder({})).toBeUndefined();
    expect(readWidgetOrder({ [WIDGET_ORDER_KEY]: "caja" })).toBeUndefined();
    expect(readWidgetOrder({ [WIDGET_ORDER_KEY]: [1, 2] })).toBeUndefined();
  });

  it("con clave propia lee ese orden y NO el default (pantallas independientes)", () => {
    const blob = { [WIDGET_ORDER_KEY]: ["caja"], margenes_widget_order: ["a", "b"] };
    expect(readWidgetOrder(blob, "margenes_widget_order")).toEqual(["a", "b"]);
    expect(readWidgetOrder(blob)).toEqual(["caja"]);
  });
});

describe("withWidgetOrder", () => {
  it("preserva el resto del blob (reemplaza, no hace merge del lado del server)", () => {
    const blob = { tema: "oscuro", [WIDGET_ORDER_KEY]: ["caja"] };
    expect(withWidgetOrder(blob, ["pagos", "caja"])).toEqual({
      tema: "oscuro",
      [WIDGET_ORDER_KEY]: ["pagos", "caja"],
    });
  });

  it("funciona con blob indefinido", () => {
    expect(withWidgetOrder(undefined, ["caja"])).toEqual({ [WIDGET_ORDER_KEY]: ["caja"] });
  });

  it("con clave propia pisa solo esa y preserva el orden de otra pantalla", () => {
    const blob = { [WIDGET_ORDER_KEY]: ["caja"], margenes_widget_order: ["a", "b"] };
    expect(withWidgetOrder(blob, ["b", "a"], "margenes_widget_order")).toEqual({
      [WIDGET_ORDER_KEY]: ["caja"],
      margenes_widget_order: ["b", "a"],
    });
  });
});
