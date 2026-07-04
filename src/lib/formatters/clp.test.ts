/* Tests de caracterización de formatClp — formateo de pesos chilenos.
   Envuelve Intl.NumberFormat es-CL. Anti-regresión sobre las decisiones
   de formato que importan para mostrar plata: sin decimales, agrupación
   con punto, símbolo $. */
import { describe, expect, it } from "vitest";
import { formatClp } from "./clp";

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
});
