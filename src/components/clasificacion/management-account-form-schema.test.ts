import { describe, it, expect } from "vitest";
import {
  accountFormSchema,
  emptyAccountForm,
  formToCreateRequest,
  collectAccountDomains,
  humanizeDomain,
  type AccountFormValues,
} from "./management-account-form-schema";
import type { ManagementAccountNode } from "@/lib/api/management";

function node(partial: Partial<ManagementAccountNode>): ManagementAccountNode {
  return {
    id: "x",
    code: "x",
    name: "X",
    type: "income",
    destination: "operating",
    level: 0,
    sort_order: 0,
    is_system: false,
    is_visible: true,
    affects_pulso: true,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    ...partial,
  } as ManagementAccountNode;
}

describe("accountFormSchema", () => {
  const valid: AccountFormValues = {
    code: "1.1",
    name: "Ventas",
    type: "income",
    destination: "operating",
    parentId: "1",
    description: "",
    affectsPulso: true,
  };

  it("acepta un form completo", () => {
    expect(accountFormSchema.safeParse(valid).success).toBe(true);
  });

  it("rechaza code vacío", () => {
    expect(accountFormSchema.safeParse({ ...valid, code: "  " }).success).toBe(false);
  });

  it("rechaza name vacío", () => {
    expect(accountFormSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
  });

  it("rechaza type vacío (sin elegir)", () => {
    expect(accountFormSchema.safeParse({ ...valid, type: "" }).success).toBe(false);
  });

  it("rechaza destination vacío (sin elegir)", () => {
    expect(accountFormSchema.safeParse({ ...valid, destination: "" }).success).toBe(false);
  });

  it("acepta parentId vacío (cuenta raíz)", () => {
    expect(accountFormSchema.safeParse({ ...valid, parentId: "" }).success).toBe(true);
  });
});

describe("emptyAccountForm", () => {
  it("default sin args: todo vacío, affectsPulso true", () => {
    expect(emptyAccountForm()).toEqual({
      code: "",
      name: "",
      type: "",
      destination: "",
      parentId: "",
      description: "",
      affectsPulso: true,
    });
  });

  it("pre-setea parentId + type + destination al crear sub-cuenta", () => {
    const f = emptyAccountForm("parent-1", "income", "operating");
    expect(f.parentId).toBe("parent-1");
    expect(f.type).toBe("income");
    expect(f.destination).toBe("operating");
  });
});

describe("formToCreateRequest", () => {
  it("trimea code/name/description y mapea al contrato", () => {
    const req = formToCreateRequest({
      code: "  1.1 ",
      name: "  Ventas ",
      type: "income",
      destination: "operating",
      parentId: "1",
      description: "  glosa  ",
      affectsPulso: false,
    });
    expect(req).toEqual({
      code: "1.1",
      name: "Ventas",
      type: "income",
      destination: "operating",
      parent_id: "1",
      description: "glosa",
      affects_pulso: false,
      is_visible: true,
      sort_order: 0,
    });
  });

  it("parentId vacío → parent_id null (raíz); description vacía → null", () => {
    const req = formToCreateRequest({
      code: "1",
      name: "Ingresos",
      type: "income",
      destination: "operating",
      parentId: "",
      description: "   ",
      affectsPulso: true,
    });
    expect(req.parent_id).toBeNull();
    expect(req.description).toBeNull();
  });
});

describe("collectAccountDomains", () => {
  it("recolecta types/destinations distintos y ordenados, recorriendo hijos", () => {
    const tree: ManagementAccountNode[] = [
      node({
        id: "1",
        type: "income",
        destination: "operating",
        children: [
          node({ id: "1.1", type: "income", destination: "operating" }),
          node({ id: "1.2", type: "other_income", destination: "non_operating" }),
        ],
      }),
      node({ id: "2", type: "operating_expense", destination: "operating" }),
    ];
    expect(collectAccountDomains(tree)).toEqual({
      types: ["income", "operating_expense", "other_income"],
      destinations: ["non_operating", "operating"],
    });
  });

  it("árbol vacío → listas vacías", () => {
    expect(collectAccountDomains([])).toEqual({ types: [], destinations: [] });
  });
});

describe("humanizeDomain", () => {
  it("snake_case → Capitalizado con espacios", () => {
    expect(humanizeDomain("operating_expense")).toBe("Operating expense");
    expect(humanizeDomain("income")).toBe("Income");
  });

  it("string vacío pasa tal cual", () => {
    expect(humanizeDomain("")).toBe("");
  });
});
