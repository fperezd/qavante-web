import { describe, expect, it } from "vitest";
import {
  flattenManagementAccounts,
  toCanonicalCategoryOptions,
  toManagementAccountTreeRows,
  excludeSelfAndDescendants,
  toManagementDimensionRows,
  toDimensionValueTreeRows,
  toDimensionValueOptions,
} from "./adapters";
import type {
  ManagementAccountNode,
  ManagementDimension,
  ManagementDimensionValue,
} from "@/lib/api/management";
import type { CanonicalCategoryMeta } from "@/lib/api/treasury";

function node(p: Partial<ManagementAccountNode> & { id: string }): ManagementAccountNode {
  return {
    code: p.id,
    name: p.id,
    type: "income",
    destination: "operational_income_statement",
    level: 0,
    sort_order: 0,
    is_system: false,
    is_visible: true,
    affects_pulso: true,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    ...p,
  } as ManagementAccountNode;
}

describe("flattenManagementAccounts", () => {
  it("aplana en pre-orden y preserva level", () => {
    const tree = [
      node({
        id: "a",
        level: 0,
        children: [node({ id: "a1", level: 1 }), node({ id: "a2", level: 1 })],
      }),
      node({ id: "b", level: 0 }),
    ];
    expect(flattenManagementAccounts(tree).map((o) => o.id)).toEqual(["a", "a1", "a2", "b"]);
    expect(flattenManagementAccounts(tree).map((o) => o.level)).toEqual([0, 1, 1, 0]);
  });

  it("displayName usa display_name, con fallback a name", () => {
    const out = flattenManagementAccounts([
      node({ id: "x", name: "Nombre", display_name: "Visible" }),
      node({ id: "y", name: "SoloName", display_name: null }),
    ]);
    expect(out[0]?.displayName).toBe("Visible");
    expect(out[1]?.displayName).toBe("SoloName");
  });

  it("active=false ⇒ selectable=false", () => {
    const out = flattenManagementAccounts([
      node({ id: "on", active: true }),
      node({ id: "off", active: false }),
    ]);
    expect(out.find((o) => o.id === "on")?.selectable).toBe(true);
    expect(out.find((o) => o.id === "off")?.selectable).toBe(false);
  });

  it("árbol vacío ⇒ []", () => {
    expect(flattenManagementAccounts([])).toEqual([]);
  });
});

function meta(p: Partial<CanonicalCategoryMeta> & { code: string }): CanonicalCategoryMeta {
  return {
    label: p.code,
    description: "",
    expected_direction: "any",
    cashflow_group: "unknown",
    default_financial_model: "none",
    default_impact_type: "none",
    default_management_root: "x",
    requires_review: false,
    affects_operational_result_by_default: false,
    is_internal_movement: false,
    allowed_for_bank_movement: true,
    sort_order: 0,
    ...p,
  } as CanonicalCategoryMeta;
}

describe("toCanonicalCategoryOptions", () => {
  it("mapea code/label/description del backend (no hardcodea)", () => {
    const out = toCanonicalCategoryOptions([
      meta({ code: "supplier_payment", label: "Pago a proveedor", description: "Pago a prov." }),
    ]);
    expect(out[0]).toEqual({
      code: "supplier_payment",
      label: "Pago a proveedor",
      description: "Pago a prov.",
      expectedDirection: "any",
    });
  });

  it("expectedDirection: narrowing a credit|debit|any, desconocido ⇒ undefined", () => {
    const out = toCanonicalCategoryOptions([
      meta({ code: "a", expected_direction: "credit" }),
      meta({ code: "b", expected_direction: "raro" }),
    ]);
    expect(out[0]?.expectedDirection).toBe("credit");
    expect(out[1]?.expectedDirection).toBeUndefined();
  });

  it("lista vacía ⇒ []", () => {
    expect(toCanonicalCategoryOptions([])).toEqual([]);
  });
});

describe("toManagementAccountTreeRows", () => {
  it("aplana en pre-orden con code/type/active/isVisible/parentId", () => {
    const tree = [
      node({
        id: "a",
        code: "1",
        level: 0,
        type: "income",
        children: [node({ id: "a1", code: "1.1", level: 1, parent_id: "a", active: false })],
      }),
      node({ id: "b", code: "2", level: 0 }),
    ];
    const rows = toManagementAccountTreeRows(tree);
    expect(rows.map((r) => r.id)).toEqual(["a", "a1", "b"]);
    expect(rows[0]).toMatchObject({
      id: "a",
      code: "1",
      level: 0,
      type: "income",
      parentId: null,
      active: true,
      isVisible: true,
    });
    expect(rows[1]).toMatchObject({ id: "a1", parentId: "a", active: false });
  });

  it("name usa display_name con fallback a name; is_visible → isVisible", () => {
    const rows = toManagementAccountTreeRows([
      node({ id: "x", name: "Nombre", display_name: "Visible", is_visible: false }),
      node({ id: "y", name: "SoloName", display_name: null }),
    ]);
    expect(rows[0]?.name).toBe("Visible");
    expect(rows[0]?.isVisible).toBe(false);
    expect(rows[1]?.name).toBe("SoloName");
  });

  it("expone rawName/displayName separados del display + destination (para editar sin pisar)", () => {
    const rows = toManagementAccountTreeRows([
      node({ id: "x", name: "Ventas netas", display_name: "Ventas", destination: "operating" }),
      node({ id: "y", name: "SoloName", display_name: null, destination: "non_operating" }),
    ]);
    expect(rows[0]).toMatchObject({
      name: "Ventas", // display
      rawName: "Ventas netas", // crudo
      displayName: "Ventas",
      destination: "operating",
    });
    expect(rows[1]).toMatchObject({ rawName: "SoloName", displayName: "", name: "SoloName" });
  });

  it("expone description (fallback '') y affectsPulso para el form de edición", () => {
    const rows = toManagementAccountTreeRows([
      node({ id: "x", description: "glosa", affects_pulso: false }),
      node({ id: "y", description: null, affects_pulso: true }),
    ]);
    expect(rows[0]).toMatchObject({ description: "glosa", affectsPulso: false });
    expect(rows[1]).toMatchObject({ description: "", affectsPulso: true });
  });

  it("árbol vacío ⇒ []", () => {
    expect(toManagementAccountTreeRows([])).toEqual([]);
  });
});

describe("toManagementDimensionRows", () => {
  function dim(p: Partial<ManagementDimension> & { id: string }): ManagementDimension {
    return {
      code: p.id,
      name: p.id,
      data_type: "text",
      is_system: false,
      is_required: false,
      is_visible: true,
      allows_hierarchy: true,
      allows_multiple_values: false,
      sort_order: 0,
      active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      ...p,
    } as ManagementDimension;
  }

  it("mapea los campos del backend a la fila UI (description fallback '')", () => {
    const rows = toManagementDimensionRows([
      dim({
        id: "1",
        code: "proyecto",
        name: "Proyecto",
        description: "Por proyecto",
        data_type: "reference",
        is_required: true,
        is_visible: false,
        allows_hierarchy: false,
        allows_multiple_values: true,
        active: false,
        is_system: true,
      }),
      dim({ id: "2", description: null }),
    ]);
    expect(rows[0]).toEqual({
      id: "1",
      code: "proyecto",
      name: "Proyecto",
      description: "Por proyecto",
      dataType: "reference",
      isRequired: true,
      isVisible: false,
      allowsHierarchy: false,
      allowsMultiple: true,
      active: false,
      isSystem: true,
    });
    expect(rows[1]?.description).toBe("");
  });

  it("lista vacía → []", () => {
    expect(toManagementDimensionRows([])).toEqual([]);
  });
});

describe("toDimensionValueTreeRows", () => {
  function val(p: Partial<ManagementDimensionValue> & { id: string }): ManagementDimensionValue {
    return {
      dimension_id: "d1",
      name: p.id,
      parent_id: null,
      sort_order: 0,
      active: true,
      created_at: "2026-01-01T00:00:00Z",
      ...p,
    } as ManagementDimensionValue;
  }

  it("arma el árbol desde la lista plana y calcula level en pre-orden", () => {
    const rows = toDimensionValueTreeRows([
      val({ id: "a", name: "A", sort_order: 0 }),
      val({ id: "a1", name: "A1", parent_id: "a", sort_order: 0 }),
      val({ id: "a2", name: "A2", parent_id: "a", sort_order: 1 }),
      val({ id: "b", name: "B", sort_order: 1 }),
    ]);
    expect(rows.map((r) => [r.id, r.level])).toEqual([
      ["a", 0],
      ["a1", 1],
      ["a2", 1],
      ["b", 0],
    ]);
  });

  it("ordena hermanos por sort_order y luego name", () => {
    const rows = toDimensionValueTreeRows([
      val({ id: "z", name: "Zeta", sort_order: 0 }),
      val({ id: "a", name: "Alfa", sort_order: 0 }),
      val({ id: "m", name: "Mid", sort_order: -1 }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["m", "a", "z"]);
  });

  it("un valor con parent_id ausente se trata como raíz (no se pierde)", () => {
    const rows = toDimensionValueTreeRows([
      val({ id: "huerfano", parent_id: "no-existe" }),
      val({ id: "raiz" }),
    ]);
    expect(rows.map((r) => r.id).sort()).toEqual(["huerfano", "raiz"]);
    expect(rows.every((r) => r.level === 0)).toBe(true);
  });

  it("no entra en loop infinito ante un ciclo de datos", () => {
    const rows = toDimensionValueTreeRows([
      val({ id: "x", parent_id: "y" }),
      val({ id: "y", parent_id: "x" }),
    ]);
    // Ambos tienen parent presente → no son raíces → el walk arranca de [] y
    // el visited corta cualquier ciclo. No cuelga.
    expect(Array.isArray(rows)).toBe(true);
  });

  it("code/description null → '' ", () => {
    const rows = toDimensionValueTreeRows([val({ id: "a", code: null, description: null })]);
    expect(rows[0]).toMatchObject({ code: "", description: "" });
  });
});

describe("toDimensionValueOptions", () => {
  function val(p: Partial<ManagementDimensionValue> & { id: string }): ManagementDimensionValue {
    return {
      dimension_id: "d1",
      name: p.id,
      parent_id: null,
      sort_order: 0,
      active: true,
      created_at: "2026-01-01T00:00:00Z",
      ...p,
    } as ManagementDimensionValue;
  }

  it("mapea a {id,label,level} y excluye inactivos", () => {
    const opts = toDimensionValueOptions([
      val({ id: "a", name: "Zona Norte", sort_order: 0 }),
      val({ id: "a1", name: "Obra 1", parent_id: "a", sort_order: 0 }),
      val({ id: "a2", name: "Obra inactiva", parent_id: "a", active: false }),
    ]);
    expect(opts).toEqual([
      { id: "a", label: "Zona Norte", level: 0 },
      { id: "a1", label: "Obra 1", level: 1 },
    ]);
  });
});

describe("excludeSelfAndDescendants", () => {
  const rows = toManagementAccountTreeRows([
    node({
      id: "a",
      code: "1",
      children: [
        node({
          id: "a1",
          code: "1.1",
          parent_id: "a",
          children: [node({ id: "a11", parent_id: "a1" })],
        }),
        node({ id: "a2", code: "1.2", parent_id: "a" }),
      ],
    }),
    node({ id: "b", code: "2" }),
  ]);

  it("excluye el nodo y todo su subárbol (anti-ciclo)", () => {
    expect(excludeSelfAndDescendants(rows, "a").map((r) => r.id)).toEqual(["b"]);
  });

  it("excluye self + descendientes anidados, deja hermanos y ancestros", () => {
    expect(excludeSelfAndDescendants(rows, "a1").map((r) => r.id)).toEqual(["a", "a2", "b"]);
  });

  it("una hoja solo se excluye a sí misma", () => {
    expect(excludeSelfAndDescendants(rows, "b").map((r) => r.id)).toEqual(["a", "a1", "a11", "a2"]);
  });
});
