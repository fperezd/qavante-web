import { describe, expect, it } from "vitest";
import { hasPermission, PERM_ASIGNAR_OWNER } from "./permissions";

describe("hasPermission", () => {
  it("owner (wildcard *) concede todo", () => {
    expect(hasPermission(["*"], "users.write")).toBe(true);
    expect(hasPermission(["*"], PERM_ASIGNAR_OWNER)).toBe(true);
    expect(hasPermission(["*"], "cualquier.cosa")).toBe(true);
  });

  it("match exacto", () => {
    expect(hasPermission(["users.read", "users.invite"], "users.invite")).toBe(true);
    expect(hasPermission(["users.read"], "users.write")).toBe(false);
  });

  it("wildcard de segmento (users.* cubre users.invite)", () => {
    expect(hasPermission(["users.*"], "users.invite")).toBe(true);
    expect(hasPermission(["users.*"], "financial.read")).toBe(false);
  });

  // Conservador: sin permisos NO concede. El fallback a rol lo decide el caller.
  it("lista vacía / undefined → false (no concede de más)", () => {
    expect(hasPermission([], "users.read")).toBe(false);
    expect(hasPermission(undefined, "users.read")).toBe(false);
  });

  it("needed vacío → false", () => {
    expect(hasPermission(["*"], "")).toBe(false);
  });

  it("admin NO tiene el wildcard → no puede asignar owner", () => {
    const admin = ["users.read", "users.write", "users.invite", "financial.write"];
    expect(hasPermission(admin, PERM_ASIGNAR_OWNER)).toBe(false);
    expect(hasPermission(admin, "users.invite")).toBe(true);
  });
});
