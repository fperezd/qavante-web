import { describe, expect, it } from "vitest";
import {
  flattenManagementAccounts,
  toCanonicalCategoryOptions,
  toManagementAccountTreeRows,
} from "./adapters";
import type { ManagementAccountNode } from "@/lib/api/management";
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

  it("árbol vacío ⇒ []", () => {
    expect(toManagementAccountTreeRows([])).toEqual([]);
  });
});
