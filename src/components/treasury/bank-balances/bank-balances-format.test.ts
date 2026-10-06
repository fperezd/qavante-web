import { describe, expect, it } from "vitest";
import { parseSaldo, formatSaldo } from "./bank-balances-format";

describe("bank-balances-format · parseSaldo", () => {
  it("parsea el saldo-string del backend", () => {
    expect(parseSaldo("1931152.70")).toBe(1931152.7);
    expect(parseSaldo("156.14")).toBe(156.14);
    expect(parseSaldo("0")).toBe(0);
  });
  it("null/vacío/whitespace/no-numérico → null (no $0)", () => {
    expect(parseSaldo(null)).toBeNull();
    expect(parseSaldo("")).toBeNull();
    expect(parseSaldo("   ")).toBeNull(); // en blanco NO es 0
    expect(parseSaldo("N/A")).toBeNull();
  });
});

describe("bank-balances-format · formatSaldo", () => {
  it("CLP sin decimales", () => {
    expect(formatSaldo("1931152.70", "CLP")).toBe("$1.931.153");
    expect(formatSaldo("3073227.32", "CLP")).toBe("$3.073.227");
  });
  it("USD con dos decimales y el separador que ratificó el BO", () => {
    /* El separador entre "US$" y la cifra es NBSP ( ), decisión del BO del
       2026-08-25: `Intl` es-CL rendía el USD PEGADO y todas las demás monedas
       SEPARADAS, o sea dos layouts para el mismo tipo de dato. Estos asserts van con
       el caracter explícito para que se vea cuál es. */
    expect(formatSaldo("156.14", "USD")).toBe("US$ 156,14");
    expect(formatSaldo("1511.25", "USD")).toBe("US$ 1.511,25");
  });
  /* Acá decía `it("moneda ausente → asume CLP")`. Era el segundo candado del mismo defecto
     (B04): un saldo en dólares sin moneda declarada se mostraba con signo de peso. El saldo se
     muestra completo y lo que falta se nombra. */
  it("moneda ausente NO se asume CLP: el saldo con el rótulo de la moneda que falta", () => {
    expect(formatSaldo("1000", null)).toBe("1.000,00 · moneda no informada");
    expect(formatSaldo("1000", null)).not.toContain("$");
  });

  /* GEMELO: el saldo en pesos sigue siendo pesos y sin decimales. */
  it("GEMELO: CLP declarado sigue sin decimales", () => {
    expect(formatSaldo("1000", "CLP")).toBe("$1.000");
  });
  it("sin dato → guion", () => {
    expect(formatSaldo(null, "CLP")).toBe("Sin información");
    expect(formatSaldo("", "USD")).toBe("Sin información");
  });
});
