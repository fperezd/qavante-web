import { describe, it, expect } from "vitest";
import {
  valueFormSchema,
  emptyValueForm,
  valueToForm,
  formToCreateValueRequest,
  formToUpdateValueRequest,
} from "./dimension-value-form-schema";
import type { DimensionValueTreeRow } from "./types";

describe("valueFormSchema", () => {
  it("acepta nombre + code/description opcionales", () => {
    expect(
      valueFormSchema.safeParse({ name: "Obra Norte", code: "", description: "" }).success,
    ).toBe(true);
  });
  it("rechaza nombre vacío", () => {
    expect(valueFormSchema.safeParse({ name: "  ", code: "", description: "" }).success).toBe(
      false,
    );
  });
});

describe("emptyValueForm", () => {
  it("arranca vacío", () => {
    expect(emptyValueForm()).toEqual({ name: "", code: "", description: "" });
  });
});

describe("valueToForm", () => {
  it("mapea la fila del árbol al form", () => {
    const row: DimensionValueTreeRow = {
      id: "1",
      name: "Obra Norte",
      code: "ON",
      description: "glosa",
      level: 1,
      parentId: "r",
      active: true,
    };
    expect(valueToForm(row)).toEqual({ name: "Obra Norte", code: "ON", description: "glosa" });
  });
});

describe("formToCreateValueRequest", () => {
  it("trimea; code/description vacíos → null; parentId del contexto", () => {
    expect(
      formToCreateValueRequest({ name: " Obra ", code: " ON ", description: " g " }, "padre-1"),
    ).toEqual({
      name: "Obra",
      code: "ON",
      description: "g",
      parent_id: "padre-1",
      sort_order: 0,
    });
  });

  it("parentId vacío → parent_id null (raíz); code vacío → null", () => {
    const req = formToCreateValueRequest({ name: "Raíz", code: "", description: "" }, "");
    expect(req.parent_id).toBeNull();
    expect(req.code).toBeNull();
    expect(req.description).toBeNull();
  });
});

describe("formToUpdateValueRequest", () => {
  it("trimea; vacíos → null; no incluye parent (se mueve aparte)", () => {
    const out = formToUpdateValueRequest({ name: "X", code: "", description: "" });
    expect(out).toEqual({ name: "X", code: null, description: null });
    expect(out).not.toHaveProperty("parent_id");
  });
});
