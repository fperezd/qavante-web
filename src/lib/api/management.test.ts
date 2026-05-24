/* Sanity de los contratos management (árbol cuentas + dimensiones) vía MSW
   + estabilidad de query keys. Si rompe tras tocar handlers.ts o
   management.ts, el mock dejó de respetar el shape §10.2/§10.4. */
import { describe, expect, it } from "vitest";
import {
  managementKeys,
  type ManagementAccount,
  type ManagementAccountTreeResponse,
  type ManagementDimension,
  type ManagementDimensionValue,
  type DimensionAssignment,
  type DimensionsListResponse,
  type DimensionValuesListResponse,
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
    expect(managementKeys.dimensionValues("dim-1")).toEqual([
      "management",
      "dimensions",
      "dim-1",
      "values",
    ]);
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

  it("GET /api/management/dimensions/:id/values → lista plana con parent_id", async () => {
    const r = await fetch(`${API}/api/management/dimensions/dim-proyecto/values`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as DimensionValuesListResponse;
    expect(Array.isArray(body.items)).toBe(true);
    const child = body.items.find((v) => v.parent_id != null);
    expect(child).toBeDefined();
    expect(typeof child?.name).toBe("string");
    expect(typeof child?.dimension_id).toBe("string");
  });
});

describe("MSW — management/accounts mutations (Sprint C2 PR-Mng1)", () => {
  it("POST /accounts → 201 con shape ManagementAccount completo", async () => {
    const r = await fetch(`${API}/api/management/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "ingresos.servicios",
        name: "Servicios",
        type: "income",
        destination: "operational_income_statement",
        parent_id: "acc-ingresos",
        affects_pulso: true,
        is_visible: true,
        sort_order: 20,
      }),
    });
    expect(r.status).toBe(201);
    const body = (await r.json()) as ManagementAccount;
    expect(typeof body.id).toBe("string");
    expect(body.code).toBe("ingresos.servicios");
    expect(body.name).toBe("Servicios");
    expect(body.parent_id).toBe("acc-ingresos");
    expect(typeof body.active).toBe("boolean");
  });

  it("POST /accounts sin campos requeridos → 422 validation_error", async () => {
    const r = await fetch(`${API}/api/management/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "x" }),
    });
    expect(r.status).toBe(422);
  });

  it("PATCH /accounts/:id → 200 con id preservado y campos actualizados", async () => {
    const r = await fetch(`${API}/api/management/accounts/acc-ventas`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: "Ventas de productos premium" }),
    });
    expect(r.status).toBe(200);
    const body = (await r.json()) as ManagementAccount;
    expect(body.id).toBe("acc-ventas");
    expect(body.display_name).toBe("Ventas de productos premium");
  });

  it("POST /accounts/:id/move → 200 con parent_id = new_parent_id", async () => {
    const r = await fetch(`${API}/api/management/accounts/acc-ventas/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_parent_id: null }),
    });
    expect(r.status).toBe(200);
    const body = (await r.json()) as ManagementAccount;
    expect(body.id).toBe("acc-ventas");
    expect(body.parent_id).toBeNull();
  });

  it("POST /accounts/:id/toggle-active → 200 con active=false", async () => {
    const r = await fetch(`${API}/api/management/accounts/acc-ventas/toggle-active`, {
      method: "POST",
    });
    expect(r.status).toBe(200);
    const body = (await r.json()) as ManagementAccount;
    expect(body.active).toBe(false);
  });

  it("POST /accounts/:id/toggle-visible → 200 con is_visible=false", async () => {
    const r = await fetch(`${API}/api/management/accounts/acc-ventas/toggle-visible`, {
      method: "POST",
    });
    expect(r.status).toBe(200);
    const body = (await r.json()) as ManagementAccount;
    expect(body.is_visible).toBe(false);
  });
});

describe("MSW — management/dimensions mutations (Sprint C2 PR-Mng2)", () => {
  it("POST /dimensions → 201 con shape ManagementDimension", async () => {
    const r = await fetch(`${API}/api/management/dimensions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "cliente",
        name: "Cliente",
        data_type: "text",
        is_required: false,
        is_visible: true,
        allows_hierarchy: false,
        allows_multiple_values: false,
        sort_order: 20,
      }),
    });
    expect(r.status).toBe(201);
    const body = (await r.json()) as ManagementDimension;
    expect(body.code).toBe("cliente");
    expect(body.name).toBe("Cliente");
    expect(typeof body.id).toBe("string");
  });

  it("POST /dimensions sin code o name → 422", async () => {
    const r = await fetch(`${API}/api/management/dimensions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data_type: "text" }),
    });
    expect(r.status).toBe(422);
  });

  it("PATCH /dimensions/:id → 200 con id preservado y campos actualizados", async () => {
    const r = await fetch(`${API}/api/management/dimensions/dim-proyecto`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "Analiza por proyecto/obra." }),
    });
    expect(r.status).toBe(200);
    const body = (await r.json()) as ManagementDimension;
    expect(body.id).toBe("dim-proyecto");
    expect(body.description).toBe("Analiza por proyecto/obra.");
  });

  it("POST /dimensions/:id/values → 201 con dimension_id del path", async () => {
    const r = await fetch(`${API}/api/management/dimensions/dim-proyecto/values`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Proyecto Sur", sort_order: 20 }),
    });
    expect(r.status).toBe(201);
    const body = (await r.json()) as ManagementDimensionValue;
    expect(body.name).toBe("Proyecto Sur");
    expect(body.dimension_id).toBe("dim-proyecto");
  });

  it("POST /dimensions/:id/values sin name → 422", async () => {
    const r = await fetch(`${API}/api/management/dimensions/dim-proyecto/values`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sort_order: 10 }),
    });
    expect(r.status).toBe(422);
  });

  it("PATCH /dimension-values/:id → 200 con id preservado", async () => {
    const r = await fetch(`${API}/api/management/dimension-values/val-norte`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Proyecto Norte (actualizado)" }),
    });
    expect(r.status).toBe(200);
    const body = (await r.json()) as ManagementDimensionValue;
    expect(body.id).toBe("val-norte");
    expect(body.name).toBe("Proyecto Norte (actualizado)");
  });

  it("POST /dimension-values/:id/move → 200 con parent_id = new_parent_id", async () => {
    const r = await fetch(`${API}/api/management/dimension-values/val-norte-fase1/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_parent_id: null }),
    });
    expect(r.status).toBe(200);
    const body = (await r.json()) as ManagementDimensionValue;
    expect(body.parent_id).toBeNull();
  });

  it("POST /dimension-assignments → 201 con shape DimensionAssignment", async () => {
    const r = await fetch(`${API}/api/management/dimension-assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity_type: "bank_movement",
        entity_id: "mov-1",
        dimension_id: "dim-proyecto",
        dimension_value_id: "val-norte",
      }),
    });
    expect(r.status).toBe(201);
    const body = (await r.json()) as DimensionAssignment;
    expect(body.entity_type).toBe("bank_movement");
    expect(body.entity_id).toBe("mov-1");
    expect(typeof body.id).toBe("string");
  });

  it("POST /dimension-assignments sin campos requeridos → 422", async () => {
    const r = await fetch(`${API}/api/management/dimension-assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity_type: "bank_movement" }),
    });
    expect(r.status).toBe(422);
  });

  it("DELETE /dimension-assignments/:id → 204 sin body", async () => {
    const r = await fetch(`${API}/api/management/dimension-assignments/assignment-1`, {
      method: "DELETE",
    });
    expect(r.status).toBe(204);
  });
});
