import { describe, it, expect } from "vitest";
import {
  dimensionFormSchema,
  emptyDimensionForm,
  dimensionToForm,
  formToCreateDimensionRequest,
  formToUpdateDimensionRequest,
  type DimensionFormValues,
} from "./management-dimension-form-schema";
import type { ManagementDimensionRow } from "./types";

const valid: DimensionFormValues = {
  code: "proyecto",
  name: "Proyecto",
  description: "",
  dataType: "text",
  isRequired: false,
  isVisible: true,
  allowsHierarchy: true,
  allowsMultiple: false,
};

describe("dimensionFormSchema", () => {
  it("acepta un form válido", () => {
    expect(dimensionFormSchema.safeParse(valid).success).toBe(true);
  });

  it("rechaza code/name vacíos", () => {
    expect(dimensionFormSchema.safeParse({ ...valid, code: " " }).success).toBe(false);
    expect(dimensionFormSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
  });

  it("rechaza data_type fuera del enum", () => {
    expect(dimensionFormSchema.safeParse({ ...valid, dataType: "raro" }).success).toBe(false);
  });
});

describe("emptyDimensionForm", () => {
  it("defaults del contrato (text, visible, jerárquica, opcional, single)", () => {
    expect(emptyDimensionForm()).toEqual({
      code: "",
      name: "",
      description: "",
      dataType: "text",
      isRequired: false,
      isVisible: true,
      allowsHierarchy: true,
      allowsMultiple: false,
    });
  });
});

describe("dimensionToForm", () => {
  const row: ManagementDimensionRow = {
    id: "1",
    code: "obra",
    name: "Obra",
    description: "Obras de construcción",
    dataType: "reference",
    isRequired: true,
    isVisible: false,
    allowsHierarchy: false,
    allowsMultiple: true,
    active: true,
    isSystem: false,
  };

  it("mapea la fila al form", () => {
    expect(dimensionToForm(row)).toEqual({
      code: "obra",
      name: "Obra",
      description: "Obras de construcción",
      dataType: "reference",
      isRequired: true,
      isVisible: false,
      allowsHierarchy: false,
      allowsMultiple: true,
    });
  });

  it("data_type desconocido cae a 'text' (defensivo)", () => {
    expect(dimensionToForm({ ...row, dataType: "loquesea" }).dataType).toBe("text");
  });
});

describe("formToCreateDimensionRequest", () => {
  it("trimea y mapea al contrato con sort_order 0", () => {
    expect(
      formToCreateDimensionRequest({ ...valid, code: " p ", name: " P ", description: " d " }),
    ).toEqual({
      code: "p",
      name: "P",
      description: "d",
      data_type: "text",
      is_required: false,
      is_visible: true,
      allows_hierarchy: true,
      allows_multiple_values: false,
      sort_order: 0,
    });
  });

  it("description vacía → null", () => {
    expect(formToCreateDimensionRequest(valid).description).toBeNull();
  });
});

describe("formToUpdateDimensionRequest", () => {
  it("NO incluye code (clave natural inmutable)", () => {
    const out = formToUpdateDimensionRequest({ ...valid, name: "Nuevo" });
    expect(out).not.toHaveProperty("code");
    expect(out.name).toBe("Nuevo");
    expect(out.description).toBeNull();
  });
});
