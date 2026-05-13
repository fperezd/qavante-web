import { describe, it, expect } from "vitest";
import { ROLE_LABELS, ASSIGNABLE_ROLES, STATUS_LABELS } from "./role-labels";

/* Tests anti-regresión sobre mappings del rol/estado. Si el backend agrega un
   rol nuevo, este test falla hasta que el FE lo refleje. Más útil que el
   typecheck porque captura olvidos del label visible (no solo del type). */

describe("role-labels", () => {
  it("ROLE_LABELS cubre los 7 roles del Anexo C.4", () => {
    const expected = [
      "owner",
      "admin",
      "finance_manager",
      "accountant",
      "viewer",
      "external_advisor",
      "technical_admin",
    ];
    expect(Object.keys(ROLE_LABELS).sort()).toEqual(expected.sort());
  });

  it("ASSIGNABLE_ROLES excluye technical_admin (rol Tooxs interno)", () => {
    expect(ASSIGNABLE_ROLES).not.toContain("technical_admin");
    expect(ASSIGNABLE_ROLES).toContain("owner");
    expect(ASSIGNABLE_ROLES).toContain("viewer");
  });

  it("STATUS_LABELS cubre los 3 estados del contrato c0-auth-and-users", () => {
    expect(Object.keys(STATUS_LABELS).sort()).toEqual(["active", "invited", "suspended"]);
  });
});
