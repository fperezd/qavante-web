/* Tests de caracterización de formatClp — formateo de pesos chilenos.
   Envuelve Intl.NumberFormat es-CL. Anti-regresión sobre las decisiones
   de formato que importan para mostrar plata: sin decimales, agrupación
   con punto, símbolo $. */
import { describe, expect, it } from "vitest";
import { formatClp, formatClpCompact, formatMoney } from "./clp";

/* Quita cualquier espacio (incluido el NBSP que algunas versiones de ICU
   meten entre símbolo y número) para que los asserts no sean frágiles. */
const norm = (s: string) => s.replace(/\s/g, "");

describe("formatClp", () => {
  it("agrupa los miles con punto y antepone $", () => {
    expect(norm(formatClp(1234))).toBe("$1.234");
    expect(norm(formatClp(1000000))).toBe("$1.000.000");
  });

  it("no muestra decimales (redondea al entero)", () => {
    expect(norm(formatClp(1234.56))).toBe("$1.235");
    expect(formatClp(1234.56)).not.toContain(",");
  });

  it("formatea el cero", () => {
    expect(norm(formatClp(0))).toBe("$0");
  });

  it("negativos: menos tipográfico (−) antes del símbolo → −$5.000", () => {
    const out = norm(formatClp(-5000));
    expect(out).toBe("−$5.000");
    expect(out).toContain("−"); // U+2212, no el guion ASCII
    expect(out.startsWith("−$")).toBe(true);
  });

  it("no genera −$0 cuando el valor redondea a cero", () => {
    expect(norm(formatClp(-0.4))).toBe("$0");
    expect(norm(formatClp(-0))).toBe("$0");
  });

  it("no-finito (NaN/Infinity) → guion, NO $NaN/$∞", () => {
    expect(formatClp(NaN)).toBe("s/d");
    expect(formatClp(Infinity)).toBe("s/d");
    expect(formatClp(-Infinity)).toBe("s/d");
  });
});

describe("formatClpCompact", () => {
  it("millones → $X,XM (una decimal, coma es-CL)", () => {
    expect(norm(formatClpCompact(1_200_000))).toBe("$1,2M");
    expect(norm(formatClpCompact(12_300_000))).toBe("$12,3M");
    expect(norm(formatClpCompact(1_000_000))).toBe("$1M");
  });

  it("miles → $XK (redondea)", () => {
    expect(norm(formatClpCompact(980_000))).toBe("$980K");
    expect(norm(formatClpCompact(1_500))).toBe("$2K");
  });

  it("bajo mil → cae al exacto (formatClp)", () => {
    expect(norm(formatClpCompact(999))).toBe("$999");
    expect(norm(formatClpCompact(0))).toBe("$0");
  });

  it("negativos: menos tipográfico antes del símbolo", () => {
    expect(norm(formatClpCompact(-1_200_000))).toBe("−$1,2M");
    expect(norm(formatClpCompact(-980_000))).toBe("−$980K");
  });

  it("no-finito → guion", () => {
    expect(formatClpCompact(NaN)).toBe("s/d");
    expect(formatClpCompact(Infinity)).toBe("s/d");
  });
});

describe("formatMoney", () => {
  it("CLP: punto de miles, sin decimales (igual que formatClp)", () => {
    expect(norm(formatMoney(1234567, "CLP"))).toBe("$1.234.567");
    expect(norm(formatMoney(1234567, "clp"))).toBe("$1.234.567");
    expect(norm(formatMoney(-300000, "CLP"))).toBe("−$300.000");
  });

  it("USD: símbolo US$, punto de miles, coma decimal, DOS decimales", () => {
    expect(norm(formatMoney(19, "USD"))).toBe("US$19,00");
    expect(norm(formatMoney(1234.5, "USD"))).toBe("US$1.234,50");
    expect(norm(formatMoney(-270.4, "USD"))).toBe("−US$270,40");
  });

  it("moneda ausente → CLP por defecto", () => {
    expect(norm(formatMoney(1000, null))).toBe("$1.000");
    expect(norm(formatMoney(1000, undefined))).toBe("$1.000");
  });

  it("moneda desconocida no rompe (formato genérico con 2 decimales)", () => {
    expect(norm(formatMoney(1234.5, "XXX"))).toContain("1.234,50");
  });

  it("moneda vacía '' → CLP (no RangeError de Intl)", () => {
    expect(norm(formatMoney(1000, ""))).toBe("$1.000");
  });

  it("no-finito → guion", () => {
    expect(formatMoney(NaN, "CLP")).toBe("s/d");
    expect(formatMoney(Infinity, "USD")).toBe("s/d");
  });
});
