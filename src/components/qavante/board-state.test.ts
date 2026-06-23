import { describe, it, expect } from "vitest";
import { findColumnOf, moveItem, type BoardState } from "./board-state";

type Card = { id: string };
const state = (): BoardState<Card> => [
  { id: "todo", title: "Por hacer", items: [{ id: "a" }, { id: "b" }] },
  { id: "doing", title: "En curso", items: [{ id: "c" }] },
  { id: "done", title: "Listo", items: [] },
];

describe("findColumnOf", () => {
  it("encuentra la columna del item", () => {
    expect(findColumnOf(state(), "b")).toBe("todo");
    expect(findColumnOf(state(), "c")).toBe("doing");
  });
  it("undefined si no existe", () => {
    expect(findColumnOf(state(), "z")).toBeUndefined();
  });
});

describe("moveItem", () => {
  it("mueve entre columnas a una columna vacía", () => {
    const next = moveItem(state(), "a", "done");
    expect(next.find((c) => c.id === "todo")!.items.map((i) => i.id)).toEqual(["b"]);
    expect(next.find((c) => c.id === "done")!.items.map((i) => i.id)).toEqual(["a"]);
  });

  it("inserta en el índice indicado de la columna destino", () => {
    const next = moveItem(state(), "c", "todo", 1);
    expect(next.find((c) => c.id === "todo")!.items.map((i) => i.id)).toEqual(["a", "c", "b"]);
  });

  it("reordena dentro de la misma columna", () => {
    const next = moveItem(state(), "a", "todo", 1);
    expect(next.find((c) => c.id === "todo")!.items.map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("item inexistente → estado intacto", () => {
    const s = state();
    expect(moveItem(s, "z", "done")).toBe(s);
  });

  it("es inmutable (no muta el original)", () => {
    const s = state();
    moveItem(s, "a", "done");
    expect(s.find((c) => c.id === "todo")!.items.map((i) => i.id)).toEqual(["a", "b"]);
  });
});
