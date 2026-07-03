import { describe, expect, it } from "vitest";
import { buildEmployeesQuery, bukKeys } from "./buk";

describe("buk · buildEmployeesQuery", () => {
  it("sin params → string vacío", () => {
    expect(buildEmployeesQuery({})).toBe("");
  });

  it("status='' (incluir inactivos) se serializa explícito", () => {
    expect(buildEmployeesQuery({ status: "" })).toBe("?status=");
  });

  it("page + full", () => {
    expect(buildEmployeesQuery({ page: 2, full: true })).toBe("?page=2&full=true");
  });

  it("all_pages solo cuando es true", () => {
    expect(buildEmployeesQuery({ allPages: false })).toBe("");
    expect(buildEmployeesQuery({ allPages: true })).toBe("?all_pages=true");
  });
});

describe("buk · bukKeys", () => {
  it("keys estables y distintas por recurso", () => {
    expect(bukKeys.health()).toEqual(["buk", "health"]);
    expect(bukKeys.employees({ page: 1 })).toEqual(["buk", "employees", { page: 1 }]);
    expect(bukKeys.employee("42", true)).toEqual(["buk", "employee", "42", { full: true }]);
    expect(bukKeys.employee("42")).toEqual(["buk", "employee", "42", { full: false }]);
    expect(bukKeys.payroll({ period: "2026-03" })).toEqual(["buk", "payroll", { period: "2026-03" }]);
  });
});
