import { describe, expect, it } from "vitest";
import { asUserRole, USER_ROLES } from "./types";

describe("asUserRole", () => {
  it("reconoce los roles conocidos", () => {
    for (const r of USER_ROLES) expect(asUserRole(r)).toBe(r);
  });

  // El backend tipa role como string libre: un rol nuevo no debe colarse como conocido.
  it("un rol desconocido cae a undefined, no se castea", () => {
    expect(asUserRole("super_admin")).toBeUndefined();
    expect(asUserRole("Owner")).toBeUndefined(); // case-sensitive a propósito
  });

  it("null/undefined/vacío → undefined", () => {
    expect(asUserRole(null)).toBeUndefined();
    expect(asUserRole(undefined)).toBeUndefined();
    expect(asUserRole("")).toBeUndefined();
  });
});
