import { describe, expect, it } from "vitest";
import { parseSaldo, formatSaldo } from "./bank-balances-format";

describe("bank-balances-format · parseSaldo", () => {
  it("parsea el saldo-string del backend", () => {
    expect(parseSaldo("1931152.70")).toBe(1931152.7);
    expect(parseSaldo("156.14")).toBe(156.14);
    expect(parseSaldo("0")).toBe(0);
  });
  it("null/vacío/no-numérico → null", () => {
    expect(parseSaldo(null)).toBeNull();
    expect(parseSaldo("")).toBeNull();
    expect(parseSaldo("N/A")).toBeNull();
  });
});

describe("bank-balances-format · formatSaldo", () => {
  it("CLP sin decimales", () => {
    expect(formatSaldo("1931152.70", "CLP")).toBe("$1.931.153");
    expect(formatSaldo("3073227.32", "CLP")).toBe("$3.073.227");
  });
  it("USD con dos decimales", () => {
    expect(formatSaldo("156.14", "USD")).toBe("US$156,14");
    expect(formatSaldo("1511.25", "USD")).toBe("US$1.511,25");
  });
  it("moneda ausente → asume CLP", () => {
    expect(formatSaldo("1000", null)).toBe("$1.000");
  });
  it("sin dato → guion", () => {
    expect(formatSaldo(null, "CLP")).toBe("—");
    expect(formatSaldo("", "USD")).toBe("—");
  });
});
