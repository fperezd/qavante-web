/* Sanity de los contratos management (árbol cuentas + dimensiones) vía MSW
   + estabilidad de query keys. Si rompe tras tocar handlers.ts o
   management.ts, el mock dejó de respetar el shape §10.2/§10.4. */
import { describe, expect, it } from "vitest";
import {
  managementKeys,
  type ManagementAccountTreeResponse,
  type DimensionsListResponse,
} from "./management";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

describe("managementKeys", () => {
  it("keys estables y namespaced; varían por parámetro", () => {
    expect(managementKeys.all).toEqual(["management"]);
    expect(managementKeys.accountsTree(false)).toEqual([
      "management",
      "accounts",
      "tree",
      { includeInactive: false },
    ]);
    expect(managementKeys.accountsTree(true)).not.toEqual(managementKeys.accountsTree(false));
    expect(managementKeys.dimensions(true)).toEqual([
      "management",
      "dimensions",
      { onlyActive: true },
    ]);
  });
});

describe("MSW — management", () => {
  it("GET /api/management/accounts/tree → items con shape §10.2 + children", async () => {
    const r = await fetch(`${API}/api/management/accounts/tree`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as ManagementAccountTreeResponse;
    expect(Array.isArray(body.items)).toBe(true);
    const root = body.items[0];
    if (!root) throw new Error("fixture debe traer al menos una cuenta raíz");
    expect(typeof root.id).toBe("string");
    expect(typeof root.code).toBe("string");
    expect(typeof root.name).toBe("string");
    expect(typeof root.level).toBe("number");
    expect(typeof root.active).toBe("boolean");
    expect(Array.isArray(root.children)).toBe(true);
  });

  it("GET /api/management/dimensions → items con allows_multiple_values", async () => {
    const r = await fetch(`${API}/api/management/dimensions`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as DimensionsListResponse;
    const dim = body.items[0];
    if (!dim) throw new Error("fixture debe traer al menos una dimensión");
    expect(typeof dim.code).toBe("string");
    expect(typeof dim.name).toBe("string");
    expect(typeof dim.allows_multiple_values).toBe("boolean");
  });
});
